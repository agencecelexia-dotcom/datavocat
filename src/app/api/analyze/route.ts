import { NextRequest } from "next/server";
import type { Json } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedUser } from "@/lib/supabase/require-user";
import { checkRateLimit } from "@/lib/api-usage/rate-limit";
import { getAnthropicClient } from "@/lib/claude/client";
import { DATAVOCAT_SYSTEM_PROMPT } from "@/lib/claude/analyze-prompt";
import { searchJudilibreForAnalysis } from "@/lib/judilibre/client";
import type { JudilibreDecision } from "@/lib/judilibre/client";
import { searchJusticeDatasets } from "@/lib/datagouv/mcp-client";
import { trackClaudeUsage } from "@/lib/api-usage/track";
import { computeCorpusStats, formatStatsForPrompt } from "@/lib/judilibre/stats";
import { verifyAndCleanMarkdown } from "@/lib/judilibre/verify";
import { extractArticleRefs } from "@/lib/legifrance/extractRefs";
import { searchArticle } from "@/lib/legifrance/client";
import { isLegifranceAvailable } from "@/lib/legifrance/oauth";
import {
  searchConstitutional,
  searchKaliConvention,
} from "@/lib/legifrance/multifond";

export const maxDuration = 300;

/**
 * Taille max de la demande. Sans plafond, une requête volumineuse partait
 * telle quelle dans le prompt (coût) et traversait les regex d'extraction
 * de références, dont certaines sont sujettes au backtracking.
 */
const MAX_QUERY_CHARS = 20_000;

export async function POST(request: NextRequest) {
  // Auth + approbation AVANT tout travail : cette route déclenche ~200 requêtes
  // PISTE, un appel Haiku, des embeddings Voyage et un appel Sonnet. Le
  // middleware exclut `/api/`, donc un compte non validé pouvait la consommer.
  const auth = await requireApprovedUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { query, analysisId } = await request.json();

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (query.length > MAX_QUERY_CHARS) {
    return new Response(
      JSON.stringify({
        error: `Demande trop longue (max ${MAX_QUERY_CHARS} caractères).`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const rate = await checkRateLimit(user.id, "analyze");
  if (!rate.ok) return rate.response;

  // Use admin client for writes (needed for streaming callback after response)
  const supabase = createAdminClient();

  // Create or update analysis record — always scoped to user
  let id = analysisId;
  if (!id) {
    const { data } = await supabase
      .from("analyses")
      .insert({ query, status: "streaming", user_id: user.id })
      .select("id")
      .single();
    id = data?.id;
  } else {
    // Verify the analysis belongs to this user before updating
    const { data: existing } = await supabase
      .from("analyses")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acces refuse" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("analyses")
      .update({ status: "streaming" })
      .eq("id", id)
      .eq("user_id", user.id);
  }

  // Search Judilibre + datagouv en parallèle, avec timeouts.
  const emptyJudilibre = {
    context: "",
    analyzedCount: 0,
    totalFound: 0,
    oldestDate: null as string | null,
    freshestDate: null as string | null,
    decisions: [] as JudilibreDecision[],
    expandLevel: -1 as -1 | 0 | 1 | 2 | 3,
  };
  // Capture les niveaux d'élargissement pour les émettre dans le stream après.
  const expandEvents: Array<{ level: 1 | 2 | 3; count: number }> = [];
  const [judilibreResult, datagouvContext] = await Promise.all([
    Promise.race([
      searchJudilibreForAnalysis(query, {
        userId: user.id,
        userEmail: user.email ?? null,
        onExpand: (level, count) => {
          expandEvents.push({ level, count });
        },
      }).catch(() => emptyJudilibre),
      new Promise<typeof emptyJudilibre>((resolve) =>
        setTimeout(() => resolve(emptyJudilibre), 60000)
      ),
    ]),
    Promise.race([
      searchJusticeDatasets(query).catch(() => ""),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000)),
    ]),
  ]);

  const judilibreContext = judilibreResult.context;
  const corpus = judilibreResult.decisions;
  const hasJudilibre = corpus.length > 0;
  const hasDatagouv = datagouvContext.length > 50;

  // Calcul des VRAIES statistiques sur le corpus Judilibre. Le bloc résultant
  // est injecté dans le user message — Claude est instruit de réciter ces
  // chiffres sans les modifier.
  const corpusStats = hasJudilibre ? computeCorpusStats(corpus) : null;
  const factsBlock = corpusStats ? formatStatsForPrompt(corpusStats) : "";

  // Enrichissement Légifrance : si la query mentionne des articles de loi,
  // on récupère leur texte intégral à jour pour donner à Claude la matière
  // exacte (anti-hallucination des fondements juridiques).
  let legifranceBlock = "";
  let legifranceArticleCount = 0;
  if (isLegifranceAvailable()) {
    const refs = extractArticleRefs(query).slice(0, 5); // cap dur 5 articles
    if (refs.length > 0) {
      const fetched: string[] = [];
      await Promise.all(
        refs.map(async (ref) => {
          try {
            const hits = await searchArticle({
              query: ref.num,
              codeName: ref.code,
              pageSize: 1,
            });
            const hit = hits[0];
            if (hit?.textePlain) {
              const codeLabel = hit.titreTexte || ref.code || "Texte";
              const numLabel = hit.num || ref.num;
              fetched.push(
                `### Article ${numLabel} — ${codeLabel}\n` +
                  `${hit.textePlain.slice(0, 1500)}\n` +
                  (hit.url ? `Source : ${hit.url}\n` : "")
              );
            }
          } catch {
            // fail-silent : Légifrance optionnel
          }
        })
      );
      if (fetched.length > 0) {
        legifranceArticleCount = fetched.length;
        legifranceBlock =
          `\n\n═══ TEXTES DE LOI VÉRIFIÉS (Légifrance, à jour) ═══\n` +
          `Les articles suivants sont cités dans la demande. Leur texte intégral et à jour est ci-dessous. ` +
          `Tu peux t'y référer pour fonder tes observations sur le contenu réel des textes.\n\n` +
          fetched.join("\n") +
          `══════════════════════════════════════════════════════════════════════\n`;
      }
    }
  }

  // Enrichissement contexte : QPC pertinentes + convention collective applicable.
  // Ces blocs sont du CONTEXTE (pas comptabilisés dans les stats jurimétriques)
  // mais essentiels à une analyse honnête : une QPC peut invalider une norme
  // applicable, une convention collective peut majorer indemnités/délais.
  let qpcBlock = "";
  let kaliBlock = "";
  let qpcCount = 0;
  let kaliCount = 0;
  if (isLegifranceAvailable() && hasJudilibre) {
    const [qpcDecisions, kaliArticles] = await Promise.all([
      searchConstitutional(query.slice(0, 200), 5).catch(() => []),
      searchKaliConvention(query.slice(0, 200), 3).catch(() => []),
    ]);
    if (qpcDecisions.length > 0) {
      qpcCount = Math.min(qpcDecisions.length, 3);
      const lines = qpcDecisions.slice(0, 3).map((d) => {
        const num = Array.isArray(d.number) ? d.number[0] : d.number || d.id;
        const date = d.date || "date N/C";
        return `### ${num} — ${date}\n${(d.sommaire || "").slice(0, 600)}`;
      });
      qpcBlock =
        `\n\n═══ JURISPRUDENCE CONSTITUTIONNELLE (QPC pertinentes) ═══\n` +
        `Ces décisions du Conseil constitutionnel touchent au sujet de la demande. ` +
        `Elles peuvent invalider une norme applicable ou en imposer une réserve d'interprétation. ` +
        `Mentionne-les si elles affectent la stratégie.\n\n` +
        lines.join("\n\n") +
        `\n══════════════════════════════════════════════════════════════════════\n`;
    }
    if (kaliArticles.length > 0) {
      kaliCount = Math.min(kaliArticles.length, 3);
      const lines = kaliArticles.slice(0, 3).map((a) => {
        return `### ${a.titreConvention}\n${a.texte}\nSource : ${a.url}`;
      });
      kaliBlock =
        `\n\n═══ CONVENTION COLLECTIVE APPLICABLE (Légifrance KALI) ═══\n` +
        `Articles de convention collective pertinents pour la matière. ` +
        `Une convention collective peut majorer les indemnités, les délais de préavis, ou imposer des procédures spécifiques. ` +
        `Tu DOIS en tenir compte dans la lecture du contentieux.\n\n` +
        lines.join("\n\n") +
        `\n══════════════════════════════════════════════════════════════════════\n`;
    }
  }

  // Stream Claude analysis
  const anthropic = getAnthropicClient();

  // Construction du user message — strictement basée sur les sources fournies.
  // Plus de signal "complete avec tes connaissances" : le prompt système
  // interdit désormais toute citation hors corpus.
  const userMessage = hasJudilibre
    ? `DEMANDE DE L'AVOCAT :
${query}

${judilibreContext}

${factsBlock}
${legifranceBlock}${qpcBlock}${kaliBlock}
${hasDatagouv ? `\n${datagouvContext}\n` : ""}

RAPPEL : tu ne peux citer AUCUNE décision absente du CORPUS JUDILIBRE ci-dessus, ni inventer aucun chiffre absent du bloc FAITS VÉRIFIÉS. Toute référence non vérifiable sera supprimée du rapport final par un contrôle automatique. Pour les textes de loi cités, le bloc TEXTES DE LOI VÉRIFIÉS contient leur contenu intégral à jour — utilise-le. Le bloc JURISPRUDENCE CONSTITUTIONNELLE peut être cité pour signaler une QPC affectant la matière. Le bloc CONVENTION COLLECTIVE doit guider l'analyse des indemnités, préavis et procédures spécifiques.`
    : `DEMANDE DE L'AVOCAT :
${query}

CORPUS JUDILIBRE : aucune décision n'a pu être récupérée pour cette requête.

RAPPEL : tu ne peux citer aucune décision puisque le corpus est vide. Limite-toi à :
- décrire la situation juridique de l'avocat
- citer les textes de loi applicables (par leur numéro, sans rattacher à un arrêt nommé)
- expliquer pourquoi l'analyse jurimétrique n'est pas réalisable sur ce sujet
- inviter l'avocat à reformuler sa requête avec d'autres mots-clés.

N'invente AUCUNE décision, AUCUNE statistique. Toute référence sera détectée comme hallucination par le contrôle automatique.`;

  // Sonnet 5 par défaut pour l'analyse. Override via env ANALYZE_MODEL.
  // NB : `claude-sonnet-4-20250514` était codé en dur et n'est plus servi par
  // l'API (404 not_found_error) — toute analyse échouait.
  const ANALYZE_MODEL = process.env.ANALYZE_MODEL || "claude-sonnet-5";

  const stream = await anthropic.messages.stream({
    model: ANALYZE_MODEL,
    max_tokens: 32000,
    system: [
      {
        type: "text",
        text: DATAVOCAT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        // Préludes d'étapes — le front les intercepte pour animer le loader.
        controller.enqueue(
          encoder.encode(
            `[STEP:judilibre:done count=${judilibreResult.analyzedCount} total=${judilibreResult.totalFound}]\n`
          )
        );
        // Émissions des élargissements éventuels (Règle 5 : recherche progressive si < 30).
        for (const ev of expandEvents) {
          controller.enqueue(
            encoder.encode(
              `[STEP:judilibre:expand level=${ev.level} count=${ev.count}]\n`
            )
          );
        }
        controller.enqueue(
          encoder.encode(
            `[STEP:datagouv:done has=${hasDatagouv ? 1 : 0}]\n`
          )
        );
        controller.enqueue(encoder.encode("[STEP:claude:start]\n"));

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }

        controller.enqueue(encoder.encode("\n[STEP:claude:done]\n"));

        // Une génération vide passait jusqu'ici en `status: done` avec une
        // réponse de longueur nulle, sans qu'aucun signal ne remonte.
        if (fullResponse.trim().length === 0) {
          try {
            const fm = await stream.finalMessage();
            console.error(
              `[analyze] generation VIDE — modele=${ANALYZE_MODEL}, corpus=${corpus.length} dec., ` +
                `stop_reason=${fm.stop_reason}, blocs=[${fm.content.map((b) => b.type).join(",")}], ` +
                `in=${fm.usage.input_tokens} out=${fm.usage.output_tokens}`
            );
          } catch (e) {
            console.error(
              `[analyze] generation VIDE + finalMessage en echec :`,
              e instanceof Error ? e.message : e
            );
          }
        }

        // ─── Vérification post-génération ───────────────────────────
        // Toute référence ECLI/pourvoi citée par Claude qui n'est pas
        // dans le corpus Judilibre fourni → la phrase est SUPPRIMÉE du
        // rapport final. Idem pour les lignes de tableau. Si N tableau
        // change, les occurrences de N dans l'intro/stats sont patchées
        // pour préserver l'invariant Règle 1.
        const verification = hasJudilibre
          ? verifyAndCleanMarkdown(fullResponse, corpus)
          : {
              cleanedMarkdown: fullResponse,
              citedRefs: 0,
              verifiedRefs: 0,
              unverifiedRefs: [],
              unverifiedDetails: [],
              removedSentences: 0,
              removedRows: 0,
              coherenceCorrected: false,
              countMismatch: null,
            };

        const finalMarkdown = verification.cleanedMarkdown;

        controller.enqueue(
          encoder.encode(
            `\n[STEP:verify:done cited=${verification.citedRefs} verified=${verification.verifiedRefs} removed=${verification.removedSentences + verification.removedRows} coherence=${verification.coherenceCorrected ? 1 : 0}]\n`
          )
        );

        // Save cleaned response + corpus + verification metadata
        if (id) {
          // `judilibre_corpus` et `verification` figurent désormais dans les
          // types Database (migration 00018) : plus de cast de contournement.
          const updateClient = supabase;
          // Composition du corpus 4 catégories (Règle 2).
          const corpusComposition = corpusStats
            ? {
                total: corpusStats.total,
                premierDegre: corpusStats.hierarchy.premierDegre.total,
                courAppel: corpusStats.hierarchy.courAppel.total,
                cassation: corpusStats.hierarchy.cassation.total,
                conseilEtat: corpusStats.hierarchy.conseilEtat.total,
                // Champs hérités pour rétro-compat.
                cassationCount: corpusStats.hierarchy.cassation.total,
                fondCount:
                  corpusStats.hierarchy.premierDegre.total +
                  corpusStats.hierarchy.courAppel.total,
                cassationPct:
                  corpusStats.total > 0
                    ? Math.round(
                        (corpusStats.hierarchy.cassation.total /
                          corpusStats.total) *
                          100
                      )
                    : 0,
                fondPct:
                  corpusStats.total > 0
                    ? Math.round(
                        ((corpusStats.hierarchy.premierDegre.total +
                          corpusStats.hierarchy.courAppel.total) /
                          corpusStats.total) *
                          100
                      )
                    : 0,
                cassationRate: corpusStats.hierarchy.cassation.cassationRate ?? null,
                fondAcceptanceRate:
                  corpusStats.hierarchy.premierDegre.total +
                    corpusStats.hierarchy.courAppel.total >
                  0
                    ? Math.round(
                        ((corpusStats.hierarchy.premierDegre.favorables +
                          corpusStats.hierarchy.courAppel.favorables) /
                          (corpusStats.hierarchy.premierDegre.total +
                            corpusStats.hierarchy.courAppel.total)) *
                          1000
                      ) / 10
                    : null,
              }
            : null;

          // ─── Axe 3 : composantes A/B/C/D de l'indice de fiabilité ──
          // Calculées sur les vraies stats du corpus, stockées telles quelles
          // pour que le client les affiche sans recalcul. La formule reste
          // (A × 0,35) + (B × 0,25) + (C × 0,20) + (D × 0,20).
          const fiabiliteFormula = corpusStats
            ? (() => {
                const A = corpusStats.coherencePct;
                const B = Math.min(100, (corpusStats.total / 30) * 100);
                const C =
                  corpusStats.nonEmptyCategories >= 2
                    ? 100
                    : corpusStats.nonEmptyCategories === 1
                      ? 50
                      : 0;
                const D =
                  corpusStats.total > 0
                    ? (corpusStats.freshDecisionsFiveYears /
                        corpusStats.total) *
                      100
                    : 0;
                const score = A * 0.35 + B * 0.25 + C * 0.2 + D * 0.2;
                return {
                  A: Math.round(A * 10) / 10,
                  B: Math.round(B * 10) / 10,
                  C: Math.round(C * 10) / 10,
                  D: Math.round(D * 10) / 10,
                  score: Math.round(score * 10) / 10,
                };
              })()
            : null;

          await updateClient
            .from("analyses")
            .update({
              response: finalMarkdown,
              status: "done",
              // Sérialisation explicite : les colonnes JSONB acceptent du Json,
              // et `JudilibreDecision` n'a pas d'index signature.
              judilibre_corpus: corpus as unknown as Json,
              verification: {
                citedRefs: verification.citedRefs,
                verifiedRefs: verification.verifiedRefs,
                unverifiedRefs: verification.unverifiedRefs,
                removedSentences: verification.removedSentences,
                removedRows: verification.removedRows,
                coherenceCorrected: verification.coherenceCorrected,
                corpusComposition,
                fiabilite: fiabiliteFormula,
                tauxSuccesRetenu: corpusStats?.tauxSuccesRetenu ?? null,
                tauxSuccesSource: corpusStats?.tauxSuccesSource ?? null,
                tauxSuccesN: corpusStats?.tauxSuccesN ?? null,
                tauxSuccesMarge: corpusStats?.tauxSuccesMarge ?? null,
                indeterminesTotal: corpusStats?.indeterminesTotal ?? null,
                countMismatch: verification.countMismatch,
                temporalTrend: corpusStats?.temporalTrend ?? null,
                regionalVariations: corpusStats?.regionalVariations ?? null,
                chamberVariations: corpusStats?.chamberVariations ?? null,
                themeVariations: corpusStats?.themeVariations ?? null,
                additionalSources: {
                  legifranceArticles: legifranceArticleCount,
                  qpc: qpcCount,
                  kali: kaliCount,
                },
              },
            })
            .eq("id", id);
        }

        // Track API usage (fail-silent)
        try {
          const finalMessage = await stream.finalMessage();
          const usage = finalMessage.usage as typeof finalMessage.usage & {
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
          await trackClaudeUsage({
            userId: user.id,
            userEmail: user.email || null,
            model: ANALYZE_MODEL,
            operation: "analyze",
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cacheWriteTokens: usage.cache_creation_input_tokens || 0,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
            analysisId: id,
          });
        } catch {
          // fail silent
        }
      } catch (err) {
        // Journalisation explicite : cette erreur était auparavant écrite en
        // base mais jamais loguée, rendant tout diagnostic impossible en prod.
        console.error(
          "[analyze] echec de generation :",
          err instanceof Error ? err.message : err,
          "| texte partiel :",
          fullResponse.length,
          "car."
        );
        if (id) {
          await supabase
            .from("analyses")
            .update({
              status: "error",
              response: fullResponse || String(err),
            })
            .eq("id", id);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Analysis-Id": id || "",
      "X-Decisions-Analyzed": String(judilibreResult.analyzedCount),
      "X-Decisions-Found": String(judilibreResult.totalFound),
      "X-Decisions-Oldest": judilibreResult.oldestDate || "",
      "X-Decisions-Freshest": judilibreResult.freshestDate || "",
    },
  });
}
