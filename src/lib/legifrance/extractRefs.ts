/**
 * Extraction des références d'articles de loi citées dans un texte (query
 * utilisateur ou rapport généré).
 *
 * Patterns reconnus :
 *   "art. L1232-1"            → { num: "L1232-1" }
 *   "article L. 1232-1"       → { num: "L1232-1" }
 *   "L1232-1 du Code du travail" → { num: "L1232-1", code: "Code du travail" }
 *   "art. 9 du CPC"            → { num: "9", code: "CPC" }
 *   "article 1382"             → { num: "1382" }
 *   "Art. 700 CPC"             → { num: "700", code: "CPC" }
 *   "L. 1232-1 C. trav."       → { num: "L1232-1", code: "Code du travail" }
 *
 * Les abréviations courantes de codes sont normalisées vers leur nom complet
 * Légifrance (ex: "C. trav." → "Code du travail").
 */

export interface ArticleRef {
  /** Numéro brut, normalisé sans espaces (ex: "L1232-1", "700") */
  num: string;
  /** Nom complet du code Légifrance, ou undefined si non détecté */
  code?: string;
  /** Texte original dans le document (pour debug / déduplication) */
  raw: string;
}

/**
 * Normalisation des abréviations de codes vers leur nom Légifrance officiel.
 */
const CODE_ALIASES: Record<string, string> = {
  "code du travail": "Code du travail",
  "c. trav.": "Code du travail",
  "c trav": "Code du travail",
  "code civil": "Code civil",
  "c. civ.": "Code civil",
  "c civ": "Code civil",
  "code de procédure civile": "Code de procédure civile",
  "code de procedure civile": "Code de procédure civile",
  "cpc": "Code de procédure civile",
  "c. proc. civ.": "Code de procédure civile",
  "code pénal": "Code pénal",
  "code penal": "Code pénal",
  "c. pén.": "Code pénal",
  "c pen": "Code pénal",
  "code de procédure pénale": "Code de procédure pénale",
  "cpp": "Code de procédure pénale",
  "code de commerce": "Code de commerce",
  "c. com.": "Code de commerce",
  "c com": "Code de commerce",
  "code de la consommation": "Code de la consommation",
  "code monétaire et financier": "Code monétaire et financier",
  "comofi": "Code monétaire et financier",
  "code de la santé publique": "Code de la santé publique",
  "csp": "Code de la santé publique",
  "code de la sécurité sociale": "Code de la sécurité sociale",
  "css": "Code de la sécurité sociale",
  "code général des impôts": "Code général des impôts",
  "cgi": "Code général des impôts",
  "code des assurances": "Code des assurances",
  "code de la construction et de l'habitation": "Code de la construction et de l'habitation",
  "cch": "Code de la construction et de l'habitation",
  "code de l'urbanisme": "Code de l'urbanisme",
  "code de la route": "Code de la route",
  "code rural et de la pêche maritime": "Code rural et de la pêche maritime",
  "code de l'environnement": "Code de l'environnement",
  "code de l'éducation": "Code de l'éducation",
  "code des transports": "Code des transports",
};

function normalizeCodeName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase().trim().replace(/\s+/g, " ");
  return CODE_ALIASES[key] || raw.trim();
}

function normalizeNum(num: string): string {
  // Retire espaces et points superflus, garde lettres + chiffres + tirets
  return num
    .replace(/\.\s*/g, "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/^([LRD])([0-9])/, "$1$2");
}

/**
 * Patterns détectés (en deux passes) :
 * 1. "art." / "article" / "Art." suivi d'un n° + (optionnel) " du <code>"
 * 2. Numéros L/R/D codés (L1232-1, R4121-1, etc.) précédés de "art" implicite
 */
const RE_ARTICLE_FULL =
  /\b(?:art(?:icle)?\.?)\s*([LRDA]\.?\s?\d{1,4}[-]?\d{0,4}(?:[-.\d]+)?)\s*(?:du\s+|de\s+l['']?)?(code\s+(?:du|de|d['']|général|monétaire|civil|pénal|de\s+commerce)?[^.,;:()\n]{0,60}|cpc|cpp|cgi|csp|css|cch|c\.\s*(?:trav|civ|pén|com|proc)\.?[^,;:()\n]{0,30}?)?/gi;

const RE_BARE_LRD = /\b([LRDA])[\s.]?(\d{1,4})-(\d{1,4})\b/g;

/**
 * Extrait les références d'articles d'un texte.
 * Dédoublonne par num+code.
 */
export function extractArticleRefs(text: string): ArticleRef[] {
  if (!text) return [];

  const refs = new Map<string, ArticleRef>();
  const addRef = (numRaw: string, codeRaw: string | undefined, rawMatch: string) => {
    const num = normalizeNum(numRaw);
    const code = normalizeCodeName(codeRaw);
    const key = `${num}|${code || ""}`;
    if (!refs.has(key)) {
      refs.set(key, { num, code, raw: rawMatch.trim() });
    }
  };

  let m: RegExpExecArray | null;
  RE_ARTICLE_FULL.lastIndex = 0;
  while ((m = RE_ARTICLE_FULL.exec(text)) !== null) {
    const num = m[1];
    const codeRaw = m[2];
    if (num) addRef(num, codeRaw, m[0]);
  }

  // 2ème passe : numéros L/R/D type "L1232-1" sans préfixe "art"
  RE_BARE_LRD.lastIndex = 0;
  while ((m = RE_BARE_LRD.exec(text)) !== null) {
    const lrd = m[1];
    const part1 = m[2];
    const part2 = m[3];
    addRef(`${lrd}${part1}-${part2}`, undefined, m[0]);
  }

  return Array.from(refs.values()).slice(0, 20); // safety cap
}
