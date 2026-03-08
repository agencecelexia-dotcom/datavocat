import { NextRequest } from "next/server";
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

export async function POST(request: NextRequest) {
  const { query, response, parsed } = await request.json();

  if (!response) {
    return new Response(JSON.stringify({ error: "response requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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
          text: "Analyse Jurimetrique",
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
                        text: "Taux de succes global",
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
                        text: `${parsed.tauxSuccesGlobal}%`,
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

  // Parse markdown sections from response
  const lines = response.split("\n");
  for (const line of lines) {
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
          text: "Genere par Datavocat — Analyse jurimetrique assistee par IA",
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
