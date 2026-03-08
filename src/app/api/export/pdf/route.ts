import { NextRequest } from "next/server";

export const maxDuration = 30;

/**
 * PDF Export — generates a clean text-based PDF
 * Uses a lightweight approach (no react-pdf/renderer which has serverless issues)
 * Format: Simple PDF 1.4 with proper French text
 */
export async function POST(request: NextRequest) {
  const { query, response } = await request.json();

  if (!response) {
    return new Response(JSON.stringify({ error: "response requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Clean markdown for plain text PDF
  const cleanText = response
    .replace(/^##+ /gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^[-*] /gm, "  - ");

  const date = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Build simple PDF content
  const title = "DATAVOCAT — Analyse Jurimetrique";
  const subtitle = `Genere le ${date}`;

  const fullText = [
    title,
    subtitle,
    "",
    "═".repeat(50),
    "",
    "DEMANDE :",
    query || "",
    "",
    "═".repeat(50),
    "",
    cleanText,
    "",
    "═".repeat(50),
    "",
    "Genere par Datavocat — Analyse jurimetrique assistee par IA",
    "Ce document est un outil d'aide a la decision strategique.",
  ].join("\n");

  // Generate minimal PDF
  const pdf = generateMinimalPDF(fullText);

  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="datavocat-analyse.pdf"',
    },
  });
}

/**
 * Generate a minimal valid PDF with text content
 * This is a lightweight PDF generator that avoids heavy dependencies
 */
function generateMinimalPDF(text: string): Uint8Array {
  // Encode text for PDF (escape special chars)
  const escapeText = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const lines = text.split("\n");
  const pageHeight = 842; // A4 height in points
  const pageWidth = 595; // A4 width in points
  const margin = 72; // 1 inch
  const lineHeight = 14;
  const maxLinesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

  // Split lines across pages
  const pages: string[][] = [];
  let currentPage: string[] = [];

  for (const line of lines) {
    // Wrap long lines
    const maxChars = 80;
    if (line.length > maxChars) {
      const words = line.split(" ");
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + " " + word).length > maxChars) {
          currentPage.push(currentLine.trim());
          if (currentPage.length >= maxLinesPerPage) {
            pages.push(currentPage);
            currentPage = [];
          }
          currentLine = word;
        } else {
          currentLine += " " + word;
        }
      }
      if (currentLine.trim()) {
        currentPage.push(currentLine.trim());
      }
    } else {
      currentPage.push(line);
    }

    if (currentPage.length >= maxLinesPerPage) {
      pages.push(currentPage);
      currentPage = [];
    }
  }
  if (currentPage.length > 0) pages.push(currentPage);

  // Build PDF objects
  const objects: string[] = [];
  const offsets: number[] = [];
  let output = "%PDF-1.4\n";

  const addObject = (content: string) => {
    const num = objects.length + 1;
    offsets.push(output.length);
    const obj = `${num} 0 obj\n${content}\nendobj\n`;
    output += obj;
    objects.push(obj);
    return num;
  };

  // Object 1: Catalog
  addObject("<< /Type /Catalog /Pages 2 0 R >>");

  // Object 2: Pages (placeholder, will be updated)
  const pagesObjIndex = objects.length;
  addObject("PLACEHOLDER");

  // Object 3: Font
  addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );

  // Generate page objects
  const pageObjIds: number[] = [];

  for (const pageLines of pages) {
    // Content stream
    let stream = "BT\n/F1 10 Tf\n";
    let y = pageHeight - margin;

    for (const line of pageLines) {
      // Check if it's a title line (all caps or starts with ═)
      if (line.startsWith("═") || line === line.toUpperCase() && line.length > 10) {
        stream += `/F1 12 Tf\n`;
        stream += `${margin} ${y} Td\n(${escapeText(line)}) Tj\n`;
        stream += `/F1 10 Tf\n`;
      } else {
        stream += `${margin} ${y} Td\n(${escapeText(line)}) Tj\n`;
      }
      // Reset position for next line
      stream += `${-margin} ${-lineHeight} Td\n`;
      y -= lineHeight;
    }

    stream += "ET";

    const streamBytes = new TextEncoder().encode(stream);
    const contentId = addObject(
      `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`
    );

    // Page object
    const pageId = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    );
    pageObjIds.push(pageId);
  }

  // Update pages object
  const pagesContent = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`;
  const pagesObj = `2 0 obj\n${pagesContent}\nendobj\n`;
  // Recalculate output
  const beforePages = output.indexOf("2 0 obj\nPLACEHOLDER\nendobj\n");
  const afterPages = beforePages + "2 0 obj\nPLACEHOLDER\nendobj\n".length;
  output =
    output.slice(0, beforePages) + pagesObj + output.slice(afterPages);

  // Recalculate offsets (simplified — for a minimal PDF this works)
  const xrefOffset = output.length;
  output += "xref\n";
  output += `0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  // Simplified offset table
  for (let i = 0; i < objects.length; i++) {
    const offset = output.indexOf(`${i + 1} 0 obj`);
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  output += "trailer\n";
  output += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  output += "startxref\n";
  output += `${xrefOffset}\n`;
  output += "%%EOF";

  return new TextEncoder().encode(output);
}
