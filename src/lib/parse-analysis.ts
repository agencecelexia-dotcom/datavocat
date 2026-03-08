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

export interface FiabiliteScore {
  score: number; // 0-100
  label: "Tres eleve" | "Eleve" | "Moyen" | "Faible" | "Tres faible";
  details: string;
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
  instances: Array<{ name: string; taux: number | null }>;
  montants: { min: number | null; median: number | null; max: number | null };
  recommandation: string;
  decisionsClés: string;
  limites: string;
  sources: SourceReference[];
  sourceCount: number;
  fiabilite: FiabiliteScore;
  sections: Array<{ title: string; content: string; emoji: string }>;
}

/**
 * Build a clickable URL for a French court decision reference
 */
function buildSourceUrl(ecli: string): string {
  // Legifrance search by ECLI
  if (ecli.startsWith("ECLI:")) {
    return `https://www.legifrance.gouv.fr/search/juri?query=${encodeURIComponent(ecli)}`;
  }
  // Pourvoi number search
  return `https://www.legifrance.gouv.fr/search/juri?query=${encodeURIComponent(ecli)}`;
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
 * Compute fiabilite score based on analysis quality indicators
 */
function computeFiabilite(
  sources: SourceReference[],
  echantillon: number | null,
  confiance: string | null,
  text: string
): FiabiliteScore {
  let score = 0;
  const factors: string[] = [];

  // Factor 1: Number of real sources (ECLI/pourvoi) — up to 40 points
  const sourcePoints = Math.min(sources.length * 5, 40);
  score += sourcePoints;
  if (sources.length > 0) {
    factors.push(`${sources.length} decision${sources.length > 1 ? "s" : ""} reelle${sources.length > 1 ? "s" : ""} citee${sources.length > 1 ? "s" : ""}`);
  } else {
    factors.push("Aucune decision reelle citee");
  }

  // Factor 2: Sample size — up to 25 points
  if (echantillon !== null) {
    const samplePoints = echantillon >= 50 ? 25 : echantillon >= 20 ? 20 : echantillon >= 10 ? 15 : echantillon >= 5 ? 10 : 5;
    score += samplePoints;
    factors.push(`Echantillon de ${echantillon} decisions`);
  }

  // Factor 3: Judilibre data present — up to 20 points
  if (text.includes("JUDILIBRE") || text.includes("Judilibre") || text.includes("ECLI:FR:CCASS")) {
    score += 20;
    factors.push("Donnees Judilibre exploitees");
  } else {
    factors.push("Pas de donnees Judilibre");
  }

  // Factor 4: Confidence level — up to 15 points
  if (confiance === "élevé") {
    score += 15;
  } else if (confiance === "moyen") {
    score += 10;
  } else if (confiance === "faible") {
    score += 5;
  }

  score = Math.min(score, 100);

  let label: FiabiliteScore["label"];
  if (score >= 80) label = "Tres eleve";
  else if (score >= 60) label = "Eleve";
  else if (score >= 40) label = "Moyen";
  else if (score >= 20) label = "Faible";
  else label = "Tres faible";

  return { score, label, details: factors.join(" · ") };
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
    sourceCount: 0,
    fiabilite: { score: 0, label: "Tres faible", details: "" },
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

    if (lowerTitle.includes("analyse de la situation")) {
      result.situation = content;
    }
    if (lowerTitle.includes("recherche")) {
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
    const instLines = instSection[0].matchAll(
      /[-•*]\s*\*?\*?(.+?)\*?\*?\s*[:\-—]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g
    );
    for (const m of instLines) {
      result.instances.push({
        name: m[1].trim().replace(/\*+/g, ""),
        taux: parseFloat(m[2].replace(",", ".")),
      });
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

  // Extract sources
  result.sources = extractSources(text);
  result.sourceCount = result.sources.length;

  // Compute fiabilite
  result.fiabilite = computeFiabilite(
    result.sources,
    result.echantillon,
    result.confiance,
    text
  );

  return result;
}
