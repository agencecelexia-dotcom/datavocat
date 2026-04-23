import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-helper";
import type { ParsedAnalysis } from "@/lib/parse-analysis";

export const maxDuration = 30;

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { query, response, parsed, analysisId } = await request.json();

    if (!response || typeof response !== "string") {
      return new Response(JSON.stringify({ error: "response requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (response.length > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: "Analyse trop volumineuse pour l'export JSON." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsedTyped = parsed as ParsedAnalysis | null | undefined;

    const payload = {
      metadata: {
        analysisId: analysisId || null,
        exportedAt: new Date().toISOString(),
        version: "1.0",
        generator: "Datavocat",
      },
      query: query || "",
      summary: {
        tauxSuccesGlobal: parsedTyped?.tauxSuccesGlobal ?? null,
        echantillon: parsedTyped?.echantillon ?? null,
        confiance: parsedTyped?.confiance ?? null,
        sourceCount: parsedTyped?.sourceCount ?? 0,
      },
      fiabilite: parsedTyped?.fiabilite ?? null,
      arguments: parsedTyped?.arguments ?? [],
      juridictions: parsedTyped?.juridictions ?? [],
      instances: parsedTyped?.instances ?? [],
      montants: parsedTyped?.montants ?? null,
      article700: parsedTyped?.article700 ?? null,
      sources: parsedTyped?.sources ?? [],
      detailedSources: parsedTyped?.detailedSources ?? [],
      evidenceTable: parsedTyped?.evidenceTable ?? null,
      rapportMarkdown: response,
    };

    const json = JSON.stringify(payload, null, 2);
    const encoded = new TextEncoder().encode(json);

    return new Response(encoded.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="datavocat-analyse.json"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("JSON export failed", err);
    return new Response(
      JSON.stringify({ error: `Échec de la génération JSON : ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
