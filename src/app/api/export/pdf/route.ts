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
  Font,
} from "@react-pdf/renderer";

export const maxDuration = 60;

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 Mo

// @react-pdf embarque Helvetica / Times par défaut, qui gèrent latin-1 étendu
// (accents français OK). Pas besoin d'embed custom pour notre usage.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    lineHeight: 1.5,
  },
  cover: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  brand: {
    fontFamily: "Times-Bold",
    fontSize: 32,
    color: "#0b1220",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subbrand: {
    fontFamily: "Times-Italic",
    fontSize: 16,
    color: "#b88a3e",
    marginBottom: 28,
  },
  rule: {
    width: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#b88a3e",
    marginBottom: 28,
  },
  date: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 4,
  },
  confidential: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 9,
    color: "#6b7280",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 28,
  },
  h1: {
    fontFamily: "Times-Bold",
    fontSize: 18,
    color: "#0b1220",
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e2d9",
  },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#0b1220",
    marginTop: 14,
    marginBottom: 6,
  },
  p: {
    marginBottom: 6,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  italic: {
    fontFamily: "Helvetica-Oblique",
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 12,
  },
  bulletDot: {
    width: 10,
  },
  queryBlock: {
    backgroundColor: "#f6f4ef",
    padding: 14,
    marginTop: 10,
    marginBottom: 18,
    borderLeftWidth: 2,
    borderLeftColor: "#b88a3e",
  },
  table: {
    marginTop: 6,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e2d9",
  },
  tableCell: {
    flex: 1,
    padding: 4,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: "#e5e2d9",
  },
  tableHeader: {
    backgroundColor: "#f6f4ef",
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
    fontFamily: "Helvetica-Oblique",
  },
});

// ─── Markdown parser léger → blocs React ───────────────────────────

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

function parseMarkdownToBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Tableau Markdown : ligne | | | suivie d'une ligne --- | --- | ---
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const next = (lines[i + 1] || "").trim();
      const isSeparator = /^\|[\s:\-|]+\|$/.test(next);
      if (isSeparator) {
        const headers = trimmed
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        i += 2; // skip header + sep
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
        blocks.push({ kind: "table", headers, rows });
        continue;
      }
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

// ─── Rendu inline : **gras** et *italique* ────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return React.createElement(
          Text,
          { key: idx, style: styles.bold },
          part.slice(2, -2)
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return React.createElement(
          Text,
          { key: idx, style: styles.italic },
          part.slice(1, -1)
        );
      }
      return React.createElement(Text, { key: idx }, part);
    });
}

// ─── Document React-PDF ───────────────────────────────────────────
function AnalysisDocument(props: {
  query: string;
  blocks: Block[];
  dateStr: string;
}) {
  const { query, blocks, dateStr } = props;

  return React.createElement(
    Document,
    { title: "Datavocat — Analyse jurimétrique" },
    // Page de garde
    React.createElement(
      Page,
      { size: "A4", style: styles.page, key: "cover" },
      React.createElement(
        View,
        { style: styles.cover },
        React.createElement(Text, { style: styles.brand }, "DATAVOCAT"),
        React.createElement(
          Text,
          { style: styles.subbrand },
          "Analyse jurimétrique"
        ),
        React.createElement(View, { style: styles.rule }),
        React.createElement(Text, { style: styles.date }, dateStr),
        React.createElement(
          Text,
          { style: styles.confidential },
          "Document confidentiel"
        )
      )
    ),
    // Contenu
    React.createElement(
      Page,
      { size: "A4", style: styles.page, key: "content", wrap: true },
      React.createElement(Text, { style: styles.h1 }, "Demande"),
      React.createElement(
        View,
        { style: styles.queryBlock },
        React.createElement(Text, null, query || "(non précisée)")
      ),
      React.createElement(Text, { style: styles.h1 }, "Analyse"),
      ...blocks.map((b, i) => {
        if (b.kind === "h1")
          return React.createElement(
            Text,
            { style: styles.h1, key: i },
            b.text
          );
        if (b.kind === "h2")
          return React.createElement(
            Text,
            { style: styles.h2, key: i },
            b.text
          );
        if (b.kind === "p")
          return React.createElement(
            Text,
            { style: styles.p, key: i },
            renderInline(b.text)
          );
        if (b.kind === "ul")
          return React.createElement(
            View,
            { key: i },
            ...b.items.map((it, j) =>
              React.createElement(
                View,
                { style: styles.bullet, key: j },
                React.createElement(Text, { style: styles.bulletDot }, "•"),
                React.createElement(
                  Text,
                  { style: { flex: 1 } },
                  renderInline(it)
                )
              )
            )
          );
        // table
        return React.createElement(
          View,
          { style: styles.table, key: i, wrap: false },
          React.createElement(
            View,
            { style: [styles.tableRow, styles.tableHeader] },
            ...b.headers.map((h, j) =>
              React.createElement(Text, { style: styles.tableCell, key: j }, h)
            )
          ),
          ...b.rows.map((row, ri) =>
            React.createElement(
              View,
              { style: styles.tableRow, key: ri },
              ...row.map((cell, ci) =>
                React.createElement(
                  Text,
                  { style: styles.tableCell, key: ci },
                  cell
                )
              )
            )
          )
        );
      }),
      React.createElement(
        Text,
        { style: styles.footer, fixed: true },
        "Datavocat — Analyse jurimétrique assistée par IA. Ne constitue pas une consultation juridique."
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
    // parsed is available but not used here — we prefer the raw markdown
    // to preserve the full structure (tableau de preuve, etc.)
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

    // renderToBuffer type expects a Document element — le composant rend bien
    // un <Document>, on cast pour satisfaire le check.
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
