import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/claude/client";
import { DATAVOCAT_SYSTEM_PROMPT } from "@/lib/claude/analyze-prompt";
import { searchJudilibreForAnalysis } from "@/lib/judilibre/client";
import type { JudilibreDecision } from "@/lib/judilibre/client";
import { searchJusticeDatasets } from "@/lib/datagouv/mcp-client";
import { trackClaudeUsage } from "@/lib/api-usage/track";
import { computeCorpusStats, formatStatsForPrompt } from "@/lib/judilibre/stats";
import { verifyAndCleanMarkdown } from "@/lib/judilibre/verify";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { query, analysisId } = await request.json();

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get the authenticated user
  const serverSupabase = await createClient();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

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

${hasDatagouv ? `\n${datagouvContext}\n` : ""}

RAPPEL : tu ne peux citer AUCUNE décision absente du CORPUS JUDILIBRE ci-dessus, ni inventer aucun chiffre absent du bloc FAITS VÉRIFIÉS. Toute référence non vérifiable sera supprimée du rapport final par un contrôle automatique.`
    : `DEMANDE DE L'AVOCAT :
${query}

CORPUS JUDILIBRE : aucune décision n'a pu être récupérée pour cette requête.

RAPPEL : tu ne peux citer aucune décision puisque le corpus est vide. Limite-toi à :
- décrire la situation juridique de l'avocat
- citer les textes de loi applicables (par leur numéro, sans rattacher à un arrêt nommé)
- expliquer pourquoi l'analyse jurimétrique n'est pas réalisable sur ce sujet
- inviter l'avocat à reformuler sa requête avec d'autres mots-clés.

N'invente AUCUNE décision, AUCUNE statistique. Toute référence sera détectée comme hallucination par le contrôle automatique.`;

  // Sonnet 4 par défaut pour l'analyse. Override via env ANALYZE_MODEL.
  const ANALYZE_MODEL =
    process.env.ANALYZE_MODEL || "claude-sonnet-4-20250514";

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
              removedSentences: 0,
              removedRows: 0,
              coherenceCorrected: false,
            };

        const finalMarkdown = verification.cleanedMarkdown;

        controller.enqueue(
          encoder.encode(
            `\n[STEP:verify:done cited=${verification.citedRefs} verified=${verification.verifiedRefs} removed=${verification.removedSentences + verification.removedRows} coherence=${verification.coherenceCorrected ? 1 : 0}]\n`
          )
        );

        // Save cleaned response + corpus + verification metadata
        if (id) {
          // Cast pour bypass des types Database non régénérés (judilibre_corpus,
          // verification ne sont pas dans les types autogen).
          const updateClient = supabase as unknown as {
            from: (table: string) => {
              update: (row: Record<string, unknown>) => {
                eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
              };
            };
          };
          // Composition du corpus 4 catégories (Règle 2).
          const corpusComposition = corpusStats
            ? {
                total: corpusStats.total,
                premierDegre: corpusStats.hierarchy.premierDegre.total,
                courAppel: corpusStats.hierarchy.courAppel.total,
                cassation: corpusStats.hierarchy.cassation.total,
                conseilEtat: 0,
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
              judilibre_corpus: corpus,
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
