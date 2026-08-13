import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-helper";
import type { ParsedAnalysis } from "@/lib/parse-analysis";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableCell,
  TableRow,
  Table,
  WidthType,
  ShadingType,
} from "docx";

export const maxDuration = 30;

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 Mo

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  let query: string;
  let response: string;
  let parsed: ParsedAnalysis | null | undefined;
  try {
    const body = await request.json();
    query = body.query;
    response = body.response;
    parsed = body.parsed;
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalide" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!response || typeof response !== "string") {
    return new Response(JSON.stringify({ error: "response requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (response.length > MAX_PAYLOAD_SIZE) {
    return new Response(
      JSON.stringify({ error: "L'analyse est trop volumineuse pour être exportée en DOCX." }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
  const children: (Paragraph | Table)[] = [];

  // Cover page
  children.push(
    new Paragraph({ spacing: { after: 600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "DATAVOCAT",
          bold: true,
          size: 56,
          color: "1e3a5f",
          font: "Georgia",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "Analyse Jurisprudentielle",
          size: 36,
          color: "c9a96e",
          font: "Georgia",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: new Date().toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          size: 22,
          color: "6b7280",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "e5e2db" },
      },
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({
          text: "Confidentiel",
          italics: true,
          size: 20,
          color: "6b7280",
        }),
      ],
    })
  );

  // Query section
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({
          text: "Demande",
          bold: true,
          size: 32,
          color: "1e3a5f",
          font: "Georgia",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      shading: { type: ShadingType.CLEAR, fill: "f5f3ef" },
      children: [
        new TextRun({
          text: query || "",
          size: 22,
        }),
      ],
    })
  );

  // Stats summary if available
  if (parsed) {
    if (parsed.tauxSuccesGlobal !== null || parsed.echantillon !== null) {
      const statsRows: TableRow[] = [];

      if (parsed.tauxSuccesGlobal !== null) {
        statsRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text:
                          parsed.verification?.tauxSuccesSource === "cassation"
                            ? "Arrets ayant casse, dans ce corpus"
                            : "Issues favorables au demandeur, dans ce corpus",
                        bold: true,
                        size: 22,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${parsed.tauxSuccesGlobal}%${
                          parsed.verification?.tauxSuccesMarge != null
                            ? ` ± ${parsed.verification.tauxSuccesMarge} pts`
                            : ""
                        }${
                          parsed.verification?.tauxSuccesN != null
                            ? ` (n = ${parsed.verification.tauxSuccesN})`
                            : ""
                        }`,
                        bold: true,
                        size: 28,
                        color: "1e3a5f",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      }

      if (parsed.echantillon !== null) {
        statsRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Decisions analysees",
                        bold: true,
                        size: 22,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: String(parsed.echantillon),
                        size: 22,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
        );
      }

      if (statsRows.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: "Synthese",
                bold: true,
                size: 32,
                color: "1e3a5f",
                font: "Georgia",
              }),
            ],
          }),
          new Table({
            rows: statsRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        // Réserve méthodologique : ce document peut être remis à un client,
        // le chiffre ne doit jamais y circuler sans son cadrage.
        if (parsed.tauxSuccesGlobal !== null) {
          children.push(
            new Paragraph({
              spacing: { before: 200, after: 200 },
              children: [
                new TextRun({
                  text:
                    "Ce pourcentage decrit les decisions reunies pour cette analyse : il ne constitue pas une probabilite de succes pour le dossier examine. Le corpus n'est pas un echantillon aleatoire (decisions les plus proches, par leur texte, de la demande formulee) et la base Judilibre n'indique pas quelle partie a exerce le recours — une infirmation ne signifie donc pas que le demandeur initial l'a emporte.",
                  italics: true,
                  size: 18,
                  color: "6b6658",
                }),
              ],
            })
          );
        }
      }
    }
  }

  // Full analysis text
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({
          text: "Analyse Complete",
          bold: true,
          size: 32,
          color: "1e3a5f",
          font: "Georgia",
        }),
      ],
    })
  );

  // Parse markdown sections from response — avec détection des tableaux
  const lines = response.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Détection de tableau Markdown : |...| puis séparateur |---|---|
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const next = (lines[i + 1] || "").trim();
      const isSeparator = /^\|[\s:\-|]+\|$/.test(next);
      if (isSeparator) {
        const headers = trimmed
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length) {
          const l = lines[i].trim();
          if (!l.startsWith("|") || !l.endsWith("|")) break;
          rows.push(
            l
              .slice(1, -1)
              .split("|")
              .map((c) => c.trim())
          );
          i++;
        }
        children.push(buildWordTable(headers, rows));
        children.push(new Paragraph({ spacing: { after: 160 } }));
        continue;
      }
    }

    if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
          children: [
            new TextRun({
              text: line.replace(/^## /, ""),
              bold: true,
              size: 28,
              color: "1e3a5f",
              font: "Georgia",
            }),
          ],
        })
      );
    } else if (line.startsWith("### ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: line.replace(/^### /, ""),
              bold: true,
              size: 24,
            }),
          ],
        })
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: parseInlineFormatting(line.replace(/^[-*] /, "")),
        })
      );
    } else if (line.trim()) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: parseInlineFormatting(line),
        })
      );
    }
    i++;
  }

  // Footer
  children.push(
    new Paragraph({ spacing: { before: 600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "e5e2db" },
      },
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: "Genere par Datavocat — Analyse jurisprudentielle assistee par IA",
          italics: true,
          size: 18,
          color: "6b7280",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Ce document est un outil d'aide a la decision strategique, pas une consultation juridique.",
          italics: true,
          size: 16,
          color: "9ca3af",
        }),
      ],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22,
            color: "1a1a2e",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    return new Response(uint8.buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="datavocat-analyse.docx"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("DOCX export failed", err);
    return new Response(
      JSON.stringify({ error: `Échec de la génération DOCX : ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function buildWordTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: "f6f4ef" },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: h, bold: true, size: 18, font: "Calibri" }),
              ],
            }),
          ],
        })
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: parseTableCellRuns(cell),
                }),
              ],
            })
        ),
      })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function parseTableCellRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size: 16,
          font: "Calibri",
        })
      );
    } else {
      runs.push(new TextRun({ text: part, size: 16, font: "Calibri" }));
    }
  }
  return runs.length > 0
    ? runs
    : [new TextRun({ text, size: 16, font: "Calibri" })];
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size: 22,
        })
      );
    } else if (part) {
      runs.push(new TextRun({ text: part, size: 22 }));
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text, size: 22 })];
}
