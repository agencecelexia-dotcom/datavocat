import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";

export const maxDuration = 30;

const CLARIFY_PROMPT = `Tu es DATAVOCAT, assistant jurimétrique pour avocats français.

Un avocat vient de décrire une situation. Ton rôle est de poser entre 3 et 5 questions CIBLÉES pour affiner l'analyse jurimétrique.

OBJECTIF : obtenir les informations manquantes qui impactent directement les statistiques et la stratégie.

QUESTIONS À PRIORISER (selon le contexte) :
- Juridiction / ressort géographique
- Type de demandeur (salarié, syndicat, employeur, etc.)
- Arguments juridiques envisagés
- Montants en jeu / enjeu financier
- Délais (prescription, ancienneté, durée du contrat)
- Instance (1ère instance, appel, cassation)
- Textes de loi ou conventions collectives applicables
- Date des faits (impact sur les textes applicables)

RÈGLES :
- Maximum 5 questions
- Chaque question doit être courte et précise
- Propose des choix quand c'est pertinent (ex: "CPH / TJ / Cour d'appel ?")
- Ne pose PAS de questions dont la réponse est déjà dans la demande initiale
- Chaque question doit avoir un impact concret sur l'analyse statistique

RÉPONDS EN JSON STRICT :
{
  "questions": [
    {
      "id": "q1",
      "question": "La question ici ?",
      "type": "text" | "choice",
      "choices": ["choix1", "choix2"] // seulement si type=choice
    }
  ]
}`;

export async function POST(request: NextRequest) {
  const { query } = await request.json();

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: CLARIFY_PROMPT,
    messages: [
      {
        role: "user",
        content: `DEMANDE DE L'AVOCAT :\n${query}`,
      },
    ],
  });

  // Extract text content
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => {
      if (b.type === "text") return b.text;
      return "";
    })
    .join("");

  // Parse JSON from response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ questions: [] }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}
