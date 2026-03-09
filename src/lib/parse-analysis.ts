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
}

/**
 * Build a clickable URL for a French court decision reference.
 * Prioritizes direct Legifrance links when possible, falls back to Judilibre search.
 */
function buildSourceUrl(ref: string): string {
  // ECLI references -> direct Legifrance ECLI lookup
  const ecliMatch = ref.match(/ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+/);
  if (ecliMatch) {
    return `https://www.legifrance.gouv.fr/juri/id/${encodeURIComponent(ecliMatch[0])}`;
  }

  // Pourvoi numbers -> Judilibre search with pourvoi number (most precise)
  const pourvoiMatch = ref.match(/(\d{2,4}[-/.]\d{2,5}(?:\.\d+)?)/);
  if (pourvoiMatch) {
    return `https://www.courdecassation.fr/recherche-judilibre?search_api_fulltext=${encodeURIComponent(pourvoiMatch[1])}&op=Rechercher`;
  }

  // Cass. references -> Judilibre with full text search
  return `https://www.courdecassation.fr/recherche-judilibre?search_api_fulltext=${encodeURIComponent(ref)}&op=Rechercher`;
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
 * Compute fiabilite score based on analysis quality indicators
 */
function computeFiabilite(
  sources: SourceReference[],
  echantillon: number | null,
  confiance: string | null,
  text: string
): FiabiliteScore {
  let score = 0;
  const factorsList: FiabiliteFactor[] = [];
  const summaryParts: string[] = [];
  const currentYear = new Date().getFullYear();

  // Factor 1: Number of cited sources — up to 25 points
  const sourcePoints = Math.min(sources.length * 3, 25);
  score += sourcePoints;
  factorsList.push({
    name: "Nombre de sources citees",
    score: sourcePoints,
    maxScore: 25,
    description: sources.length > 0
      ? `${sources.length} decision${sources.length > 1 ? "s" : ""} de justice identifiee${sources.length > 1 ? "s" : ""} avec reference verifiable`
      : "Aucune reference precise de decision identifiee",
    impact: sourcePoints >= 15 ? "positive" : sourcePoints >= 8 ? "neutral" : "negative",
  });
  if (sources.length > 0) summaryParts.push(`${sources.length} ref.`);

  // Factor 2: Sample size — up to 15 points
  if (echantillon !== null) {
    const samplePoints = echantillon >= 50 ? 15 : echantillon >= 20 ? 12 : echantillon >= 10 ? 9 : echantillon >= 5 ? 6 : 3;
    score += samplePoints;
    factorsList.push({
      name: "Taille de l'echantillon",
      score: samplePoints,
      maxScore: 15,
      description: `Echantillon de ${echantillon} decisions — ${echantillon >= 30 ? "base statistique solide" : echantillon >= 10 ? "echantillon convenable, a interpreter avec prudence" : "echantillon reduit, resultats indicatifs"}`,
      impact: samplePoints >= 12 ? "positive" : samplePoints >= 6 ? "neutral" : "negative",
    });
  }

  // Factor 3: Data source quality — up to 20 points
  const hasJudilibre = text.includes("JUDILIBRE") || text.includes("Judilibre") || text.includes("ECLI:FR:CCASS");
  const hasKnowledge = text.includes("Connaissance consolidee") || text.includes("connaissance") || text.includes("jurisprudence constante");
  if (hasJudilibre) {
    score += 20;
    factorsList.push({
      name: "Qualite des sources",
      score: 20,
      maxScore: 20,
      description: "Decisions issues de Judilibre (base officielle de la Cour de cassation) — verifiables en temps reel",
      impact: "positive",
    });
    summaryParts.push("Judilibre");
  } else if (hasKnowledge || sources.length >= 3) {
    score += 10;
    factorsList.push({
      name: "Qualite des sources",
      score: 10,
      maxScore: 20,
      description: "Sources issues des connaissances consolidees du modele — non verifiables en temps reel mais basees sur la jurisprudence publiee",
      impact: "neutral",
    });
    summaryParts.push("Connaissances");
  } else {
    factorsList.push({
      name: "Qualite des sources",
      score: 0,
      maxScore: 20,
      description: "Pas de source directe identifiee — resultats a considerer avec reserve",
      impact: "negative",
    });
  }

  // Factor 4: Fraicheur des sources — up to 15 points
  const years = extractSourceYears(text);
  if (years.length > 0) {
    const maxYear = Math.max(...years);
    const minYear = Math.min(...years);
    const recentCount = years.filter((y) => y >= currentYear - 5).length;
    const recentPct = Math.round((recentCount / years.length) * 100);
    const freshnessScore =
      maxYear >= currentYear - 2 ? 15 :
      maxYear >= currentYear - 5 ? 12 :
      maxYear >= currentYear - 10 ? 7 : 3;
    score += freshnessScore;

    const span = maxYear - minYear;
    let desc = `Jurisprudence de ${minYear} a ${maxYear} (${span > 0 ? span + " ans" : "meme annee"})`;
    if (recentCount > 0) {
      desc += ` — ${recentCount} source${recentCount > 1 ? "s" : ""} recente${recentCount > 1 ? "s" : ""} (${recentPct}% des ${years.length <= 5 ? "5" : String(years.length)} dernieres annees)`;
    }
    if (maxYear < currentYear - 5) {
      desc += ". Attention : aucune decision de moins de 5 ans, les orientations jurisprudentielles ont pu evoluer";
    }

    factorsList.push({
      name: "Fraicheur jurisprudentielle",
      score: freshnessScore,
      maxScore: 15,
      description: desc,
      impact: freshnessScore >= 12 ? "positive" : freshnessScore >= 7 ? "neutral" : "negative",
    });
  }

  // Factor 5: Confidence level — up to 10 points
  if (confiance === "élevé") {
    score += 10;
  } else if (confiance === "moyen") {
    score += 7;
  } else if (confiance === "faible") {
    score += 3;
  }

  // Factor 6: Content richness — up to 10 points
  const hasStats = text.includes("%");
  const hasRecommandation = text.toLowerCase().includes("recommandation");
  const hasDecisionsCles = text.toLowerCase().includes("decisions cles") || text.toLowerCase().includes("décisions clés");
  const hasMontants = text.includes("€");
  const richnessScore = (hasStats ? 3 : 0) + (hasRecommandation ? 3 : 0) + (hasDecisionsCles ? 2 : 0) + (hasMontants ? 2 : 0);
  score += richnessScore;
  factorsList.push({
    name: "Richesse de l'analyse",
    score: richnessScore,
    maxScore: 10,
    description: [
      hasStats && "statistiques",
      hasRecommandation && "recommandations",
      hasDecisionsCles && "decisions cles",
      hasMontants && "montants chiffres",
    ].filter(Boolean).join(", ") || "Analyse sommaire",
    impact: richnessScore >= 7 ? "positive" : richnessScore >= 4 ? "neutral" : "negative",
  });

  // Factor 7: Hallucination risk — penalty up to -10 points
  const hallucination = detectHallucinationRisk(text, sources);
  if (hallucination.risk !== "faible") {
    const penalty = hallucination.risk === "eleve" ? -10 : -5;
    score += penalty;
    factorsList.push({
      name: "Risque d'hallucination IA",
      score: penalty,
      maxScore: 0,
      description: hallucination.indicators.join(". "),
      impact: "negative",
    });
  } else {
    factorsList.push({
      name: "Risque d'hallucination IA",
      score: 0,
      maxScore: 0,
      description: "Aucun indicateur d'hallucination detecte — les references paraissent coherentes",
      impact: "positive",
    });
  }

  score = Math.max(0, Math.min(score, 100));

  let label: FiabiliteScore["label"];
  if (score >= 80) label = "Tres eleve";
  else if (score >= 60) label = "Eleve";
  else if (score >= 40) label = "Moyen";
  else if (score >= 20) label = "Faible";
  else label = "Tres faible";

  return { score, label, details: summaryParts.join(" · "), factors: factorsList };
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
    if (lowerTitle.includes("recommandation")) {
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
