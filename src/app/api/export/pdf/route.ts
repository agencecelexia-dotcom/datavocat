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
  paper: "#f6f4ef",
  line: "#d8d4c6",
  muted: "#6b7280",
  faint: "#9ca3af",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 60,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: C.ink,
    lineHeight: 1.55,
  },

  // Cover
  coverWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  eyebrow: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: C.gold,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 36,
  },
  coverTitle: {
    fontFamily: "Times-Bold",
    fontSize: 42,
    color: C.ink,
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  coverSubtitle: {
    fontFamily: "Times-Italic",
    fontSize: 18,
    color: C.gold,
    textAlign: "center",
    marginBottom: 48,
  },
  coverRule: {
    width: 80,
    borderBottomWidth: 0.8,
    borderBottomColor: C.gold,
    marginBottom: 32,
  },
  coverDate: {
    fontFamily: "Times-Italic",
    fontSize: 11,
    color: C.muted,
    marginBottom: 8,
  },
  coverConfidential: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: C.muted,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginTop: 80,
  },

  // Sections
  sectionEyebrow: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: C.gold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 6,
  },
  h1: {
    fontFamily: "Times-Bold",
    fontSize: 20,
    color: C.ink,
    marginTop: 4,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 0.8,
    borderBottomColor: C.line,
  },
  h2: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    color: C.ink,
    marginTop: 16,
    marginBottom: 6,
  },

  // Bloc paragraph
  pWrap: {
    marginBottom: 8,
  },
  p: {
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: C.ink,
  },

  // Bullets
  bulletWrap: {
    flexDirection: "row",
    marginBottom: 5,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 12,
    fontSize: 10.5,
    color: C.gold,
  },
  bulletText: {
    flex: 1,
    fontSize: 10.5,
    color: C.ink,
  },

  // Query block
  queryWrap: {
    backgroundColor: C.paper,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderLeftWidth: 2,
    borderLeftColor: C.gold,
  },
  queryLabel: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: C.gold,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  queryText: {
    fontFamily: "Times-Italic",
    fontSize: 11,
    color: C.ink,
    lineHeight: 1.5,
  },

  // Table (petites tables — pour les gros tableaux on redirige CSV)
  tableWrap: {
    marginTop: 8,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: C.line,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  tableHeader: {
    backgroundColor: C.paper,
  },
  tableCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8.5,
    color: C.ink,
    borderRightWidth: 0.5,
    borderRightColor: C.line,
  },
  tableCellBold: {
    fontFamily: "Helvetica-Bold",
  },

  // Tableau de preuve stub
  stubWrap: {
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    backgroundColor: C.paper,
    borderLeftWidth: 2,
    borderLeftColor: C.gold,
  },
  stubTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: C.ink,
    marginBottom: 4,
  },
  stubText: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.muted,
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: C.faint,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  footerPage: {
    fontFamily: "Helvetica",
    fontSize: 8.5,
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

    // Détection du début / fin de la section "Tableau de preuve"
    if (trimmed.startsWith("## ")) {
      const title = trimmed.slice(3).toLowerCase();
      if (title.includes("tableau de preuve")) {
        inTableauDePreuveSection = true;
        // On skippe le titre lui-même — on remplacera par un stub après parse complet
        i++;
        continue;
      } else {
        inTableauDePreuveSection = false;
      }
    }

    // Détection tableau markdown
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
        // Tableau de preuve → stub uniquement dans le PDF
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

    // Si on est dans la section tableau de preuve, on skippe tout son contenu
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
          { key: idx, style: { fontFamily: "Helvetica-Bold" } },
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
}) {
  const { query, blocks, dateStr } = props;

  const renderedBlocks = blocks.map((b, i) => {
    if (b.kind === "h1") {
      return React.createElement(
        View,
        { key: i, wrap: false },
        React.createElement(Text, { style: styles.sectionEyebrow }, "§"),
        React.createElement(Text, { style: styles.h1 }, b.text)
      );
    }
    if (b.kind === "h2") {
      return React.createElement(
        View,
        { key: i, wrap: false },
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
          { style: styles.stubTitle },
          "Tableau de preuve statistique"
        ),
        React.createElement(
          Text,
          { style: styles.stubText },
          `${b.rowCount} décisions analysées sur ${b.colCount} facteurs juridiques décisifs. ` +
            "Le tableau complet est disponible en export CSV ou DOCX (mieux adaptés à la lecture et au filtrage d'un corpus de cette densité)."
        )
      );
    }
    // kind === "table"
    return React.createElement(
      View,
      { key: i, style: styles.tableWrap, wrap: true },
      React.createElement(
        View,
        { style: [styles.tableRow, styles.tableHeader] },
        ...b.headers.map((h, j) =>
          React.createElement(
            Text,
            { key: j, style: [styles.tableCell, styles.tableCellBold] },
            h
          )
        )
      ),
      ...b.rows.map((row, ri) =>
        React.createElement(
          View,
          { key: ri, style: styles.tableRow, wrap: false },
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
    // Page de garde
    React.createElement(
      Page,
      { size: "A4", style: styles.page, key: "cover" },
      React.createElement(
        View,
        { style: styles.coverWrap },
        React.createElement(Text, { style: styles.eyebrow }, "Greffe"),
        React.createElement(Text, { style: styles.coverTitle }, "Datavocat"),
        React.createElement(
          Text,
          { style: styles.coverSubtitle },
          "Analyse jurimétrique"
        ),
        React.createElement(View, { style: styles.coverRule }),
        React.createElement(Text, { style: styles.coverDate }, dateStr),
        React.createElement(
          Text,
          { style: styles.coverConfidential },
          "Document confidentiel"
        )
      ),
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          { style: styles.footerText },
          "Datavocat — Jurimétrie"
        )
      )
    ),
    // Contenu
    React.createElement(
      Page,
      { size: "A4", style: styles.page, key: "content" },
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
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(
          Text,
          { style: styles.footerText },
          "Datavocat — Jurimétrie"
        ),
        React.createElement(Text, {
          style: styles.footerPage,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${pageNumber} / ${totalPages}`,
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
    const dateStr = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const element = React.createElement(AnalysisDocument, {
      query,
      blocks,
      dateStr,
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
