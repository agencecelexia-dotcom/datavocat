/**
 * Safe markdown-to-HTML formatter for premium legal document rendering.
 * Escapes HTML first (prevents XSS), then applies markdown formatting.
 * Output is rendered via dangerouslySetInnerHTML in a prose container.
 */

/**
 * Retire la section "## Tableau de preuve" du markdown pour éviter le doublon
 * dans la vue Rapport — le tableau complet est déjà accessible via l'onglet
 * Tableau dédié.
 */
export function stripEvidenceTableSection(md: string): string {
  if (!md) return md;
  const lines = md.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^##\s+Tableau\s+de\s+preuve/i.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^##\s+/.test(line)) {
      skipping = false;
    }
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const EXTERNAL_LINK_SVG =
  '<svg class="inline h-3 w-3 ml-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>';

/**
 * Detect and render markdown tables.
 * Returns the HTML string for the table, or null if the lines don't form a table.
 */
function processTable(lines: string[]): { html: string; consumed: number } | null {
  // A table needs at least a header row and a separator row
  if (lines.length < 2) return null;

  const isTableRow = (line: string) => line.trim().startsWith("|") && line.trim().endsWith("|");
  const isSeparator = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
    const cells = trimmed.slice(1, -1).split("|");
    return cells.every((c) => /^\s*:?-{2,}:?\s*$/.test(c));
  };

  if (!isTableRow(lines[0]) || !isSeparator(lines[1])) return null;

  const parseCells = (line: string) =>
    line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());

  const headerCells = parseCells(lines[0]);

  // Collect body rows
  const bodyRows: string[][] = [];
  let consumed = 2;
  for (let i = 2; i < lines.length; i++) {
    if (!isTableRow(lines[i])) break;
    bodyRows.push(parseCells(lines[i]));
    consumed++;
  }

  const headerHtml = headerCells
    .map(
      (c) =>
        `<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-white/90">${c}</th>`
    )
    .join("");

  const bodyHtml = bodyRows
    .map(
      (row, idx) =>
        `<tr class="${idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/80 dark:bg-slate-800/50"} transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-900/10">${row.map((c) => `<td class="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-700/50">${c}</td>`).join("")}</tr>`
    )
    .join("");

  const html =
    `<div class="my-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">` +
    `<table class="w-full min-w-[400px] border-collapse text-sm">` +
    `<thead><tr class="bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-700 dark:to-slate-600">${headerHtml}</tr></thead>` +
    `<tbody>${bodyHtml}</tbody>` +
    `</table></div>`;

  return { html, consumed };
}

/**
 * Process blockquote lines (consecutive lines starting with &gt;).
 */
function processBlockquote(lines: string[]): { html: string; consumed: number } | null {
  if (!lines[0].startsWith("&gt;")) return null;

  const quoteLines: string[] = [];
  let consumed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("&gt;")) break;
    // Remove the leading &gt; and optional space
    quoteLines.push(lines[i].replace(/^&gt;\s?/, ""));
    consumed++;
  }

  const content = quoteLines.join("<br/>");
  const html =
    `<blockquote class="my-5 rounded-r-lg border-l-4 border-amber-500/70 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-400/50 py-3 px-5 text-slate-700 dark:text-slate-300 italic leading-relaxed">` +
    `<div>${content}</div></blockquote>`;

  return { html, consumed };
}

/**
 * Process unordered list (consecutive lines starting with -).
 */
function processUnorderedList(lines: string[]): { html: string; consumed: number } | null {
  if (!/^- /.test(lines[0])) return null;

  const items: string[] = [];
  let consumed = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^- (.+)$/);
    if (!match) break;
    items.push(match[1]);
    consumed++;
  }

  const listItems = items
    .map(
      (item) =>
        `<li class="relative pl-5 py-1 leading-relaxed text-slate-700 dark:text-slate-300 before:content-[''] before:absolute before:left-0 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-amber-500/80">${item}</li>`
    )
    .join("");

  const html = `<ul class="my-4 ml-2 space-y-0.5 list-none">${listItems}</ul>`;
  return { html, consumed };
}

/**
 * Process ordered list (consecutive lines starting with number.).
 */
function processOrderedList(lines: string[]): { html: string; consumed: number } | null {
  if (!/^\d+\. /.test(lines[0])) return null;

  const items: string[] = [];
  let consumed = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\d+\. (.+)$/);
    if (!match) break;
    items.push(match[1]);
    consumed++;
  }

  const listItems = items
    .map(
      (item, idx) =>
        `<li class="relative pl-8 py-1 leading-relaxed text-slate-700 dark:text-slate-300">` +
        `<span class="absolute left-0 top-[0.35em] flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 dark:bg-slate-600 text-[10px] font-bold text-white">${idx + 1}</span>` +
        `${item}</li>`
    )
    .join("");

  const html = `<ol class="my-4 ml-2 space-y-1 list-none">${listItems}</ol>`;
  return { html, consumed };
}

/**
 * Apply inline formatting to a line of text.
 */
function applyInlineFormatting(line: string): string {
  return (
    line
      // Bold — navy color
      .replace(
        /\*\*(.+?)\*\*/g,
        '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>'
      )
      // Italic
      .replace(/\*(.+?)\*/g, '<em class="italic text-slate-600 dark:text-slate-400">$1</em>')
      // Inline code
      .replace(
        /`([^`]+)`/g,
        '<code class="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-700 dark:text-slate-300">$1</code>'
      )
      // ECLI references — badge-like clickable
      .replace(
        /(ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+)/g,
        `<a href="https://www.courdecassation.fr/decision/$1" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 px-2 py-0.5 font-mono text-[11px] text-blue-800 dark:text-blue-300 no-underline hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors">$1${EXTERNAL_LINK_SVG}</a>`
      )
      // Pourvoi numbers — badge-like clickable (n° XX-XXXXX)
      .replace(
        /n[°o]\s*(\d{2,4}[-/.]\d{2,5}(?:\.\d+)?)/g,
        `<a href="https://www.legifrance.gouv.fr/search/juri?query=$1" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-md bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700/50 px-2 py-0.5 font-mono text-[11px] text-violet-800 dark:text-violet-300 no-underline hover:bg-violet-100 dark:hover:bg-violet-800/40 transition-colors">n&deg;&nbsp;$1${EXTERNAL_LINK_SVG}</a>`
      )
  );
}

export function formatMarkdownSafe(text: string): string {
  // Step 1: Escape all HTML to prevent XSS
  const escaped = escapeHtml(text);

  // Step 2: Process line by line for block-level elements
  const lines = escaped.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const remaining = lines.slice(i);
    const line = lines[i];

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      output.push(
        '<div class="my-8 flex items-center gap-3"><div class="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent dark:via-amber-500/30"></div><div class="h-1.5 w-1.5 rounded-full bg-amber-400/60 dark:bg-amber-500/40"></div><div class="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent dark:via-amber-500/30"></div></div>'
      );
      i++;
      continue;
    }

    // H2 heading — premium section header with gold left border
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      const content = applyInlineFormatting(h2Match[1]);
      output.push(
        `<h2 class="mt-10 mb-4 flex items-center gap-3 border-l-[3px] border-amber-500 pl-4 font-serif text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">${content}</h2>`
      );
      i++;
      continue;
    }

    // H3 heading — clean subheading
    const h3Match = line.match(/^### (.+)$/);
    if (h3Match) {
      const content = applyInlineFormatting(h3Match[1]);
      output.push(
        `<h3 class="mt-7 mb-3 text-base font-semibold text-slate-800 dark:text-slate-200 tracking-tight">${content}</h3>`
      );
      i++;
      continue;
    }

    // H4 heading
    const h4Match = line.match(/^#### (.+)$/);
    if (h4Match) {
      const content = applyInlineFormatting(h4Match[1]);
      output.push(
        `<h4 class="mt-5 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${content}</h4>`
      );
      i++;
      continue;
    }

    // Table
    const tableResult = processTable(remaining);
    if (tableResult) {
      output.push(tableResult.html);
      i += tableResult.consumed;
      continue;
    }

    // Blockquote
    const bqResult = processBlockquote(remaining);
    if (bqResult) {
      // Apply inline formatting to blockquote content
      output.push(applyInlineFormatting(bqResult.html));
      i += bqResult.consumed;
      continue;
    }

    // Unordered list
    const ulResult = processUnorderedList(remaining);
    if (ulResult) {
      // Apply inline formatting to list items
      output.push(applyInlineFormatting(ulResult.html));
      i += ulResult.consumed;
      continue;
    }

    // Ordered list
    const olResult = processOrderedList(remaining);
    if (olResult) {
      output.push(applyInlineFormatting(olResult.html));
      i += olResult.consumed;
      continue;
    }

    // Empty line — paragraph break
    if (line.trim() === "") {
      output.push('<div class="h-3"></div>');
      i++;
      continue;
    }

    // Regular paragraph
    output.push(
      `<p class="my-1 leading-relaxed text-slate-700 dark:text-slate-300">${applyInlineFormatting(line)}</p>`
    );
    i++;
  }

  return output.join("\n");
}
