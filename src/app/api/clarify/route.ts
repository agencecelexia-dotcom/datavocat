import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";

export const maxDuration = 30;

const CLARIFY_PROMPT = `Tu es DATAVOCAT, assistant jurimétrique pour avocats français.

Un avocat vient de décrire une situation. Ton rôle est de poser entre 3 et 5 questions CIBLÉES pour affiner l'analyse jurimétrique.

OBJECTIF : obtenir les informations manquantes qui impactent directement les statistiques et la stratégie.

INTERDICTION LÉGALE (article 33 loi n° 2019-222) :
- NE JAMAIS poser de question portant sur un juge, un magistrat, un rapporteur, un président ou un conseiller nommément.
- La localisation reste autorisée : juridiction, chambre, ressort géographique, région, cour d'appel.
- Exemples interdits : "Connaissez-vous le juge qui siégera ?", "Avez-vous une préférence pour un magistrat ?"
- Exemples autorisés : "CPH de Paris, Lyon ou Marseille ?", "Chambre sociale ou commerciale ?"

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
- Pour les questions à choix, le champ "multiSelect" indique si l'avocat peut cocher plusieurs options :
  * multiSelect = true pour les questions où plusieurs réponses sont plausibles (ex: arguments juridiques envisagés, textes applicables, types de demandes)
  * multiSelect = false pour les questions exclusives (ex: instance saisie, type de procédure unique)
- Ne pose PAS de questions dont la réponse est déjà dans la demande initiale
- Chaque question doit avoir un impact concret sur l'analyse statistique

RÉPONDS EN JSON STRICT :
{
  "questions": [
    {
      "id": "q1",
      "question": "La question ici ?",
      "type": "text" | "choice",
      "multiSelect": true | false, // obligatoire si type=choice, sinon omettre
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
