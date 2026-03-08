import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";

export const maxDuration = 30;

const CHAT_SYSTEM_PROMPT = (analysisContext: string) =>
  `Tu es DATAVOCAT en mode conversation de suivi. L'avocat a deja recu une analyse jurimetrique complete. Il pose maintenant des questions complementaires.

CONTEXTE DE L'ANALYSE PRECEDENTE :
${analysisContext}

REGLES :
- Reponds de maniere concise et directe (pas besoin de reproduire la structure complete)
- Tu peux approfondir un argument, une juridiction, un montant specifique
- Tu peux comparer des scenarios ("et si mon client avait plutot...")
- Cite les references ECLI quand pertinent
- Si la question sort du cadre de l'analyse initiale, dis-le et propose de lancer une nouvelle analyse
- Vocabulaire juridique precis — tu parles a un professionnel du droit
- JAMAIS inventer de references ou de statistiques`;

export async function POST(request: NextRequest) {
  const { messages, analysisContext } = await request.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!analysisContext || typeof analysisContext !== "string") {
    return new Response(
      JSON.stringify({ error: "analysisContext requis" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const anthropic = getAnthropicClient();

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: CHAT_SYSTEM_PROMPT(analysisContext),
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        // Stream error — client will see incomplete response
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
