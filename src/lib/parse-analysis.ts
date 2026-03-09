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
  detailedSources: DetailedSource[];
  sourceCount: number;
  fiabilite: FiabiliteScore;
  article700: {
    tauxCondamnation: number | null;
    montantMoyen: number | null;
    montantMedian: number | null;
  } | null;
  sections: Array<{ title: string; content: string; emoji: string }>;
}

/**
 * Build a clickable URL for a French court decision reference
 */
function buildSourceUrl(ref: string): string {
  // ECLI → Cour de cassation direct decision page
  if (ref.startsWith("ECLI:")) {
    return `https://www.courdecassation.fr/decision/${encodeURIComponent(ref)}`;
  }
  // Pourvoi or other → Judilibre search
  return `https://www.courdecassation.fr/recherche-judilibre?search_api_fulltext=${encodeURIComponent(ref)}`;
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
      url: `https://www.courdecassation.fr/recherche-judilibre?search_api_fulltext=${encodeURIComponent(ref)}`,
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

  // Factor 1: Number of cited sources (ECLI/pourvoi/Cass. references) — up to 35 points
  const sourcePoints = Math.min(sources.length * 4, 35);
  score += sourcePoints;
  if (sources.length > 0) {
    factors.push(`${sources.length} reference${sources.length > 1 ? "s" : ""} citee${sources.length > 1 ? "s" : ""}`);
  }

  // Factor 2: Sample size or richness of analysis — up to 20 points
  if (echantillon !== null) {
    const samplePoints = echantillon >= 50 ? 20 : echantillon >= 20 ? 16 : echantillon >= 10 ? 12 : echantillon >= 5 ? 8 : 5;
    score += samplePoints;
    factors.push(`Echantillon de ${echantillon} decisions`);
  }

  // Factor 3: Data source quality — up to 20 points
  const hasJudilibre = text.includes("JUDILIBRE") || text.includes("Judilibre") || text.includes("ECLI:FR:CCASS");
  const hasKnowledge = text.includes("Connaissance consolidee") || text.includes("connaissance") || text.includes("jurisprudence constante");
  if (hasJudilibre) {
    score += 20;
    factors.push("Donnees Judilibre verifiees");
  } else if (hasKnowledge || sources.length >= 3) {
    score += 12;
    factors.push("Connaissances jurisprudentielles consolidees");
  }

  // Factor 4: Confidence level — up to 10 points
  if (confiance === "élevé") {
    score += 10;
  } else if (confiance === "moyen") {
    score += 7;
  } else if (confiance === "faible") {
    score += 3;
  }

  // Factor 5: Content richness — up to 15 points
  const hasStats = text.includes("%");
  const hasRecommandation = text.toLowerCase().includes("recommandation");
  const hasDecisionsCles = text.toLowerCase().includes("decisions cles") || text.toLowerCase().includes("décisions clés");
  const hasMontants = text.includes("€");
  const richnessScore = (hasStats ? 4 : 0) + (hasRecommandation ? 4 : 0) + (hasDecisionsCles ? 4 : 0) + (hasMontants ? 3 : 0);
  score += richnessScore;
  if (richnessScore >= 10) factors.push("Analyse complete et detaillee");

  score = Math.min(score, 100);

  let label: FiabiliteScore["label"];
  if (score >= 80) label = "Tres eleve";
  else if (score >= 60) label = "Eleve";
  else if (score >= 40) label = "Moyen";
  else if (score >= 20) label = "Faible";
  else label = "Tres faible";

  return { score, label, details: factors.join(" · ") };
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

    // Build URL from reference
    let url = "";
    const ecliMatch = ref.match(/ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+/);
    if (ecliMatch) {
      url = buildSourceUrl(ecliMatch[0]);
    } else {
      const pourvoiMatch = ref.match(/(\d{2,4}[-/.]\d{2,5}(?:\.\d+)?)/);
      if (pourvoiMatch) {
        url = buildSourceUrl(pourvoiMatch[1]);
      } else {
        url = `https://www.courdecassation.fr/recherche-judilibre?search_api_fulltext=${encodeURIComponent(ref)}`;
      }
    }

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

  // Extract Article 700 CPC stats
  const art700Section = text.match(/###\s*Article\s*700.*?(?=###|## |$)/is);
  if (art700Section) {
    const art700Text = art700Section[0];
    const tauxCond = art700Text.match(/taux\s+(?:de\s+)?condamnation\s*[:\-—]\s*(?:environ\s+)?(\d{1,3}(?:[.,]\d+)?)\s*%/i);
    const moyenMatch = art700Text.match(/montant\s+moyen\s*[:\-—]\s*(?:environ\s+)?(\d[\d\s.,]*)\s*€/i);
    const medianMatch = art700Text.match(/montant\s+m[ée]dian\s*[:\-—]\s*(?:environ\s+)?(\d[\d\s.,]*)\s*€/i);
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

  // Compute fiabilite
  result.fiabilite = computeFiabilite(
    result.sources,
    result.echantillon,
    result.confiance,
    text
  );

  return result;
}
