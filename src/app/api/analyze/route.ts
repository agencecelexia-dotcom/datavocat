import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient } from "@/lib/claude/client";
import { DATAVOCAT_SYSTEM_PROMPT } from "@/lib/claude/analyze-prompt";
import { searchJudilibreForAnalysis } from "@/lib/judilibre/client";
import { searchJusticeDatasets } from "@/lib/datagouv/mcp-client";

export const maxDuration = 60;

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
  const [judilibreContext, datagouvContext] = await Promise.all([
    Promise.race([
      searchJudilibreForAnalysis(query).catch(() => ""),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 12000)),
    ]),
    Promise.race([
      searchJusticeDatasets(query).catch(() => ""),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000)),
    ]),
  ]);

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
    ? `Des decisions Judilibre sont fournies ci-dessous (${judilibreContext.split("---").length - 1} decisions reelles verifiables). Analyse-les en priorite. Complete avec tes connaissances.`
    : "IMPORTANT : L'API Judilibre n'a pas retourne de resultats pour cette recherche. Tu DOIS quand meme fournir une analyse COMPLETE et DETAILLEE basee sur tes connaissances approfondies de la jurisprudence francaise. Tu connais des milliers d'arrets — mobilise-les. Cite les arrets de principe, les tendances, les statistiques documentees. Ne dis PAS que tu n'as pas de donnees — tu en as dans tes connaissances.";

  const userMessage = `DEMANDE DE L'AVOCAT :
${query}
${sourceBlock}
═══ INSTRUCTIONS ═══
${sourceInstruction}
Analyse cette demande en suivant la structure definie dans ton systeme prompt.
Fournis une analyse RICHE avec des statistiques, des decisions cles, et des recommandations strategiques concretes (toujours au pluriel).
Cite les references les plus precises possibles (ECLI, numeros de pourvoi, dates).
IMPORTANT : cite un MAXIMUM de sources pertinentes. Analyse TOUTES les decisions Judilibre fournies ci-dessus et complete avec tes connaissances. Ne cite que des decisions reelles.
TABLEAU DE PREUVE STATISTIQUE : C'est la piece maitresse. Le tableau doit contenir un MINIMUM de 15 decisions (vise 20-30) et MINIMUM 18 colonnes dont 12+ colonnes de FACTEURS JURIDIQUES DECISIFS propres au contentieux (PAS de simple metadata). Chaque colonne = un facteur qui influence l'issue du litige. Privilegie les decisions RECENTES (moins de 5 ans). Ne fabrique JAMAIS de fausses decisions.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 32000,
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
