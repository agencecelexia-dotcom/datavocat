import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";
import { requireApprovedUser } from "@/lib/supabase/require-user";
import { checkRateLimit } from "@/lib/api-usage/rate-limit";
import { trackClaudeUsage } from "@/lib/api-usage/track";

export const maxDuration = 30;

/** Taille max du contexte d'analyse accepté (le corpus formaté tient largement dedans). */
const MAX_CONTEXT_CHARS = 200_000;
/** Taille max cumulée des messages de la conversation. */
const MAX_MESSAGES_CHARS = 50_000;
/** Nombre max de messages dans l'historique de conversation. */
const MAX_MESSAGES = 40;

const CHAT_SYSTEM_PROMPT = (analysisContext: string) =>
  `Tu es DATAVOCAT en mode conversation de suivi. L'avocat a deja recu une analyse jurisprudentielle complete. Il pose maintenant des questions complementaires.

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
  // Auth AVANT tout appel au modèle : cette route relaie vers Anthropic et
  // était auparavant ouverte à Internet (proxy LLM gratuit sur notre clé).
  const auth = await requireApprovedUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const rate = await checkRateLimit(user.id, "chat");
  if (!rate.ok) return rate.response;

  const { messages, analysisContext } = await request.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (messages.length > MAX_MESSAGES) {
    return new Response(
      JSON.stringify({ error: "Conversation trop longue" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validation de forme : chaque message doit être {role, content} exploitable.
  const validMessages = messages.every(
    (m: unknown): m is { role: string; content: string } =>
      typeof m === "object" &&
      m !== null &&
      (("role" in m && (m.role === "user" || m.role === "assistant")) as boolean) &&
      "content" in m &&
      typeof (m as { content: unknown }).content === "string"
  );
  if (!validMessages) {
    return new Response(
      JSON.stringify({ error: "Format de messages invalide" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const totalChars = (messages as Array<{ content: string }>).reduce(
    (sum, m) => sum + m.content.length,
    0
  );
  if (totalChars > MAX_MESSAGES_CHARS) {
    return new Response(
      JSON.stringify({ error: "Conversation trop volumineuse" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
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

  if (analysisContext.length > MAX_CONTEXT_CHARS) {
    return new Response(
      JSON.stringify({ error: "Contexte d'analyse trop volumineux" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const anthropic = getAnthropicClient();

  // Haiku 4.5 par défaut — la tâche (reformuler/approfondir à partir d'un
  // contexte déjà fourni) n'exige pas Sonnet. Surchargable via env si besoin.
  const CHAT_MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001";

  const stream = await anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: CHAT_SYSTEM_PROMPT(analysisContext),
        cache_control: { type: "ephemeral" },
      },
    ],
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

        // Track API usage (fail-silent)
        try {
          const finalMessage = await stream.finalMessage();
          const usage = finalMessage.usage as typeof finalMessage.usage & {
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
          await trackClaudeUsage({
            userId: user.id,
            userEmail: user.email ?? null,
            model: CHAT_MODEL,
            operation: "chat",
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cacheWriteTokens: usage.cache_creation_input_tokens || 0,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
          });
        } catch {
          // silent
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
