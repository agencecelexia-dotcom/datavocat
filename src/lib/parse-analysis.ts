/**
 * Parse a DATAVOCAT structured markdown response into visual data
 */

export interface SourceReference {
  type: "ecli" | "pourvoi" | "decision";
  reference: string;
  url: string;
  date: string;
  chamber: string;
  solution: string;
}

export interface DetailedSource {
  reference: string;
  juridiction: string;
  chambre: string;
  date: string;
  solution: string;
  source: string; // "Judilibre" | "Connaissance consolidee"
  pertinence: "favorable" | "defavorable" | "neutre" | "";
  apport: string;
  url: string;
}

export interface FiabiliteScore {
  score: number; // 0-100
  label: "Tres eleve" | "Eleve" | "Moyen" | "Faible" | "Tres faible";
  details: string;
  factors: FiabiliteFactor[];
  /**
   * Formule explicite (Règle 3) :
   *   indice = (A × 0,35) + (B × 0,25) + (C × 0,20) + (D × 0,20)
   *   A = Cohérence jurisprudentielle (% sens dominant)
   *   B = Représentativité (min(total/30, 1) × 100)
   *   C = Diversité juridictionnelle (100 / 50 / 0)
   *   D = Récence (% < 5 ans)
   */
  formula?: { A: number; B: number; C: number; D: number };
}

export interface FiabiliteFactor {
  name: string;
  score: number;
  maxScore: number;
  description: string;
  impact: "positive" | "negative" | "neutral";
}

export interface EvidenceTableRow {
  [key: string]: string;
}

export interface EvidenceTable {
  headers: string[];
  rows: EvidenceTableRow[];
  synthese: string;
  periode: string;
  interpretation: string;
  facteursDeterminants: string;
}

export interface ParsedAnalysis {
  situation: string;
  recherche: string;
  tauxSuccesGlobal: number | null;
  echantillon: number | null;
  confiance: "faible" | "moyen" | "élevé" | null;
  arguments: Array<{
    name: string;
    taux: number | null;
    invoque: number | null;
    retenu: number | null;
  }>;
  juridictions: Array<{
    name: string;
    taux: number | null;
    delai: string | null;
  }>;
  instances: Array<{ name: string; taux: number | null; total: number | null; gagnees: number | null }>;
  montants: { min: number | null; median: number | null; max: number | null };
  recommandation: string;
  decisionsClés: string;
  limites: string;
  sources: SourceReference[];
  detailedSources: DetailedSource[];
  sourceCount: number;
  fiabilite: FiabiliteScore;
  article700: {
    tauxCondamnation: number | null;
    montantMoyen: number | null;
    montantMedian: number | null;
  } | null;
  evidenceTable: EvidenceTable | null;
  sections: Array<{ title: string; content: string; emoji: string }>;
  /**
   * Résultat du contrôle anti-hallucination réalisé côté serveur après
   * génération. Présent uniquement si l'analyse a été produite avec le
   * pipeline de vérification post-génération (depuis avril 2026).
   */
  verification?: {
    citedRefs: number;
    verifiedRefs: number;
    unverifiedRefs: string[];
    removedSentences: number;
    removedRows: number;
    /** Vrai si l'invariant N intro = N tableau a dû être patché. */
    coherenceCorrected?: boolean;
    /** Composition de la hiérarchie 4 catégories. */
    corpusComposition?: {
      total: number;
      premierDegre: number;
      courAppel: number;
      cassation: number;
      conseilEtat: number;
      // Champs hérités, tenus pour rétro-compat des analyses antérieures.
      cassationCount?: number;
      fondCount?: number;
      cassationPct?: number;
      fondPct?: number;
      cassationRate?: number | null;
      fondAcceptanceRate?: number | null;
    } | null;
    /** Composantes A/B/C/D pré-calculées côté serveur. */
    fiabilite?: {
      A: number;
      B: number;
      C: number;
      D: number;
      score: number;
    } | null;
    /** Taux de succès retenu (canonique) calculé sur le corpus. */
    tauxSuccesRetenu?: number | null;
    /** Source du taux : "fond" (1er degré + CA), "mixte", "cassation". */
    tauxSuccesSource?: "fond" | "mixte" | "cassation" | null;
    /** Tendance temporelle (Niveau 3 jurimétrie). */
    temporalTrend?: {
      buckets: Array<{
        year: string;
        total: number;
        favorables: number;
        rate: number;
      }>;
      direction: "ascending" | "descending" | "flat" | "insufficient";
      deltaPct: number;
      medianYear: string | null;
    } | null;
    regionalVariations?: Array<{
      label: string;
      total: number;
      favorables: number;
      rate: number;
    }> | null;
    chamberVariations?: Array<{
      label: string;
      total: number;
      favorables: number;
      rate: number;
    }> | null;
    themeVariations?: Array<{
      label: string;
      total: number;
      favorables: number;
      rate: number;
    }> | null;
  } | null;
}

/**
 * Build a clickable URL for a French court decision reference.
 * Prioritizes direct Legifrance links when possible, falls back to Judilibre search.
 */
export function buildSourceUrl(ref: string): string {
  // ECLI references -> Legifrance search/all qui redirige vers la fiche JURITEXT.
  // L'ancien format /juri/id/ECLI:... ne fonctionne plus depuis la refonte
  // Legifrance. Le format search/all retourne la bonne décision.
  const ecliMatch = ref.match(/ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+/);
  if (ecliMatch) {
    return `https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(ecliMatch[0])}&page=1&init=true`;
  }

  // Pourvoi numbers -> Legifrance search/all avec le n° de pourvoi
  const pourvoiMatch = ref.match(/(\d{2,4}[-/.]\d{2,5}(?:\.\d+)?)/);
  if (pourvoiMatch) {
    return `https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(pourvoiMatch[1])}&page=1&init=true`;
  }

  // Cass. references -> Legifrance search/all avec la référence brute
  return `https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(ref)}&page=1&init=true`;
}

/**
 * Extract all source references (ECLI, pourvoi numbers) from text
 */
function extractSources(text: string): SourceReference[] {
  const sources: SourceReference[] = [];
  const seen = new Set<string>();

  // Extract ECLI references (e.g., ECLI:FR:CCASS:2023:SO00123)
  const ecliRegex =
    /ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+/g;
  for (const match of text.matchAll(ecliRegex)) {
    const ecli = match[0];
    if (seen.has(ecli)) continue;
    seen.add(ecli);

    // Try to extract surrounding context for date/chamber/solution
    const context = extractContext(text, match.index!, ecli);
    sources.push({
      type: "ecli",
      reference: ecli,
      url: buildSourceUrl(ecli),
      date: context.date,
      chamber: context.chamber,
      solution: context.solution,
    });
  }

  // Extract pourvoi numbers (e.g., n° 21-12.345, 21-12345, 2021-12345)
  const pourvoiRegex =
    /(?:n[°o]\s*|(?:pourvoi|Pourvoi)\s+(?:n[°o]\s*)?)(\d{2,4}[-/.]\d{2,5}(?:\.\d+)?)/g;
  for (const match of text.matchAll(pourvoiRegex)) {
    const ref = match[1];
    const fullRef = `n° ${ref}`;
    if (seen.has(ref)) continue;
    seen.add(ref);

    const context = extractContext(text, match.index!, match[0]);
    sources.push({
      type: "pourvoi",
      reference: fullRef,
      url: buildSourceUrl(ref),
      date: context.date,
      chamber: context.chamber,
      solution: context.solution,
    });
  }

  // Extract Cass. references without pourvoi number (e.g., "Cass. soc., 25 novembre 2020")
  const cassRegex =
    /Cass\.\s*(soc|civ\s*[123]|com|crim|ass\.\s*plén|ch\.\s*mixte)[.,]\s*(\d{1,2}\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+\d{4})/gi;
  for (const match of text.matchAll(cassRegex)) {
    const ref = match[0].trim().replace(/,?\s*$/, "");
    if (seen.has(ref)) continue;
    seen.add(ref);

    sources.push({
      type: "decision",
      reference: ref,
      url: buildSourceUrl(ref),
      date: match[2],
      chamber: match[1],
      solution: "",
    });
  }

  return sources;
}

/**
 * Extract date, chamber, and solution from surrounding text context
 */
function extractContext(
  text: string,
  index: number,
  _ref: string
): { date: string; chamber: string; solution: string } {
  // Get surrounding ~300 chars
  const start = Math.max(0, index - 200);
  const end = Math.min(text.length, index + 200);
  const ctx = text.slice(start, end);

  // Date patterns: "15 mars 2023", "2023-03-15", "15/03/2023"
  const dateMatch =
    ctx.match(
      /(\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4})/i
    ) ||
    ctx.match(/(\d{4}-\d{2}-\d{2})/) ||
    ctx.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  const date = dateMatch ? dateMatch[1] : "";

  // Chamber patterns
  const chamberMatch = ctx.match(
    /(Chambre\s+(?:sociale|civile|commerciale|criminelle|mixte)|Assembl[ée]e?\s+pl[ée]ni[èe]re|(?:1[eè]re|2[eè]me|3[eè]me)\s+chambre\s+civile|Cour\s+de\s+cassation|CA\s+\w+|CPH\s+\w+)/i
  );
  const chamber = chamberMatch ? chamberMatch[1] : "";

  // Solution patterns
  const solutionMatch = ctx.match(
    /(cassation(?:\s+partielle)?|rejet|irrecevabilit[ée]|non-lieu|annulation|confirmation|infirmation)/i
  );
  const solution = solutionMatch ? solutionMatch[1] : "";

  return { date, chamber, solution };
}

/**
 * Extract all years mentioned in source dates
 */
function extractSourceYears(text: string): number[] {
  const years: number[] = [];
  const yearRegex = /(?:19|20)\d{2}/g;
  // Only from date-like contexts
  const dateContexts = text.matchAll(
    /(?:\d{1,2}\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+((?:19|20)\d{2})|\b((?:19|20)\d{2})-\d{2}-\d{2})/gi
  );
  for (const m of dateContexts) {
    const y = parseInt(m[1] || m[2]);
    if (y && !isNaN(y)) years.push(y);
  }
  // Also try ECLI years
  const ecliYears = text.matchAll(/ECLI:[A-Z]{2}:[A-Z]+:((?:19|20)\d{2}):/g);
  for (const m of ecliYears) {
    years.push(parseInt(m[1]));
  }
  return years;
}

/**
 * Detect potential hallucination indicators
 */
function detectHallucinationRisk(text: string, sources: SourceReference[]): { risk: "faible" | "moyen" | "eleve"; indicators: string[] } {
  const indicators: string[] = [];

  // Check for vague references without precise numbers
  const vagueRefs = (text.match(/jurisprudence\s+constante|selon\s+la\s+jurisprudence|la\s+cour\s+a\s+jug[ée]/gi) || []).length;
  const preciseRefs = sources.length;

  if (vagueRefs > preciseRefs * 2 && preciseRefs < 3) {
    indicators.push("Nombreuses references vagues sans numero de pourvoi precis");
  }

  // Check for suspiciously round statistics
  const roundStats = (text.match(/\b(?:50|60|70|80|90|100)\s*%/g) || []).length;
  const totalStats = (text.match(/\d{1,3}\s*%/g) || []).length;
  if (totalStats > 3 && roundStats / totalStats > 0.6) {
    indicators.push("Statistiques majoritairement arrondies (precision a verifier)");
  }

  // Check for "Connaissance consolidee" without precise refs
  const consolideeCount = (text.match(/Connaissance\s+consolidee/gi) || []).length;
  if (consolideeCount > 5 && preciseRefs < 3) {
    indicators.push("Sources majoritairement issues des connaissances du modele (non verifiables en temps reel)");
  }

  const risk = indicators.length >= 2 ? "eleve" : indicators.length === 1 ? "moyen" : "faible";
  return { risk, indicators };
}

/**
 * Calcule l'indice de fiabilité à partir des 4 composantes A/B/C/D
 * conformes à la Règle 3 :
 *   indice = (A × 0,35) + (B × 0,25) + (C × 0,20) + (D × 0,20)
 *
 * Toutes les composantes sont en %, l'indice résultant aussi.
 * Cette fonction est l'unique source de vérité de la formule — appelée
 * côté serveur (avec les vraies stats du corpus) et côté client (en
 * fallback si les stats serveur ne sont pas dispo).
 */
export function computeFiabiliteFromFormula(
  A: number,
  B: number,
  C: number,
  D: number
): FiabiliteScore {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const a = clamp(A);
  const b = clamp(B);
  const c = clamp(C);
  const d = clamp(D);
  const raw = a * 0.35 + b * 0.25 + c * 0.2 + d * 0.2;
  const score = Math.round(raw * 10) / 10;

  let label: FiabiliteScore["label"];
  if (score >= 80) label = "Tres eleve";
  else if (score >= 60) label = "Eleve";
  else if (score >= 40) label = "Moyen";
  else if (score >= 20) label = "Faible";
  else label = "Tres faible";

  const factors: FiabiliteFactor[] = [
    {
      name: "A · Cohérence jurisprudentielle (×0,35)",
      score: Math.round(a),
      maxScore: 100,
      description: `${Math.round(a)}% de décisions vont dans le même sens (favorable ou défavorable). Élevé = jurisprudence univoque ; bas = jurisprudence partagée.`,
      impact: a >= 70 ? "positive" : a >= 40 ? "neutral" : "negative",
    },
    {
      name: "B · Représentativité du corpus (×0,25)",
      score: Math.round(b),
      maxScore: 100,
      description: `Ratio entre le nombre de décisions analysées et le seuil cible de 30. ${b >= 100 ? "Seuil atteint." : `${Math.round(b)}% du seuil — élargir la recherche pour augmenter la fiabilité.`}`,
      impact: b >= 80 ? "positive" : b >= 50 ? "neutral" : "negative",
    },
    {
      name: "C · Diversité juridictionnelle (×0,20)",
      score: Math.round(c),
      maxScore: 100,
      description:
        c >= 100
          ? "Au moins deux niveaux de juridiction représentés (1er degré, CA, Cass., CE)."
          : c >= 50
            ? "Un seul niveau de juridiction représenté."
            : "Toutes les décisions du même tribunal — diversité quasi nulle.",
      impact: c >= 100 ? "positive" : c >= 50 ? "neutral" : "negative",
    },
    {
      name: "D · Récence des décisions (×0,20)",
      score: Math.round(d),
      maxScore: 100,
      description: `${Math.round(d)}% des décisions datent de moins de 5 ans. Au-delà de cet horizon, les orientations jurisprudentielles peuvent avoir évolué.`,
      impact: d >= 60 ? "positive" : d >= 30 ? "neutral" : "negative",
    },
  ];

  const details = `(${Math.round(a)} × 0,35) + (${Math.round(b)} × 0,25) + (${Math.round(c)} × 0,20) + (${Math.round(d)} × 0,20) = ${score}`;

  return { score, label, details, factors, formula: { A: a, B: b, C: c, D: d } };
}

/**
 * Fallback côté client quand les stats serveur ne sont pas disponibles
 * (analyses anciennes, avant la migration 00018). Approxime A/B/C/D depuis
 * le texte parsé. Toujours moins fiable qu'un calcul serveur.
 */
function computeFiabilite(
  sources: SourceReference[],
  echantillon: number | null,
  _confiance: string | null,
  text: string
): FiabiliteScore {
  void _confiance;
  // Estimations de A/B/C/D depuis le texte parsé (pas idéal — la version
  // serveur, calculée sur le corpus réel, est utilisée en priorité).
  const total = echantillon ?? sources.length;

  // A — Cohérence : on tente de lire les compteurs Favorables/Défavorables
  // depuis la synthèse du tableau.
  const favMatch = text.match(/(\d+)\s+favorables?/i);
  const defMatch = text.match(/(\d+)\s+d[ée]favorables?/i);
  const fav = favMatch ? parseInt(favMatch[1], 10) : 0;
  const def = defMatch ? parseInt(defMatch[1], 10) : 0;
  const A = total > 0 ? (Math.max(fav, def) / total) * 100 : 0;

  // B — Représentativité : total / 30, plafonné à 100 %.
  const B = Math.min(100, (total / 30) * 100);

  // C — Diversité juridictionnelle : depuis les mentions de juridictions.
  const lower = text.toLowerCase();
  const hasCass =
    /cass\.|cour de cassation|chambre sociale|chambre commerciale|chambre criminelle|chambre civile/.test(
      lower
    );
  const hasCA = /cour d['’ ]?appel/i.test(text);
  const hasFond =
    /1[èeé]re? instance|tribunal judiciaire|tribunal de commerce|cph|conseil de prud['’]hommes|tgi|tribunal correctionnel/i.test(
      text
    );
  const hasCE = /conseil d['’ ]?[Ée]tat/i.test(text);
  const cats = [hasCass, hasCA, hasFond, hasCE].filter(Boolean).length;
  const C = cats >= 2 ? 100 : cats === 1 ? 50 : 0;

  // D — Récence : extrait les années des sources et calcule le % < 5 ans.
  const years = extractSourceYears(text);
  const currentYear = new Date().getFullYear();
  const D =
    years.length > 0
      ? (years.filter((y) => y >= currentYear - 5).length / years.length) * 100
      : 0;

  return computeFiabiliteFromFormula(A, B, C, D);
}

/**
 * Extract detailed sources from the "Annexe des sources" section
 */
function extractDetailedSources(text: string): DetailedSource[] {
  const sources: DetailedSource[] = [];

  // Find the "Annexe des sources" section
  const annexeMatch = text.match(/## (?:.*?)?Annexe des sources(.*?)(?=\n## |$)/is);
  if (!annexeMatch) return sources;

  const annexeText = annexeMatch[1];

  // Split by ### headers (each is a source entry)
  const entryRegex = /###\s+(.+)/g;
  const entryStarts: Array<{ ref: string; start: number }> = [];
  let m;
  while ((m = entryRegex.exec(annexeText)) !== null) {
    // Strip markdown from reference header
    const cleanRef = m[1].trim().replace(/\*{1,2}/g, "").replace(/\[([^\]]*)\]/g, "$1").trim();
    entryStarts.push({ ref: cleanRef, start: m.index });
  }

  for (let i = 0; i < entryStarts.length; i++) {
    const start = entryStarts[i].start;
    const end = i + 1 < entryStarts.length ? entryStarts[i + 1].start : annexeText.length;
    const block = annexeText.slice(start, end);
    const ref = entryStarts[i].ref;

    // Strip markdown formatting (**, *, ##, [], etc.) from a value
    const stripMd = (s: string): string =>
      s.replace(/\*{1,2}/g, "").replace(/^#+\s*/, "").replace(/\[([^\]]*)\]/g, "$1").trim();

    const getField = (pattern: RegExp): string => {
      const match = block.match(pattern);
      return match ? stripMd(match[1]) : "";
    };

    const juridiction = getField(/[-•*]\s*\*?\*?Juridiction\*?\*?\s*[:：]\s*(.+)/i);
    const chambre = getField(/[-•*]\s*\*?\*?Chambre\*?\*?\s*[:：]\s*(.+)/i);
    const date = getField(/[-•*]\s*\*?\*?Date\*?\*?\s*[:：]\s*(.+)/i);
    const solution = getField(/[-•*]\s*\*?\*?Solution\*?\*?\s*[:：]\s*(.+)/i);
    const source = getField(/[-•*]\s*\*?\*?Source\*?\*?\s*[:：]\s*(.+)/i);
    const pertinenceRaw = getField(/[-•*]\s*\*?\*?Pertinence\*?\*?\s*[:：]\s*(.+)/i).toLowerCase();
    const apport = getField(/[-•*]\s*\*?\*?Apport\*?\*?\s*[:：]\s*(.+)/i);

    let pertinence: DetailedSource["pertinence"] = "";
    if (pertinenceRaw.includes("favorable") && !pertinenceRaw.includes("defavorable") && !pertinenceRaw.includes("défavorable")) {
      pertinence = "favorable";
    } else if (pertinenceRaw.includes("defavorable") || pertinenceRaw.includes("défavorable")) {
      pertinence = "defavorable";
    } else if (pertinenceRaw.includes("neutre")) {
      pertinence = "neutre";
    }

    // Build URL from reference — use the smart URL builder
    const url = buildSourceUrl(ref);

    sources.push({
      reference: ref,
      juridiction,
      chambre,
      date,
      solution,
      source: source.replace(/[\[\]]/g, ""),
      pertinence,
      apport,
      url,
    });
  }

  return sources;
}

/**
 * Extract the evidence table from the "Tableau de preuve statistique" section
 */
function extractEvidenceTable(text: string): EvidenceTable | null {
  // Find the section
  const sectionMatch = text.match(/## (?:.*?)?Tableau de preuve(.*?)(?=\n## |$)/is);
  if (!sectionMatch) return null;

  const sectionText = sectionMatch[1];

  // Find markdown table: lines starting with |
  const lines = sectionText.split("\n").map((l) => l.trim()).filter(Boolean);
  const tableLines = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));

  if (tableLines.length < 3) return null; // Need header + separator + at least 1 row

  // Parse header
  const headerLine = tableLines[0];
  const headers = headerLine
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean);

  if (headers.length < 2) return null;

  // Skip separator line (index 1), parse data rows
  const rows: EvidenceTableRow[] = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i]
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length); // Remove empty first/last from split

    // Skip synthesis rows that span columns (contain "Synthese", "TOTAL", etc.)
    const firstCell = cells[0]?.toLowerCase() || "";
    if (firstCell.includes("synthese") || firstCell.includes("total") || firstCell.includes("moyenne")) {
      continue;
    }

    if (cells.length >= 2) {
      const row: EvidenceTableRow = {};
      headers.forEach((header, idx) => {
        row[header] = (cells[idx] || "").replace(/\*{1,2}/g, "");
      });
      rows.push(row);
    }
  }

  if (rows.length === 0) return null;

  // Extract synthesis text blocks below the table
  // Strip markdown bold markers before matching to handle **Synthese du tableau** : ...
  const afterTable = (sectionText.split(tableLines[tableLines.length - 1]).pop() || "").replace(/\*{1,2}/g, "");
  const syntheseMatch = afterTable.match(/synth[eè]se\s*(?:du\s+tableau)?\s*[:：]\s*(.+)/i);
  const periodeMatch = afterTable.match(/p[eé]riode\s*(?:couverte)?\s*[:：]\s*(.+)/i);
  const interpreMatch = afterTable.match(/(?:ce\s+que\s+cela\s+signifie|signification)\s*(?:pour\s+votre\s+dossier)?\s*[:：]\s*(.+)/i);
  const facteursMatch = afterTable.match(/facteurs?\s*d[eé]terminants?\s*[:：]\s*(.+)/i);
  const recentesMatch = afterTable.match(/d[eé]cisions?\s*r[eé]centes?\s*[:：]\s*(.+)/i);

  return {
    headers,
    rows,
    synthese: syntheseMatch ? syntheseMatch[1].trim() : "",
    periode: periodeMatch ? periodeMatch[1].trim() : "",
    interpretation: interpreMatch ? interpreMatch[1].trim() : "",
    facteursDeterminants: facteursMatch ? facteursMatch[1].trim() : "",
  };
}

/**
 * Build evidence table from detailed sources (fallback when no markdown table in response)
 */
function buildEvidenceTableFromSources(sources: DetailedSource[]): EvidenceTable {
  const headers = ["N°", "Decision", "Juridiction", "Chambre", "Date", "Solution", "Pertinence", "Source"];
  const rows: EvidenceTableRow[] = sources.map((s, i) => ({
    "N°": String(i + 1),
    "Decision": s.reference,
    "Juridiction": s.juridiction,
    "Chambre": s.chambre,
    "Date": s.date,
    "Solution": s.solution,
    "Pertinence": s.pertinence === "favorable" ? "Favorable" : s.pertinence === "defavorable" ? "Defavorable" : s.pertinence === "neutre" ? "Nuance" : "",
    "Source": s.source,
  }));

  const favorable = sources.filter((s) => s.pertinence === "favorable").length;
  const defavorable = sources.filter((s) => s.pertinence === "defavorable").length;
  const nuance = sources.length - favorable - defavorable;
  const pctFav = sources.length > 0 ? Math.round((favorable / sources.length) * 100) : 0;

  // Extract date range
  const dates = sources.map((s) => s.date).filter(Boolean);
  const periode = dates.length >= 2 ? `${dates[dates.length - 1]} a ${dates[0]}` : dates.length === 1 ? dates[0] : "";

  return {
    headers,
    rows,
    synthese: `Sur ${sources.length} decisions, ${favorable} favorables (${pctFav}%), ${defavorable} defavorables, ${nuance} nuancees.`,
    periode,
    interpretation: "",
    facteursDeterminants: "",
  };
}

/**
 * Build evidence table from basic source references (second fallback)
 */
function buildEvidenceTableFromBasicSources(sources: SourceReference[]): EvidenceTable {
  const headers = ["N°", "Decision", "Chambre", "Date", "Solution"];
  const rows: EvidenceTableRow[] = sources.map((s, i) => ({
    "N°": String(i + 1),
    "Decision": s.reference,
    "Chambre": s.chamber,
    "Date": s.date,
    "Solution": s.solution,
  }));

  return {
    headers,
    rows,
    synthese: `${sources.length} decisions de justice identifiees et referencees.`,
    periode: "",
    interpretation: "",
    facteursDeterminants: "",
  };
}

export function parseAnalysisResponse(text: string): ParsedAnalysis {
  const result: ParsedAnalysis = {
    situation: "",
    recherche: "",
    tauxSuccesGlobal: null,
    echantillon: null,
    confiance: null,
    arguments: [],
    juridictions: [],
    instances: [],
    montants: { min: null, median: null, max: null },
    recommandation: "",
    decisionsClés: "",
    limites: "",
    sources: [],
    detailedSources: [],
    sourceCount: 0,
    article700: null,
    evidenceTable: null,
    fiabilite: { score: 0, label: "Tres faible", details: "", factors: [] },
    sections: [],
  };

  // Split by ## sections
  const sectionRegex = /^## (.+)$/gm;
  const sectionStarts: Array<{ title: string; start: number }> = [];
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    sectionStarts.push({ title: match[1], start: match.index });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].start;
    const end =
      i + 1 < sectionStarts.length ? sectionStarts[i + 1].start : text.length;
    const title = sectionStarts[i].title;
    const content = text
      .slice(start, end)
      .replace(/^## .+\n/, "")
      .trim();

    // Extract emoji from title
    const emojiMatch = title.match(/^(\S+)\s+(.+)$/);
    const emoji = emojiMatch ? emojiMatch[1] : "";
    const cleanTitle = emojiMatch ? emojiMatch[2] : title;

    result.sections.push({ title: cleanTitle, content, emoji });

    // Parse specific sections
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes("analyse de la situation") || lowerTitle.includes("resume de la situation")) {
      result.situation = content;
    }
    if (lowerTitle.includes("recherche") || (lowerTitle === "sources")) {
      result.recherche = content;
    }
    // Compatible avec anciens titres ("Recommandations") et nouveaux ("Points d'attention")
    if (
      lowerTitle.includes("recommandation") ||
      lowerTitle.includes("points d'attention") ||
      lowerTitle.includes("point d'attention") ||
      lowerTitle.includes("points d’attention") ||
      lowerTitle.includes("point d’attention")
    ) {
      result.recommandation = content;
    }
    if (
      lowerTitle.includes("décisions clés") ||
      lowerTitle.includes("decisions clés") ||
      lowerTitle.includes("decisions cles")
    ) {
      result.decisionsClés = content;
    }
    if (lowerTitle.includes("limites")) {
      result.limites = content;
    }
    // "Tableau de preuve" is handled separately by extractEvidenceTable
  }

  // Extract global success rate
  const tauxMatch =
    text.match(
      /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:sur|de succès|d['']annulation|de réussite|favorable)/i
    ) ||
    text.match(
      /taux\s+(?:de\s+)?(?:succès|annulation|réussite)\s*(?:global)?\s*[:\-—]\s*(?:environ\s+)?(\d{1,3}(?:[.,]\d+)?)\s*%/i
    );
  if (tauxMatch) {
    result.tauxSuccesGlobal = parseFloat(tauxMatch[1].replace(",", "."));
  }

  // Extract sample size
  const sampleMatch =
    text.match(
      /(?:échantillon|sample|sur)\s+(?:de\s+)?(\d+)\s+décision/i
    ) || text.match(/(\d+)\s+décision/i);
  if (sampleMatch) {
    result.echantillon = parseInt(sampleMatch[1]);
  }

  // Extract confidence level
  if (text.match(/confiance\s*:\s*[ée]lev[ée]/i)) result.confiance = "élevé";
  else if (text.match(/confiance\s*:\s*moyen/i)) result.confiance = "moyen";
  else if (text.match(/confiance\s*:\s*faible/i)) result.confiance = "faible";

  // Try to extract argument success rates from "Par argument" section
  const argSection = text.match(/### Par argument.*?(?=###|## |$)/is);
  if (argSection) {
    const argLines = argSection[0].matchAll(
      /[-•*]\s*\*?\*?(.+?)\*?\*?\s*[:\-—]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g
    );
    for (const m of argLines) {
      result.arguments.push({
        name: m[1].trim().replace(/\*+/g, ""),
        taux: parseFloat(m[2].replace(",", ".")),
        invoque: null,
        retenu: null,
      });
    }
  }

  // Extract jurisdiction stats
  const jurSection = text.match(/### Par juridiction.*?(?=###|## |$)/is);
  if (jurSection) {
    const jurLines = jurSection[0].matchAll(
      /[-•*]\s*\*?\*?(.+?)\*?\*?\s*[:\-—]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g
    );
    for (const m of jurLines) {
      result.juridictions.push({
        name: m[1].trim().replace(/\*+/g, ""),
        taux: parseFloat(m[2].replace(",", ".")),
        delai: null,
      });
    }
  }

  // Extract instance stats
  const instSection = text.match(/### Par instance.*?(?=###|## |$)/is);
  if (instSection) {
    const instText = instSection[0];
    const instLines = instText.matchAll(
      /[-•*]\s*\*?\*?(.+?)\*?\*?\s*[:\-—]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g
    );
    for (const m of instLines) {
      const name = m[1].trim().replace(/\*+/g, "");
      const taux = parseFloat(m[2].replace(",", "."));
      // Try to extract total and gagnees from surrounding context
      const nameEscaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const contextMatch = instText.match(
        new RegExp(nameEscaped + "[\\s\\S]{0,200}?(\\d+)\\s*(?:decisions?|d[ée]cisions?)\\s*(?:analys[ée]es?|total)?[\\s\\S]{0,100}?(\\d+)\\s*(?:decisions?|d[ée]cisions?)\\s*(?:gagn[ée]es?|favorable)", "i")
      );
      const totalMatch = instText.match(
        new RegExp(nameEscaped + "[\\s\\S]{0,300}?(?:sur|Sur)\\s+(\\d+)\\s+(?:decisions?|d[ée]cisions?)", "i")
      );
      let total: number | null = null;
      let gagnees: number | null = null;
      if (contextMatch) {
        total = parseInt(contextMatch[1]);
        gagnees = parseInt(contextMatch[2]);
      } else if (totalMatch) {
        total = parseInt(totalMatch[1]);
        gagnees = total !== null && taux !== null ? Math.round(total * taux / 100) : null;
      }
      result.instances.push({ name, taux, total, gagnees });
    }
  }

  // Extract amounts
  const montantSection = text.match(/### Montants.*?(?=###|## |$)/is);
  if (montantSection) {
    const amounts = montantSection[0].matchAll(/(\d[\d\s.,]*)\s*€/g);
    const parsed: number[] = [];
    for (const m of amounts) {
      const val = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
      if (!isNaN(val)) parsed.push(val);
    }
    if (parsed.length >= 1) result.montants.min = Math.min(...parsed);
    if (parsed.length >= 2) result.montants.max = Math.max(...parsed);
    if (parsed.length >= 3) {
      parsed.sort((a, b) => a - b);
      result.montants.median = parsed[Math.floor(parsed.length / 2)];
    }
  }

  // Extract Article 700 CPC stats
  const art700Section = text.match(/###\s*Article\s*700.*?(?=###|## |$)/is);
  if (art700Section) {
    // Strip markdown bold markers before matching to handle **Taux de condamnation** : ...
    const art700Text = art700Section[0].replace(/\*{1,2}/g, "");
    const tauxCond = art700Text.match(/taux\s+(?:de\s+)?condamnation\s*[:\-—]\s*(?:environ\s+)?(\d{1,3}(?:[.,]\d+)?)\s*%/i);
    const moyenMatch = art700Text.match(/montant\s+moyen\s*[:\-—]\s*(?:environ\s+)?(\d[\d\s.,]*)\s*(?:€|euros?)/i);
    const medianMatch = art700Text.match(/montant\s+m[ée]dian\s*[:\-—]\s*(?:environ\s+)?(\d[\d\s.,]*)\s*(?:€|euros?)/i);
    result.article700 = {
      tauxCondamnation: tauxCond ? parseFloat(tauxCond[1].replace(",", ".")) : null,
      montantMoyen: moyenMatch ? parseFloat(moyenMatch[1].replace(/\s/g, "").replace(",", ".")) : null,
      montantMedian: medianMatch ? parseFloat(medianMatch[1].replace(/\s/g, "").replace(",", ".")) : null,
    };
    // If we found at least one value but missed taux, try alternative pattern
    if (result.article700.tauxCondamnation === null) {
      const altTaux = art700Text.match(/(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:des?\s+)?(?:cas|d[ée]cisions|condamnation)/i);
      if (altTaux) result.article700.tauxCondamnation = parseFloat(altTaux[1].replace(",", "."));
    }
  } else {
    result.article700 = null;
  }

  // Extract sources
  result.sources = extractSources(text);
  result.sourceCount = result.sources.length;

  // Extract detailed sources from "Annexe des sources" section
  result.detailedSources = extractDetailedSources(text);

  // Extract evidence table
  result.evidenceTable = extractEvidenceTable(text);

  // Fallback: build evidence table from detailedSources if no dedicated section
  if (!result.evidenceTable && result.detailedSources.length > 0) {
    result.evidenceTable = buildEvidenceTableFromSources(result.detailedSources);
  }
  // Second fallback: build from basic sources
  if (!result.evidenceTable && result.sources.length > 0) {
    result.evidenceTable = buildEvidenceTableFromBasicSources(result.sources);
  }

  // Compute fiabilite
  result.fiabilite = computeFiabilite(
    result.sources,
    result.echantillon,
    result.confiance,
    text
  );

  return result;
}
