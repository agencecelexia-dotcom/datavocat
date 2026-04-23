import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";
import { searchJudilibreForAnalysis } from "@/lib/judilibre/client";
import { getAuthContext } from "@/lib/supabase/auth-helper";

export const maxDuration = 60;

const COMPARATEUR_SYSTEM_PROMPT = `Tu es DATAVOCAT en mode comparaison de strategies juridiques.

L'avocat te presente deux strategies possibles pour la meme affaire. Tu dois analyser chacune et produire une comparaison structuree.

STRUCTURE TA REPONSE EXACTEMENT AINSI :

## Strategie A : [titre court]
### Taux de succes estime
[X% — base sur les decisions trouvees]
### Arguments principaux
[liste]
### Risques
[liste]
### Delais previsibles
[estimation]
### Montants previsibles
[fourchette]

## Strategie B : [titre court]
### Taux de succes estime
[X% — base sur les decisions trouvees]
### Arguments principaux
[liste]
### Risques
[liste]
### Delais previsibles
[estimation]
### Montants previsibles
[fourchette]

## Verdict comparatif
### Strategie recommandee
[A ou B, avec justification]
### Facteurs decisifs
[les 3 facteurs les plus importants]
### Scenario optimal
[recommandation combinant le meilleur des deux si possible]

REGLES :
- Base-toi sur les decisions Judilibre fournies en contexte
- JAMAIS inventer de references
- Vocabulaire juridique precis
- Cite les ECLI quand disponibles`;

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { context, strategyA, strategyB } = await request.json();

  if (!context || !strategyA || !strategyB) {
    return new Response(
      JSON.stringify({ error: "context, strategyA et strategyB sont requis" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Search Judilibre for BOTH strategies in parallel
  const [judilibreA, judilibreB] = await Promise.all([
    searchJudilibreForAnalysis(`${context} ${strategyA}`.slice(0, 300))
      .then((r) => r.context)
      .catch(() => "API Judilibre indisponible pour la strategie A."),
    searchJudilibreForAnalysis(`${context} ${strategyB}`.slice(0, 300))
      .then((r) => r.context)
      .catch(() => "API Judilibre indisponible pour la strategie B."),
  ]);

  const anthropic = getAnthropicClient();

  const userMessage = `CONTEXTE DE L'AFFAIRE :
${context}

STRATEGIE A :
${strategyA}

STRATEGIE B :
${strategyB}

═══ JURISPRUDENCE POUR LA STRATEGIE A ═══
${judilibreA}

═══ JURISPRUDENCE POUR LA STRATEGIE B ═══
${judilibreB}

═══ INSTRUCTIONS ═══
Compare ces deux strategies en suivant la structure definie dans ton systeme prompt.
Base-toi sur les decisions Judilibre ci-dessus et sur ta connaissance de la jurisprudence francaise.
Cite les references ECLI et numeros de pourvoi quand disponibles.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: COMPARATEUR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
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
        // Stream error — close gracefully
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
