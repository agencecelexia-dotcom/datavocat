/**
 * Safe markdown-to-HTML formatter.
 * Escapes HTML first (prevents XSS), then applies markdown formatting.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatMarkdownSafe(text: string): string {
  // Step 1: Escape all HTML to prevent XSS
  let html = escapeHtml(text);

  // Step 2: Apply markdown formatting on the escaped text
  html = html
    // Headings
    .replace(
      /^## (.+)$/gm,
      '<h2 class="font-serif text-xl font-bold mt-8 mb-3 pb-2 border-b border-border/40 text-primary">$1</h2>'
    )
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>'
    )
    // Lists
    .replace(
      /^- (.+)$/gm,
      '<li class="ml-4 py-0.5 leading-relaxed">$1</li>'
    )
    .replace(
      /^\d+\. (.+)$/gm,
      '<li class="ml-4 py-0.5 leading-relaxed list-decimal">$1</li>'
    )
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Make ECLI references clickable
    .replace(
      /(ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+)/g,
      '<a href="https://www.legifrance.gouv.fr/search/juri?query=$1" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary font-mono text-xs">$1<svg class="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>'
    )
    // Make pourvoi numbers clickable (n° XX-XXXXX)
    .replace(
      /n[°o]\s*(\d{2,4}[-/.]\d{2,5}(?:\.\d+)?)/g,
      '<a href="https://www.legifrance.gouv.fr/search/juri?query=$1" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary font-mono text-xs">n&deg; $1<svg class="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></a>'
    )
    // Tables
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match
        .split("|")
        .filter(Boolean)
        .map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return "";
      return `<div class="flex gap-4 py-1.5 text-sm border-b border-border/30">${cells.map((c) => `<span class="flex-1">${c}</span>`).join("")}</div>`;
    })
    // Line breaks
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");

  return html;
}
