import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/claude/client";
import { DATAVOCAT_SYSTEM_PROMPT } from "@/lib/claude/analyze-prompt";
import { searchCourtDecisions } from "@/lib/datagouv/client";
import { searchJudilibreForAnalysis } from "@/lib/judilibre/client";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { query, analysisId } = await request.json();

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createAdminClient();

  // Create or update analysis record
  let id = analysisId;
  if (!id) {
    const { data } = await supabase
      .from("analyses")
      .insert({ query, status: "streaming" })
      .select("id")
      .single();
    id = data?.id;
  } else {
    await supabase
      .from("analyses")
      .update({ status: "streaming" })
      .eq("id", id);
  }

  // Search multiple sources in parallel
  const searchTerms = query.slice(0, 300);

  const [datagouvrContext, judilibreContext] = await Promise.all([
    searchCourtDecisions(searchTerms).catch(
      () => "Recherche data.gouv.fr indisponible."
    ),
    searchJudilibreForAnalysis(searchTerms).catch(
      () => "API Judilibre indisponible."
    ),
  ]);

  // Stream Claude analysis
  const anthropic = getAnthropicClient();

  const userMessage = `DEMANDE DE L'AVOCAT :
${query}

${judilibreContext}

═══ DONNEES DATA.GOUV.FR ═══
${datagouvrContext}

═══ INSTRUCTIONS ═══
Analyse cette demande en suivant la structure definie dans ton systeme prompt.
Base-toi sur les decisions Judilibre ci-dessus (source prioritaire, ce sont de vraies decisions) ET sur les donnees data.gouv.fr ET sur ta connaissance de la jurisprudence francaise.
Si les donnees sont insuffisantes, complete avec tes connaissances en le signalant explicitement dans les limites.
Cite les references ECLI et numeros de pourvoi quand disponibles.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 12000,
    system: DATAVOCAT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
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

        // Save completed response
        if (id) {
          await supabase
            .from("analyses")
            .update({ response: fullResponse, status: "done" })
            .eq("id", id);
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
    },
  });
}
