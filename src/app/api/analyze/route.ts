import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/claude/client";
import { DATAVOCAT_SYSTEM_PROMPT } from "@/lib/claude/analyze-prompt";
import { searchCourtDecisions } from "@/lib/datagouv/client";

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

  // Step 1: Search data.gouv.fr for relevant datasets
  let datagouvrContext = "";
  try {
    // Extract key legal terms for search
    const searchTerms = query.slice(0, 200);
    datagouvrContext = await searchCourtDecisions(searchTerms);
  } catch {
    datagouvrContext = "Recherche data.gouv.fr indisponible.";
  }

  // Step 2: Stream Claude analysis
  const anthropic = getAnthropicClient();

  const userMessage = `DEMANDE DE L'AVOCAT :
${query}

═══ DONNÉES DATA.GOUV.FR ═══
Voici les jeux de données de décisions de justice trouvés sur data.gouv.fr en rapport avec cette demande :

${datagouvrContext}

═══ INSTRUCTIONS ═══
Analyse cette demande en suivant la structure définie dans ton système prompt.
Base-toi sur les données data.gouv.fr ci-dessus ET sur ta connaissance de la jurisprudence française pour produire une analyse jurimétrique complète.
Si les données data.gouv.fr sont insuffisantes, complète avec tes connaissances en le signalant explicitement dans les limites.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
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
            .update({ status: "error", response: fullResponse || String(err) })
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
