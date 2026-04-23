import { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/supabase/auth-helper";
import type { ParsedAnalysis } from "@/lib/parse-analysis";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export const maxDuration = 60;

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;

// ─── Palette Greffe ───────────────────────────────────────────────
const C = {
  ink: "#0b1220",
  gold: "#b88a3e",
  goldDeep: "#8a6225",
  paper: "#f6f4ef",
  line: "#d8d4c6",
  hairline: "#e5e2d9",
  muted: "#6b7280",
  faint: "#9ca3af",
};

// ─── Roman numerals ───────────────────────────────────────────────
function roman(n: number): string {
  const map: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  let num = n;
  for (const [value, letter] of map) {
    while (num >= value) {
      result += letter;
      num -= value;
    }
  }
  return result;
}

const styles = StyleSheet.create({
  // Page de contenu
  page: {
    paddingTop: 90,
    paddingBottom: 80,
    paddingLeft: 72,
    paddingRight: 62,
    fontFamily: "Times-Roman",
    fontSize: 10.8,
    color: C.ink,
    lineHeight: 1.6,
  },

  // Running header (contenu)
  runningHeader: {
    position: "absolute",
    top: 40,
    left: 60,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 0.4,
    borderBottomColor: C.line,
  },
  runningHeaderLeft: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: C.muted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  runningHeaderRight: {
    fontFamily: "Times-Italic",
    fontSize: 8.5,
    color: C.muted,
  },

  // Cover
  coverPage: {
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 72,
    fontFamily: "Times-Roman",
    color: C.ink,
    backgroundColor: "#fdfcf9",
  },
  coverFrame: {
    flex: 1,
    justifyContent: "space-between",
  },
  coverTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  coverTopMark: {
    width: 22,
    height: 22,
    borderWidth: 0.8,
    borderColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  coverTopMarkText: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    color: C.gold,
  },
  coverTopEyebrow: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: C.ink,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  coverMain: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 40,
  },
  coverKicker: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: C.gold,
    letterSpacing: 4,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  coverTitle: {
    fontFamily: "Times-Italic",
    fontSize: 58,
    color: C.ink,
    lineHeight: 1,
    marginBottom: 20,
  },
  coverRule: {
    width: 56,
    borderBottomWidth: 0.9,
    borderBottomColor: C.gold,
    marginBottom: 22,
  },
  coverStandFirst: {
    fontFamily: "Times-Italic",
    fontSize: 13,
    color: C.muted,
    lineHeight: 1.55,
    maxWidth: 340,
  },
  coverBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.4,
    borderTopColor: C.line,
    paddingTop: 14,
  },
  coverBottomCol: {
    flexDirection: "column",
  },
  coverBottomLabel: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: C.faint,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  coverBottomValue: {
    fontFamily: "Times-Italic",
    fontSize: 11,
    color: C.ink,
  },
  coverBottomValueMono: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: C.ink,
  },

  // Demande
  queryWrap: {
    marginTop: 12,
    marginBottom: 20,
    paddingLeft: 18,
    borderLeftWidth: 1.2,
    borderLeftColor: C.gold,
  },
  queryLabel: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: C.gold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  queryText: {
    fontFamily: "Times-Italic",
    fontSize: 12.5,
    color: C.ink,
    lineHeight: 1.55,
  },

  // Sections numérotées
  sectionHeaderWrap: {
    marginTop: 26,
    marginBottom: 14,
  },
  sectionNumber: {
    fontFamily: "Times-Italic",
    fontSize: 11,
    color: C.gold,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 22,
    color: C.ink,
    lineHeight: 1.15,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },

  h2Wrap: {
    marginTop: 16,
    marginBottom: 6,
  },
  h2: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    color: C.ink,
  },

  // Paragraph
  pWrap: {
    marginBottom: 8,
  },
  p: {
    fontFamily: "Times-Roman",
    fontSize: 10.8,
    color: C.ink,
    lineHeight: 1.6,
    textAlign: "justify",
  },

  // Bullets
  bulletWrap: {
    flexDirection: "row",
    marginBottom: 5,
  },
  bulletDot: {
    width: 14,
    fontFamily: "Times-Italic",
    fontSize: 10.5,
    color: C.gold,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Times-Roman",
    fontSize: 10.8,
    color: C.ink,
    lineHeight: 1.55,
  },

  // Tables
  tableWrap: {
    marginTop: 10,
    marginBottom: 16,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
  },
  tableHeaderCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.ink,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.4,
    borderBottomColor: C.hairline,
  },
  tableRowAlt: {
    backgroundColor: "#fafaf7",
  },
  tableCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    color: C.ink,
  },

  // Tableau de preuve (stub éditorial)
  stubWrap: {
    marginTop: 14,
    marginBottom: 20,
    padding: 20,
    backgroundColor: C.paper,
    borderLeftWidth: 2,
    borderLeftColor: C.gold,
  },
  stubEyebrow: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: C.gold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  stubTitle: {
    fontFamily: "Times-Italic",
    fontSize: 15,
    color: C.ink,
    marginBottom: 8,
  },
  stubText: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: C.muted,
    lineHeight: 1.55,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 0.4,
    borderTopColor: C.line,
  },
  footerLeft: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: C.faint,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  footerPage: {
    fontFamily: "Times-Italic",
    fontSize: 9,
    color: C.muted,
  },
});

// ─── Markdown parser → blocs ──────────────────────────────────────

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "tableStub"; rowCount: number; colCount: number };

function parseMarkdownToBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let inTableauDePreuveSection = false;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const title = trimmed.slice(3).toLowerCase();
      if (title.includes("tableau de preuve")) {
        inTableauDePreuveSection = true;
        i++;
        continue;
      } else {
        inTableauDePreuveSection = false;
      }
    }

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
        if (inTableauDePreuveSection || headers.length > 7) {
          blocks.push({
            kind: "tableStub",
            rowCount: rows.length,
            colCount: headers.length,
          });
        } else {
          blocks.push({ kind: "table", headers, rows });
        }
        continue;
      }
    }

    if (inTableauDePreuveSection) {
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "h1", text: trimmed.slice(3) });
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      blocks.push({ kind: "h2", text: trimmed.slice(4) });
      i++;
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("- ") || l.startsWith("* ")) {
          items.push(l.slice(2));
          i++;
        } else break;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    blocks.push({ kind: "p", text: trimmed });
    i++;
  }

  return blocks;
}

// ─── Inline runs : **gras** ────────────────────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return React.createElement(
          Text,
          { key: idx, style: { fontFamily: "Times-Bold" } },
          part.slice(2, -2)
        );
      }
      return React.createElement(Text, { key: idx }, part);
    });
}

// ─── Document ──────────────────────────────────────────────────────
function AnalysisDocument(props: {
  query: string;
  blocks: Block[];
  dateStr: string;
  shortDateStr: string;
  editionNumber: string;
}) {
  const { query, blocks, dateStr, shortDateStr, editionNumber } = props;

  // Numérotation des sections h1
  let sectionCounter = 0;

  const renderedBlocks: React.ReactNode[] = blocks.map((b, i) => {
    if (b.kind === "h1") {
      sectionCounter++;
      return React.createElement(
        View,
        { key: i, style: styles.sectionHeaderWrap, wrap: false },
        React.createElement(
          Text,
          { style: styles.sectionNumber },
          `§ ${roman(sectionCounter)}`
        ),
        React.createElement(Text, { style: styles.sectionTitle }, b.text)
      );
    }
    if (b.kind === "h2") {
      return React.createElement(
        View,
        { key: i, style: styles.h2Wrap, wrap: false },
        React.createElement(Text, { style: styles.h2 }, b.text)
      );
    }
    if (b.kind === "p") {
      return React.createElement(
        View,
        { key: i, style: styles.pWrap },
        React.createElement(
          Text,
          { style: styles.p },
          renderInline(b.text)
        )
      );
    }
    if (b.kind === "ul") {
      return React.createElement(
        View,
        { key: i, style: { marginBottom: 10 } },
        ...b.items.map((it, j) =>
          React.createElement(
            View,
            { key: j, style: styles.bulletWrap },
            React.createElement(Text, { style: styles.bulletDot }, "§"),
            React.createElement(
              Text,
              { style: styles.bulletText },
              renderInline(it)
            )
          )
        )
      );
    }
    if (b.kind === "tableStub") {
      return React.createElement(
        View,
        { key: i, style: styles.stubWrap, wrap: false },
        React.createElement(
          Text,
          { style: styles.stubEyebrow },
          "Tableau de preuve"
        ),
        React.createElement(
          Text,
          { style: styles.stubTitle },
          `${b.rowCount} décisions · ${b.colCount} facteurs`
        ),
        React.createElement(
          Text,
          { style: styles.stubText },
          "Le tableau de preuve statistique — avec l'ensemble des décisions analysées et leurs facteurs juridiques discriminants — est disponible dans les exports CSV et DOCX, formats mieux adaptés à la consultation et au filtrage d'un corpus de cette densité."
        )
      );
    }
    // table
    return React.createElement(
      View,
      { key: i, style: styles.tableWrap, wrap: true },
      React.createElement(
        View,
        { style: styles.tableHeaderRow },
        ...b.headers.map((h, j) =>
          React.createElement(
            Text,
            { key: j, style: styles.tableHeaderCell },
            h
          )
        )
      ),
      ...b.rows.map((row, ri) =>
        React.createElement(
          View,
          {
            key: ri,
            style:
              ri % 2 === 0
                ? styles.tableRow
                : [styles.tableRow, styles.tableRowAlt],
            wrap: false,
          },
          ...row.map((cell, ci) =>
            React.createElement(
              Text,
              { key: ci, style: styles.tableCell },
              cell
            )
          )
        )
      )
    );
  });

  return React.createElement(
    Document,
    { title: "Datavocat — Analyse jurimétrique" },

    // ─── Cover ─────────────────────────────────────────────────
    React.createElement(
      Page,
      { size: "A4", style: styles.coverPage, key: "cover" },
      React.createElement(
        View,
        { style: styles.coverFrame },

        // Top : monogram + eyebrow
        React.createElement(
          View,
          { style: styles.coverTop },
          React.createElement(
            View,
            { style: styles.coverTopMark },
            React.createElement(
              Text,
              { style: styles.coverTopMarkText },
              "D"
            )
          ),
          React.createElement(
            Text,
            { style: styles.coverTopEyebrow },
            "Datavocat · Greffe · Jurimétrie"
          )
        ),

        // Main : kicker + titre italique + filet + standfirst
        React.createElement(
          View,
          { style: styles.coverMain },
          React.createElement(
            Text,
            { style: styles.coverKicker },
            "Édition"
          ),
          React.createElement(
            Text,
            { style: styles.coverTitle },
            "Analyse\njurimétrique"
          ),
          React.createElement(View, { style: styles.coverRule }),
          React.createElement(
            Text,
            { style: styles.coverStandFirst },
            "Dossier confidentiel établi à partir des décisions de la Cour de cassation et des juges du fond, pour appréciation par le cabinet."
          )
        ),

        // Bottom : date, édition, confidentialité
        React.createElement(
          View,
          { style: styles.coverBottom },
          React.createElement(
            View,
            { style: styles.coverBottomCol },
            React.createElement(
              Text,
              { style: styles.coverBottomLabel },
              "Date"
            ),
            React.createElement(
              Text,
              { style: styles.coverBottomValue },
              dateStr
            )
          ),
          React.createElement(
            View,
            { style: styles.coverBottomCol },
            React.createElement(
              Text,
              { style: styles.coverBottomLabel },
              "N° d'édition"
            ),
            React.createElement(
              Text,
              { style: styles.coverBottomValueMono },
              editionNumber
            )
          ),
          React.createElement(
            View,
            { style: styles.coverBottomCol },
            React.createElement(
              Text,
              { style: styles.coverBottomLabel },
              "Diffusion"
            ),
            React.createElement(
              Text,
              { style: styles.coverBottomValue },
              "Confidentiel"
            )
          )
        )
      )
    ),

    // ─── Contenu ───────────────────────────────────────────────
    React.createElement(
      Page,
      { size: "A4", style: styles.page, key: "content" },

      // Running header
      React.createElement(
        View,
        { style: styles.runningHeader, fixed: true },
        React.createElement(
          Text,
          { style: styles.runningHeaderLeft },
          "Datavocat · Analyse jurimétrique"
        ),
        React.createElement(
          Text,
          { style: styles.runningHeaderRight },
          shortDateStr
        )
      ),

      // Demande
      React.createElement(
        View,
        { style: styles.queryWrap },
        React.createElement(Text, { style: styles.queryLabel }, "Demande"),
        React.createElement(
          Text,
          { style: styles.queryText },
          query || "(non précisée)"
        )
      ),

      ...renderedBlocks,

      // Footer
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          { style: styles.footerLeft },
          "Datavocat · Jurimétrie"
        ),
        React.createElement(Text, {
          style: styles.footerPage,
          render: ({
            pageNumber,
            totalPages,
          }: {
            pageNumber: number;
            totalPages: number;
          }) => `${pageNumber} / ${totalPages}`,
        })
      )
    )
  );
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
    void (body.parsed as ParsedAnalysis | null | undefined);

    if (!response || typeof response !== "string") {
      return new Response(JSON.stringify({ error: "response requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (response.length > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({
          error: "L'analyse est trop volumineuse pour être exportée en PDF.",
        }),
        { status: 413, headers: { "Content-Type": "application/json" } }
      );
    }

    const blocks = parseMarkdownToBlocks(response);
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const shortDateStr = now.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    // N° d'édition déterministe à partir de la date+heure (YY.MM.DD-HHMM)
    const pad = (n: number) => String(n).padStart(2, "0");
    const editionNumber = `${String(now.getFullYear()).slice(
      2
    )}·${pad(now.getMonth() + 1)}·${pad(now.getDate())} — ${pad(
      now.getHours()
    )}${pad(now.getMinutes())}`;

    const element = React.createElement(AnalysisDocument, {
      query,
      blocks,
      dateStr,
      shortDateStr,
      editionNumber,
    });

    const buffer = await renderToBuffer(
      element as unknown as Parameters<typeof renderToBuffer>[0]
    );

    return new Response(new Uint8Array(buffer).buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="datavocat-analyse.pdf"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("PDF export failed", err);
    return new Response(
      JSON.stringify({ error: `Échec de la génération PDF : ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
