import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-helper";
import type { ParsedAnalysis } from "@/lib/parse-analysis";
import ExcelJS from "exceljs";

export const maxDuration = 60;

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;

// ─── Palette ──────────────────────────────────────────────────────
const HEADER_FILL = "FF0B1220"; // ink
const HEADER_TEXT = "FFFFFFFF";
const ACCENT_FILL = "FFB88A3E"; // gold
const ALT_ROW_FILL = "FFFAF8F2";
const FAVORABLE = "FF2D6A4F";
const DEFAVORABLE = "FF9B2226";
const NUANCE = "FFCA6702";

function pertinenceColor(value: string): string {
  const v = (value || "").toLowerCase();
  if (v.includes("favorable") && !v.includes("defavorable") && !v.includes("défavorable"))
    return FAVORABLE;
  if (v.includes("defavorable") || v.includes("défavorable")) return DEFAVORABLE;
  if (v.includes("nuanc")) return NUANCE;
  return "FF6B7280";
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
    const body = await request.json();
    const query: string = body.query || "";
    const response: string = body.response || "";
    const parsed = body.parsed as ParsedAnalysis | null | undefined;

    if (!response || typeof response !== "string") {
      return new Response(JSON.stringify({ error: "response requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (response.length > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: "Analyse trop volumineuse pour l'export Excel." }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Datavocat";
    wb.created = new Date();
    wb.title = "Analyse jurisprudentielle";

    // ─── Feuille 1 : Synthèse ───────────────────────────────────
    const synthese = wb.addWorksheet("Synthèse", {
      views: [{ showGridLines: false }],
      properties: { defaultColWidth: 22 },
    });

    synthese.columns = [{ width: 28 }, { width: 60 }];

    const titleRow = synthese.addRow(["DATAVOCAT — Analyse jurisprudentielle"]);
    synthese.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
    titleRow.font = {
      name: "Calibri",
      size: 18,
      bold: true,
      color: { argb: HEADER_FILL },
    };
    titleRow.height = 32;

    const dateStr = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const dateRow = synthese.addRow([dateStr]);
    synthese.mergeCells(`A${dateRow.number}:B${dateRow.number}`);
    dateRow.font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };

    synthese.addRow([]);

    // Demande
    const demandeHeader = synthese.addRow(["DEMANDE"]);
    demandeHeader.font = { bold: true, color: { argb: ACCENT_FILL }, size: 9 };
    const demandeRow = synthese.addRow([query || ""]);
    synthese.mergeCells(`A${demandeRow.number}:B${demandeRow.number}`);
    demandeRow.alignment = { wrapText: true, vertical: "top" };
    demandeRow.font = { italic: true, size: 11 };
    demandeRow.height = Math.min(120, Math.max(30, query.length / 4));

    synthese.addRow([]);

    // Stats
    if (parsed) {
      const statsHeader = synthese.addRow(["INDICATEURS CLÉS"]);
      statsHeader.font = { bold: true, color: { argb: ACCENT_FILL }, size: 9 };

      const addStat = (label: string, value: string | number | null) => {
        if (value === null || value === undefined || value === "") return;
        const r = synthese.addRow([label, String(value)]);
        r.getCell(1).font = { bold: true };
        r.getCell(2).font = { color: { argb: HEADER_FILL } };
      };

      const margeTxt =
        parsed.verification?.tauxSuccesMarge != null
          ? ` ± ${parsed.verification.tauxSuccesMarge} pts`
          : "";
      const nTxt =
        parsed.verification?.tauxSuccesN != null
          ? ` (n = ${parsed.verification.tauxSuccesN})`
          : "";
      addStat(
        "Issues favorables dans le corpus",
        parsed.tauxSuccesGlobal != null
          ? `${parsed.tauxSuccesGlobal}%${margeTxt}${nTxt}`
          : null
      );
      addStat(
        "Portée de ce chiffre",
        parsed.tauxSuccesGlobal != null
          ? "Tendance observée sur ce corpus — PAS une probabilité de succès. Corpus non aléatoire ; la source n'indique pas quelle partie a formé le recours."
          : null
      );
      addStat("Indice de fiabilité", `${parsed.fiabilite.score}/100 — ${parsed.fiabilite.label}`);
      addStat("Niveau de confiance", parsed.confiance);
      addStat("Sources citées", parsed.sourceCount);
      addStat("Décisions tableau", parsed.evidenceTable?.rows.length ?? null);
      if (parsed.article700?.montantMoyen) {
        addStat("Article 700 — moyen", `${parsed.article700.montantMoyen} €`);
      }
      if (parsed.montants.median != null) {
        addStat("Indemnité médiane", `${parsed.montants.median} €`);
      }

      synthese.addRow([]);

      // Facteurs de fiabilité
      if (parsed.fiabilite.factors.length > 0) {
        const fiabHeader = synthese.addRow(["FIABILITÉ — DÉTAIL"]);
        fiabHeader.font = { bold: true, color: { argb: ACCENT_FILL }, size: 9 };
        for (const f of parsed.fiabilite.factors) {
          const r = synthese.addRow([
            f.name,
            `${f.score >= 0 ? "+" : ""}${f.score}${f.maxScore > 0 ? `/${f.maxScore}` : " (pénalité)"} — ${f.description}`,
          ]);
          r.getCell(1).font = { bold: true };
          r.getCell(2).alignment = { wrapText: true, vertical: "top" };
          r.getCell(2).font = {
            color: {
              argb:
                f.impact === "positive"
                  ? FAVORABLE
                  : f.impact === "negative"
                    ? DEFAVORABLE
                    : ACCENT_FILL,
            },
          };
          r.height = 22;
        }
      }
    }

    // ─── Feuille 2 : Tableau de preuve (TOUTES les colonnes) ────
    if (parsed?.evidenceTable && parsed.evidenceTable.rows.length > 0) {
      const evidence = wb.addWorksheet("Tableau de preuve", {
        views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
      });

      const headers = parsed.evidenceTable.headers;
      const headerRow = evidence.addRow(headers);
      headerRow.font = {
        bold: true,
        color: { argb: HEADER_TEXT },
        name: "Calibri",
        size: 10,
      };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      headerRow.height = 32;
      headerRow.eachCell((cell) => {
        cell.border = {
          bottom: { style: "medium", color: { argb: ACCENT_FILL } },
        };
      });

      // Largeurs auto
      evidence.columns = headers.map((h) => ({
        header: h,
        width: Math.max(12, Math.min(40, h.length + 4)),
      }));

      parsed.evidenceTable.rows.forEach((row, i) => {
        const values = headers.map((h) => row[h] || "");
        const r = evidence.addRow(values);
        if (i % 2 === 1) {
          r.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ALT_ROW_FILL },
          };
        }
        r.alignment = { vertical: "top", wrapText: true };
        r.font = { size: 10 };
        // Coloration de la colonne Pertinence
        headers.forEach((h, ci) => {
          const cell = r.getCell(ci + 1);
          if (h.toLowerCase().includes("pertinence")) {
            cell.font = {
              size: 10,
              bold: true,
              color: { argb: pertinenceColor(row[h] || "") },
            };
          }
        });
      });

      // Synthèse en bas
      evidence.addRow([]);
      const sRow = evidence.addRow([
        `Synthèse : ${parsed.evidenceTable.synthese || ""}`,
      ]);
      evidence.mergeCells(`A${sRow.number}:${String.fromCharCode(64 + headers.length)}${sRow.number}`);
      sRow.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
      sRow.alignment = { wrapText: true };
    }

    // ─── Feuille 3 : Sources citées ─────────────────────────────
    const detailed = parsed?.detailedSources || [];
    if (detailed.length > 0) {
      const sources = wb.addWorksheet("Sources citées", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      const sHeaders = [
        "N°",
        "Référence",
        "Juridiction",
        "Chambre",
        "Date",
        "Solution",
        "Pertinence",
        "Source",
        "URL",
        "Apport pour le dossier",
      ];

      const headerRow = sources.addRow(sHeaders);
      headerRow.font = {
        bold: true,
        color: { argb: HEADER_TEXT },
        size: 10,
      };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL },
      };
      headerRow.height = 28;
      headerRow.alignment = { vertical: "middle", wrapText: true };

      sources.columns = [
        { width: 6 },
        { width: 38 },
        { width: 16 },
        { width: 18 },
        { width: 12 },
        { width: 22 },
        { width: 14 },
        { width: 14 },
        { width: 36 },
        { width: 50 },
      ];

      detailed.forEach((d, i) => {
        const r = sources.addRow([
          i + 1,
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
        if (i % 2 === 1) {
          r.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ALT_ROW_FILL },
          };
        }
        r.alignment = { vertical: "top", wrapText: true };
        r.font = { size: 10 };

        // Pertinence colorée
        r.getCell(7).font = {
          size: 10,
          bold: true,
          color: { argb: pertinenceColor(d.pertinence || "") },
        };
        // URL en lien hypertexte
        if (d.url) {
          r.getCell(9).value = { text: d.url, hyperlink: d.url };
          r.getCell(9).font = {
            size: 10,
            color: { argb: ACCENT_FILL },
            underline: true,
          };
        }
      });
    }

    const buffer = await wb.xlsx.writeBuffer();

    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="datavocat-analyse.xlsx"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("XLSX export failed", err);
    return new Response(
      JSON.stringify({ error: `Échec de la génération Excel : ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
