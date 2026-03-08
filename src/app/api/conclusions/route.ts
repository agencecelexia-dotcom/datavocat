import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/claude/client";
import { searchJudilibreForAnalysis } from "@/lib/judilibre/client";
import { getAuthContext } from "@/lib/supabase/auth-helper";

export const maxDuration = 60;

const CONCLUSIONS_SYSTEM_PROMPT = `Tu es DATAVOCAT en mode generation de conclusions juridiques.

Genere un projet de conclusions juridiques au format standard francais pour le tribunal indique.

FORMAT OBLIGATOIRE :

CONCLUSIONS [EN DEMANDE/EN DEFENSE/EN APPEL]

POUR : [client] ([qualite])
CONTRE : [adversaire]

DEVANT LE [juridiction]

Affaire n° RG : [A COMPLETER]

PLAISE AU [TRIBUNAL/CONSEIL/COUR]

I. RAPPEL DES FAITS ET DE LA PROCEDURE
[recit chronologique des faits]

II. DISCUSSION
A) [Premier argument juridique]
[Developpement avec visa des textes applicables, jurisprudence citee avec ECLI quand disponible]

B) [Deuxieme argument]
[...]

III. PAR CES MOTIFS

Il est demande au [Tribunal/Conseil/Cour] de bien vouloir :
[liste des demandes formatees juridiquement]

[Ville], le [date]

Pour [client],
Son conseil

REGLES :
- Format juridique francais strict
- Viser les articles de loi pertinents
- Citer la jurisprudence avec references ECLI si fournies
- Style formel et professionnel
- JAMAIS inventer de references`;

function getQualiteLabel(qualite: string): string {
  const map: Record<string, string> = {
    demandeur: "EN DEMANDE",
    defendeur: "EN DEFENSE",
    appelant: "EN APPEL",
    intime: "EN REPONSE",
    requerant: "EN DEMANDE",
  };
  return map[qualite] || "EN DEMANDE";
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { juridiction, qualite, client, adversaire, faits, arguments: args, demandes } =
    await request.json();

  if (!juridiction || !qualite || !client || !adversaire || !faits || !demandes) {
    return new Response(
      JSON.stringify({ error: "Tous les champs obligatoires doivent être remplis" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Search Judilibre for relevant case law based on the arguments
  const searchQuery = `${faits} ${args || ""}`.slice(0, 300);
  const judilibreContext = await searchJudilibreForAnalysis(searchQuery).catch(
    () => "API Judilibre indisponible."
  );

  const anthropic = getAnthropicClient();

  const qualiteLabel = getQualiteLabel(qualite);

  const userMessage = `PARAMETRES DES CONCLUSIONS :
- Juridiction : ${juridiction}
- Type de conclusions : ${qualiteLabel}
- Qualite : ${qualite}
- Client : ${client}
- Adversaire : ${adversaire}

FAITS :
${faits}

ARGUMENTS PRINCIPAUX :
${args || "A developper a partir des faits"}

DEMANDES :
${demandes}

═══ JURISPRUDENCE PERTINENTE ═══
${judilibreContext}

═══ INSTRUCTIONS ═══
Génère les conclusions juridiques complètes en suivant le format obligatoire defini dans ton systeme prompt.
Utilise la jurisprudence Judilibre ci-dessus pour appuyer les arguments.
Cite les references ECLI et les articles de loi pertinents.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 10000,
    system: CONCLUSIONS_SYSTEM_PROMPT,
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
