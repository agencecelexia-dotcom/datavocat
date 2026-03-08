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

  // Search multiple sources in parallel with the full query (with 8s timeout each)
  const withTimeout = <T>(promise: Promise<T>, fallback: T, ms = 8000): Promise<T> =>
    Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

  const [datagouvrContext, judilibreContext] = await Promise.all([
    withTimeout(
      searchCourtDecisions(query).catch(() => ""),
      "",
    ),
    withTimeout(
      searchJudilibreForAnalysis(query).catch(() => ""),
      "",
    ),
  ]);

  // Determine source availability for dynamic instructions
  const hasJudilibre = judilibreContext.includes("JUDILIBRE") && judilibreContext.includes("decisions trouvees");
  const hasDatagouv = datagouvrContext.length > 50 && !datagouvrContext.includes("Aucun jeu");

  // Stream Claude analysis
  const anthropic = getAnthropicClient();

  let sourceBlock = "";
  if (hasJudilibre) {
    sourceBlock += `\n${judilibreContext}\n`;
  }
  if (hasDatagouv) {
    sourceBlock += `\n═══ DONNEES DATA.GOUV.FR ═══\n${datagouvrContext}\n`;
  }

  const sourceInstruction = hasJudilibre
    ? "Des decisions Judilibre sont fournies ci-dessous — analyse-les en priorite (ce sont des decisions reelles verifiables). Complete avec tes connaissances."
    : "IMPORTANT : L'API Judilibre n'a pas retourne de resultats pour cette recherche. Tu DOIS quand meme fournir une analyse COMPLETE et DETAILLEE basee sur tes connaissances approfondies de la jurisprudence francaise. Tu connais des milliers d'arrets — mobilise-les. Cite les arrets de principe, les tendances, les statistiques documentees. Ne dis PAS que tu n'as pas de donnees — tu en as dans tes connaissances.";

  const userMessage = `DEMANDE DE L'AVOCAT :
${query}
${sourceBlock}
═══ INSTRUCTIONS ═══
${sourceInstruction}
Analyse cette demande en suivant la structure definie dans ton systeme prompt.
Fournis une analyse RICHE avec des statistiques, des decisions cles, et des recommandations strategiques concretes.
Cite les references les plus precises possibles (ECLI, numeros de pourvoi, dates).`;

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
