/**
 * Parse a DATAVOCAT structured markdown response into visual data
 */

export interface ParsedAnalysis {
  situation: string;
  recherche: string;
  tauxSuccesGlobal: number | null;
  echantillon: number | null;
  confiance: "faible" | "moyen" | "élevé" | null;
  arguments: Array<{ name: string; taux: number | null; invoque: number | null; retenu: number | null }>;
  juridictions: Array<{ name: string; taux: number | null; delai: string | null }>;
  instances: Array<{ name: string; taux: number | null }>;
  montants: { min: number | null; median: number | null; max: number | null };
  recommandation: string;
  decisionsClés: string;
  limites: string;
  sections: Array<{ title: string; content: string; emoji: string }>;
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
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].start : text.length;
    const title = sectionStarts[i].title;
    const content = text.slice(start, end).replace(/^## .+\n/, "").trim();

    // Extract emoji from title
    const emojiMatch = title.match(/^(\S+)\s+(.+)$/);
    const emoji = emojiMatch ? emojiMatch[1] : "📄";
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
    if (lowerTitle.includes("décisions clés") || lowerTitle.includes("decisions clés")) {
      result.decisionsClés = content;
    }
    if (lowerTitle.includes("limites")) {
      result.limites = content;
    }
  }

  // Extract global success rate
  const tauxMatch = text.match(/(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:sur|de succès|d['']annulation|de réussite|favorable)/i)
    || text.match(/taux\s+(?:de\s+)?(?:succès|annulation|réussite)\s*(?:global)?\s*[:\-—]\s*(?:environ\s+)?(\d{1,3}(?:[.,]\d+)?)\s*%/i);
  if (tauxMatch) {
    result.tauxSuccesGlobal = parseFloat(tauxMatch[1].replace(",", "."));
  }

  // Extract sample size
  const sampleMatch = text.match(/(?:échantillon|sample|sur)\s+(?:de\s+)?(\d+)\s+décision/i)
    || text.match(/(\d+)\s+décision/i);
  if (sampleMatch) {
    result.echantillon = parseInt(sampleMatch[1]);
  }

  // Extract confidence level
  if (text.match(/confiance\s*:\s*élevé/i)) result.confiance = "élevé";
  else if (text.match(/confiance\s*:\s*moyen/i)) result.confiance = "moyen";
  else if (text.match(/confiance\s*:\s*faible/i)) result.confiance = "faible";

  // Try to extract argument success rates from "Par argument" section
  const argSection = text.match(/### Par argument.*?(?=###|## |$)/is);
  if (argSection) {
    const argLines = argSection[0].matchAll(/[-•*]\s*\*?\*?(.+?)\*?\*?\s*[:\-—]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g);
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
    const jurLines = jurSection[0].matchAll(/[-•*]\s*\*?\*?(.+?)\*?\*?\s*[:\-—]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g);
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
    const instLines = instSection[0].matchAll(/[-•*]\s*\*?\*?(.+?)\*?\*?\s*[:\-—]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g);
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

  return result;
}
