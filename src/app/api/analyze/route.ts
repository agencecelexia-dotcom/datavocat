import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/claude/client";
import { DATAVOCAT_SYSTEM_PROMPT } from "@/lib/claude/analyze-prompt";
import { searchJudilibreForAnalysis } from "@/lib/judilibre/client";
import { searchJusticeDatasets } from "@/lib/datagouv/mcp-client";
import { trackClaudeUsage } from "@/lib/api-usage/track";

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

  // Search both sources in parallel with timeouts
  const emptyJudilibre = {
    context: "",
    analyzedCount: 0,
    totalFound: 0,
    oldestDate: null as string | null,
    freshestDate: null as string | null,
  };
  const [judilibreResult, datagouvContext] = await Promise.all([
    Promise.race([
      searchJudilibreForAnalysis(query, {
        userId: user.id,
        userEmail: user.email ?? null,
      }).catch(() => emptyJudilibre),
      new Promise<typeof emptyJudilibre>((resolve) =>
        setTimeout(() => resolve(emptyJudilibre), 18000)
      ),
    ]),
    Promise.race([
      searchJusticeDatasets(query).catch(() => ""),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000)),
    ]),
  ]);

  const judilibreContext = judilibreResult.context;
  const hasJudilibre =
    judilibreContext.includes("JUDILIBRE") &&
    judilibreContext.includes("decisions trouvees");
  const hasDatagouv = datagouvContext.length > 50;

  // Stream Claude analysis
  const anthropic = getAnthropicClient();

  let sourceBlock = "";
  if (hasJudilibre) sourceBlock += `\n${judilibreContext}\n`;
  if (hasDatagouv) sourceBlock += `\n${datagouvContext}\n`;

  const sourceInstruction = hasJudilibre
    ? `Des decisions Judilibre sont fournies ci-dessous (${judilibreResult.analyzedCount} decisions reelles verifiables sur ${judilibreResult.totalFound} trouvees au total). Analyse-les en priorite. Complete avec tes connaissances.`
    : "IMPORTANT : L'API Judilibre n'a pas retourne de resultats pour cette recherche. Tu DOIS quand meme fournir une analyse COMPLETE et DETAILLEE basee sur tes connaissances approfondies de la jurisprudence francaise. Tu connais des milliers d'arrets — mobilise-les. Cite les arrets de principe, les tendances, les statistiques documentees. Ne dis PAS que tu n'as pas de donnees — tu en as dans tes connaissances.";

  const userMessage = `DEMANDE DE L'AVOCAT :
${query}
${sourceBlock}
═══ INSTRUCTIONS ═══
${sourceInstruction}
Analyse cette demande en suivant la structure definie dans ton systeme prompt.
Fournis une analyse RICHE avec des statistiques, des decisions cles, et des points d'attention strategiques concrets (toujours au pluriel, formules comme des observations et non comme des conseils).
Cite les references les plus precises possibles (ECLI, numeros de pourvoi, dates).
IMPORTANT : cite un MAXIMUM de sources pertinentes. Analyse TOUTES les decisions Judilibre fournies ci-dessus et complete avec tes connaissances. Ne cite que des decisions reelles.

PRIORITE ABSOLUE — TABLEAU DE PREUVE STATISTIQUE :
Le tableau de preuve est la section LA PLUS IMPORTANTE. Il doit :
1. Contenir MINIMUM 25 decisions (vise 40-50)
2. Avoir MINIMUM 18 colonnes dont 12+ colonnes de FACTEURS JURIDIQUES DECISIFS
3. Chaque colonne = un facteur qui influence l'issue du litige (ex: "Procedure respectee", "Cause reelle et serieuse", "Indemnite", "Forclusion", etc.)
4. PAS de colonnes generiques inutiles — chaque colonne doit avoir une VALEUR JURIDIQUE DECISIVE
5. Le tableau doit EXPLIQUER et JUSTIFIER les statistiques avancees (pourquoi X% de succes)
6. Privilegier les decisions RECENTES (moins de 5 ans)
7. Ne JAMAIS fabriquer de fausses decisions
Sois EXHAUSTIF dans le tableau — c'est la preuve statistique pour l'avocat.

RAPPEL ABSOLU — ARTICLE 33 LOI n° 2019-222 :
- NE NOMME AUCUN magistrat, juge, president, rapporteur, conseiller.
- Si les sources Judilibre contiennent des noms, ils doivent etre remplaces par "[magistrat anonymise]" avant toute citation.
- Seules les juridictions (lieu, chambre, ressort) peuvent etre identifiees.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
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
        // Chaque ligne commence par "[STEP:" et finit par "]\n".
        controller.enqueue(
          encoder.encode(
            `[STEP:judilibre:done count=${judilibreResult.analyzedCount} total=${judilibreResult.totalFound}]\n`
          )
        );
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

        // Save completed response (sans les balises [STEP:])
        if (id) {
          await supabase
            .from("analyses")
            .update({ response: fullResponse, status: "done" })
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
            model: "claude-sonnet-4-20250514",
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
