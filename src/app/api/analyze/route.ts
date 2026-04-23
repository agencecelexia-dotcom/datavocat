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

  // Les règles générales (tableau de preuve, article 33, structure, style)
  // sont dans le system prompt caché. On garde uniquement le dynamique ici :
  // query utilisateur + bloc Judilibre + signal de disponibilité des sources.
  const sourceInstruction = hasJudilibre
    ? `Des decisions Judilibre sont fournies ci-dessous (${judilibreResult.analyzedCount} decisions reelles verifiables sur ${judilibreResult.totalFound} trouvees au total). Analyse-les en priorite, complete avec tes connaissances.`
    : "Aucune decision Judilibre disponible pour cette recherche. Fournis une analyse complete basee sur tes connaissances de la jurisprudence francaise (arrets de principe, tendances, statistiques documentees).";

  const userMessage = `DEMANDE DE L'AVOCAT :
${query}
${sourceBlock}
${sourceInstruction}`;

  // TEST TEMPORAIRE — Haiku 4.5 sur analyze pour évaluation qualité/coût.
  // À rebasculer sur "claude-sonnet-4-20250514" après les 3 tests.
  const ANALYZE_MODEL =
    process.env.ANALYZE_MODEL || "claude-haiku-4-5-20251001";

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
