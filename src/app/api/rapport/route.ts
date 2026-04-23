import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";
import { buildRapportPrompt } from "@/lib/claude/rapport-prompt";
import { getAuthContext } from "@/lib/supabase/auth-helper";
import { trackClaudeUsage } from "@/lib/api-usage/track";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }


  const body = await request.json();
  const { stats, parametres } = body;

  if (!stats || !parametres) {
    return NextResponse.json(
      { error: "stats et paramètres requis" },
      { status: 400 }
    );
  }

  const prompt = buildRapportPrompt({
    ...stats,
    parametres,
  });

  const anthropic = getAnthropicClient();

  // Use streaming for better UX
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Return as a streaming response
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      // Track usage (fail-silent)
      try {
        const finalMessage = await stream.finalMessage();
        await trackClaudeUsage({
          userId: auth.userId,
          userEmail: null,
          model: "claude-sonnet-4-20250514",
          operation: "rapport",
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        });
      } catch {
        // silent
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
