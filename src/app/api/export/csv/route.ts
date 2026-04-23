import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-helper";
import type { ParsedAnalysis, DetailedSource } from "@/lib/parse-analysis";

export const maxDuration = 30;

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;

function escapeCSV(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(parsed: ParsedAnalysis | null | undefined): string {
  const headers = [
    "N°",
    "Référence",
    "Juridiction",
    "Chambre",
    "Date",
    "Solution",
    "Pertinence",
    "Source",
    "URL",
    "Apport",
  ];

  const rows: string[][] = [];

  const detailed: DetailedSource[] = parsed?.detailedSources || [];
  if (detailed.length > 0) {
    detailed.forEach((d, i) => {
      rows.push([
        String(i + 1),
        d.reference || "",
        d.juridiction || "",
        d.chambre || "",
        d.date || "",
        d.solution || "",
        d.pertinence || "",
        d.source || "",
        d.url || "",
        d.apport || "",
      ]);
    });
  } else if (parsed?.sources) {
    parsed.sources.forEach((s, i) => {
      rows.push([
        String(i + 1),
        s.reference || "",
        "",
        s.chamber || "",
        s.date || "",
        s.solution || "",
        "",
        "",
        s.url || "",
        "",
      ]);
    });
  }

  const lines = [headers, ...rows].map((row) => row.map(escapeCSV).join(","));
  // BOM UTF-8 pour qu'Excel ouvre correctement les accents français
  return "﻿" + lines.join("\r\n");
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { response, parsed } = await request.json();

    if (!response || typeof response !== "string") {
      return new Response(JSON.stringify({ error: "response requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (response.length > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: "Analyse trop volumineuse pour l'export CSV." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const csv = buildCsv(parsed as ParsedAnalysis | null | undefined);
    const encoded = new TextEncoder().encode(csv);

    return new Response(encoded.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="datavocat-tableau-preuve.csv"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("CSV export failed", err);
    return new Response(
      JSON.stringify({ error: `Échec de la génération CSV : ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
