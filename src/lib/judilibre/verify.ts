/**
 * Vérification post-génération du rapport Claude.
 *
 * Pour chaque référence ECLI / numéro de pourvoi / RG citée par Claude, on
 * vérifie qu'elle existe dans le corpus Judilibre fourni au modèle ET que
 * sa juridiction et son année correspondent. Si non — on SUPPRIME la phrase
 * entière qui la contient (ou la ligne du tableau de preuve).
 *
 * Refonte avril 2026 (Axe A) :
 *   - L'index passe de Set<string> à Map<numero, IndexEntry[]> où chaque
 *     entrée porte la juridiction et l'année. On peut ainsi détecter une
 *     ref qui matche un numéro mais avec la mauvaise juridiction (ex: RG
 *     CA "21/03476" qui matcherait un pourvoi Cass "21-03476" en mode
 *     normalisation aggressive).
 *   - Croisement avec la date extraite du contexte (±150 chars autour de
 *     la ref). Tolérance de ± 1 an pour gérer audience vs décision vs publi.
 *   - unverifiedRefs porte maintenant la raison du rejet.
 */

import type { JudilibreDecision } from "./client";

export interface UnverifiedRef {
  ref: string;
  reason: "not_in_corpus" | "wrong_jurisdiction" | "wrong_date";
}

export interface VerificationResult {
  /** Markdown nettoyé : phrases et lignes non vérifiables retirées. */
  cleanedMarkdown: string;
  /** Nombre total de refs (ECLI + pourvois + RG) citées avant nettoyage. */
  citedRefs: number;
  /** Nombre de refs présentes dans le corpus avec juridiction+date cohérentes. */
  verifiedRefs: number;
  /** Refs citées mais rejetées, avec la raison du rejet. */
  unverifiedRefs: string[];
  /** Détail enrichi (rétro-compat : on garde le tableau de strings ci-dessus). */
  unverifiedDetails: UnverifiedRef[];
  /** Nombre de phrases supprimées. */
  removedSentences: number;
  /** Nombre de lignes de tableau supprimées. */
  removedRows: number;
  /** Vrai si l'invariant N (intro/stats) a dû être patché pour matcher le tableau. */
  coherenceCorrected: boolean;
}

const ECLI_REGEX = /ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+/g;
// Capture les n° de pourvoi (Cass : "22-12345") ET les n° RG (CA : "21/03476").
const POURVOI_REGEX = /\b\d{2,4}[-/.]\d{2,6}(?:\.\d+)?\b/g;
const CETATEXT_REGEX = /CETATEXT\d{12,}/g;
const JURITEXT_REGEX = /JURI(?:TEXT|CA|HISTO)\d{12,}/g;
const CONSTEXT_REGEX = /CONSTEXT\d{12,}/g;

/** Type de référence détecté à partir de son format syntaxique. */
type RefFormat =
  | "ecli"
  | "pourvoi" // Cass : "22-12345"
  | "rg" // CA / 1er degré : "21/03476"
  | "millesime" // "2024/12345" (fond, parfois admin)
  | "cetatext"
  | "juritext"
  | "constext"
  | "unknown";

/** Juridictions compatibles selon le format de la référence. */
const COMPATIBLE_JURIDICTIONS: Record<RefFormat, string[]> = {
  ecli: ["cc", "ce", "constit", "ca", "caa"], // ECLI peut couvrir toutes
  pourvoi: ["cc"], // n° pourvoi = Cassation uniquement
  rg: ["ca", "tj", "tcom", "cph", "tgi", "ti", "ta"], // RG = juridictions du fond
  millesime: ["ca", "tj", "tcom", "cph", "ta", "caa", "ce"],
  cetatext: ["ce", "caa", "ta"],
  juritext: ["cc", "ca"],
  constext: ["constit"],
  unknown: [],
};

interface IndexEntry {
  juridiction: string;
  year: number | null;
  ecli?: string;
  decisionId: string;
}

function normalizeRef(ref: string): string {
  return ref.toUpperCase().replace(/[\s.\-/]/g, "");
}

function classifyRefFormat(ref: string): RefFormat {
  if (/^ECLI:/.test(ref)) return "ecli";
  if (/^CETATEXT\d{12,}$/.test(ref)) return "cetatext";
  if (/^JURI(?:TEXT|CA|HISTO)\d{12,}$/.test(ref)) return "juritext";
  if (/^CONSTEXT\d{12,}$/.test(ref)) return "constext";
  if (/^\d{2}-\d{4,5}$/.test(ref)) return "pourvoi";
  if (/^\d{2}\/\d{4,6}$/.test(ref)) return "rg";
  if (/^\d{4}\/\d{4,6}$/.test(ref)) return "millesime";
  return "unknown";
}

function yearFromDate(date: string | undefined): number | null {
  if (!date) return null;
  const m = date.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Construit l'index du corpus : Map<numéroNormalisé, IndexEntry[]>.
 * Chaque numéro peut renvoyer à plusieurs décisions (un même n° peut exister
 * dans des juridictions différentes — d'où la nécessité de croiser).
 */
function buildCorpusIndex(decisions: JudilibreDecision[]): Map<string, IndexEntry[]> {
  const map = new Map<string, IndexEntry[]>();
  const add = (key: string, entry: IndexEntry) => {
    const k = normalizeRef(key);
    if (!k) return;
    const arr = map.get(k) || [];
    arr.push(entry);
    map.set(k, arr);
  };

  for (const d of decisions) {
    const entry: IndexEntry = {
      juridiction: (d.jurisdiction || "").toLowerCase(),
      year: yearFromDate(d.date),
      ecli: d.ecli,
      decisionId: d.id,
    };
    if (d.ecli) add(d.ecli, entry);
    const numbers = Array.isArray(d.number)
      ? d.number
      : d.number
        ? [d.number]
        : [];
    for (const n of numbers) {
      if (n) add(n, entry);
    }
    if (d.id) add(d.id, entry);
  }
  return map;
}

/**
 * Extrait toutes les refs citées dans le markdown.
 * Couvre ECLI, pourvois, RG, IDs Légifrance directs (CETATEXT/JURITEXT/CONSTEXT).
 */
function extractRefs(markdown: string): string[] {
  const refs: string[] = [];
  for (const re of [ECLI_REGEX, CETATEXT_REGEX, JURITEXT_REGEX, CONSTEXT_REGEX]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) refs.push(m[0]);
  }
  POURVOI_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = POURVOI_REGEX.exec(markdown)) !== null) {
    const candidate = m[0];
    if (
      /^\d{2}[-]\d{4,5}$/.test(candidate) ||
      /^\d{2}\/\d{4,6}$/.test(candidate) ||
      /^\d{4}\/\d{4,6}$/.test(candidate)
    ) {
      refs.push(candidate);
    }
  }
  return Array.from(new Set(refs));
}

/**
 * Cherche une année (4 chiffres) dans le contexte autour de la ref. Retourne
 * la plus proche en distance dans le texte. Sert à croiser avec l'année du
 * corpus (tolérance ± 1 an).
 */
function extractYearFromContext(
  text: string,
  refIndex: number,
  refLength: number,
): number | null {
  const start = Math.max(0, refIndex - 150);
  const end = Math.min(text.length, refIndex + refLength + 150);
  const window = text.slice(start, end);
  const matches = [...window.matchAll(/\b(19|20)\d{2}\b/g)];
  if (matches.length === 0) return null;
  // Plus proche du milieu de la fenêtre (= position de la ref dans la fenêtre)
  const refPosInWindow = refIndex - start;
  let bestYear: number | null = null;
  let bestDist = Infinity;
  for (const m of matches) {
    const dist = Math.abs((m.index ?? 0) - refPosInWindow);
    if (dist < bestDist) {
      bestDist = dist;
      bestYear = parseInt(m[0], 10);
    }
  }
  return bestYear;
}

/** Résultat de la vérification d'une ref individuelle. */
export interface RefCheck {
  valid: boolean;
  reason?: UnverifiedRef["reason"];
  matchedDecisionId?: string;
}

/**
 * Vérifie qu'une référence existe dans le corpus avec juridiction + année
 * cohérentes. Si plusieurs entrées matchent le numéro normalisé, on garde
 * la première dont juridiction + année passent.
 */
function checkRef(
  ref: string,
  index: Map<string, IndexEntry[]>,
  contextYear: number | null,
): RefCheck {
  const key = normalizeRef(ref);
  const entries = index.get(key);
  if (!entries || entries.length === 0) {
    return { valid: false, reason: "not_in_corpus" };
  }

  const format = classifyRefFormat(ref);
  const compatible = COMPATIBLE_JURIDICTIONS[format];
  // ECLI ou identifiants directs : on ne filtre pas par juridiction (ils
  // sont déjà uniques au corpus).
  const skipJuridictionCheck =
    format === "ecli" ||
    format === "cetatext" ||
    format === "juritext" ||
    format === "constext";

  let sawWrongJuridiction = false;
  let sawWrongDate = false;

  for (const e of entries) {
    if (!skipJuridictionCheck && compatible.length > 0) {
      if (!compatible.includes(e.juridiction)) {
        sawWrongJuridiction = true;
        continue;
      }
    }
    if (contextYear !== null && e.year !== null) {
      // Tolérance ± 1 an (audience vs mise à disposition vs publication).
      if (Math.abs(e.year - contextYear) > 1) {
        sawWrongDate = true;
        continue;
      }
    }
    return { valid: true, matchedDecisionId: e.decisionId };
  }

  // Aucun match valide — on choisit la raison la plus parlante
  if (sawWrongJuridiction) return { valid: false, reason: "wrong_jurisdiction" };
  if (sawWrongDate) return { valid: false, reason: "wrong_date" };
  return { valid: false, reason: "not_in_corpus" };
}

/**
 * Découpe le markdown en phrases, en respectant les limites de bloc.
 */
function splitIntoSentences(line: string): string[] {
  const parts = line.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ÿ«])/);
  return parts.length > 0 ? parts : [line];
}

/** Liste des refs trouvées dans une string + leur position dans le texte. */
function extractRefsWithPositions(
  text: string,
): Array<{ ref: string; index: number; length: number }> {
  const out: Array<{ ref: string; index: number; length: number }> = [];
  for (const re of [ECLI_REGEX, CETATEXT_REGEX, JURITEXT_REGEX, CONSTEXT_REGEX]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ ref: m[0], index: m.index, length: m[0].length });
    }
  }
  POURVOI_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = POURVOI_REGEX.exec(text)) !== null) {
    const candidate = m[0];
    if (
      /^\d{2}[-]\d{4,5}$/.test(candidate) ||
      /^\d{2}\/\d{4,6}$/.test(candidate) ||
      /^\d{4}\/\d{4,6}$/.test(candidate)
    ) {
      out.push({ ref: candidate, index: m.index, length: candidate.length });
    }
  }
  return out;
}

interface UnverifiedAccumulator {
  byRef: Map<string, UnverifiedRef["reason"]>;
}

function accumulateUnverified(
  acc: UnverifiedAccumulator,
  ref: string,
  reason: UnverifiedRef["reason"],
) {
  // Si la même ref apparaît plusieurs fois, on garde la pire raison
  // (pour ne pas masquer un wrong_jurisdiction par un not_in_corpus).
  const existing = acc.byRef.get(ref);
  const priority: Record<UnverifiedRef["reason"], number> = {
    wrong_jurisdiction: 3,
    wrong_date: 2,
    not_in_corpus: 1,
  };
  if (!existing || priority[reason] > priority[existing]) {
    acc.byRef.set(ref, reason);
  }
}

/**
 * Nettoie une ligne en supprimant les phrases qui contiennent une réf
 * non vérifiable (avec ou sans juridiction/date cohérentes).
 */
function cleanLine(
  line: string,
  index: Map<string, IndexEntry[]>,
  acc: UnverifiedAccumulator,
): { cleaned: string; removed: number } {
  const sentences = splitIntoSentences(line);
  const kept: string[] = [];
  let removed = 0;
  for (const s of sentences) {
    const refsWithPos = extractRefsWithPositions(s);
    if (refsWithPos.length === 0) {
      kept.push(s);
      continue;
    }
    let allValid = true;
    for (const r of refsWithPos) {
      const ctxYear = extractYearFromContext(s, r.index, r.length);
      const check = checkRef(r.ref, index, ctxYear);
      if (!check.valid) {
        allValid = false;
        accumulateUnverified(acc, r.ref, check.reason ?? "not_in_corpus");
      }
    }
    if (allValid) {
      kept.push(s);
    } else {
      removed++;
    }
  }
  return { cleaned: kept.join(" "), removed };
}

/** Vérifie une ligne de tableau markdown. */
function isTableRowValid(
  row: string,
  index: Map<string, IndexEntry[]>,
  acc: UnverifiedAccumulator,
): boolean {
  const refsWithPos = extractRefsWithPositions(row);
  if (refsWithPos.length === 0) return true;
  let allValid = true;
  for (const r of refsWithPos) {
    const ctxYear = extractYearFromContext(row, r.index, r.length);
    const check = checkRef(r.ref, index, ctxYear);
    if (!check.valid) {
      allValid = false;
      accumulateUnverified(acc, r.ref, check.reason ?? "not_in_corpus");
    }
  }
  return allValid;
}

/**
 * Vérifie l'ensemble du markdown généré par Claude.
 * Supprime les phrases et lignes de tableau dont les refs ne passent pas
 * la vérification croisée (corpus + juridiction + année).
 */
export function verifyAndCleanMarkdown(
  markdown: string,
  corpus: JudilibreDecision[],
): VerificationResult {
  const index = buildCorpusIndex(corpus);
  const acc: UnverifiedAccumulator = { byRef: new Map() };

  // Comptage initial — chaque occurrence de ref unique est comptée une fois
  const allCitedRefs = extractRefs(markdown);

  const lines = markdown.split("\n");
  const cleanedLines: string[] = [];
  let removedSentences = 0;
  let removedRows = 0;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const isTableRow =
      trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
    const isSeparator = /^\|[\s:\-|]+\|$/.test(trimmed);

    if (isTableRow && isSeparator) {
      inTable = true;
      cleanedLines.push(line);
      continue;
    }
    if (isTableRow && !inTable) {
      inTable = true;
      cleanedLines.push(line);
      continue;
    }
    if (isTableRow && inTable) {
      if (isTableRowValid(line, index, acc)) {
        cleanedLines.push(line);
      } else {
        removedRows++;
      }
      continue;
    }
    if (!isTableRow && inTable) {
      inTable = false;
    }

    if (trimmed.length === 0) {
      cleanedLines.push(line);
      continue;
    }
    const { cleaned, removed } = cleanLine(line, index, acc);
    removedSentences += removed;
    if (cleaned.trim().length > 0 || removed === 0) {
      cleanedLines.push(cleaned || line);
    }
  }

  let cleanedMarkdown = cleanedLines.join("\n");

  // ─── Cohérence du comptage N intro = N tableau ──
  let coherenceCorrected = false;
  const finalRowCount = countTableRows(cleanedMarkdown);
  const announcedCount = corpus.length;
  if (
    finalRowCount > 0 &&
    finalRowCount !== announcedCount &&
    removedRows > 0
  ) {
    cleanedMarkdown = patchAnnouncedCount(
      cleanedMarkdown,
      announcedCount,
      finalRowCount,
    );
    coherenceCorrected = true;
  }

  // Décompose l'accumulateur en deux structures
  const unverifiedDetails: UnverifiedRef[] = [];
  for (const [ref, reason] of acc.byRef.entries()) {
    unverifiedDetails.push({ ref, reason });
  }
  const unverifiedRefs = unverifiedDetails.map((u) => u.ref);
  const verifiedRefsCount = allCitedRefs.length - unverifiedDetails.length;

  return {
    cleanedMarkdown,
    citedRefs: allCitedRefs.length,
    verifiedRefs: Math.max(0, verifiedRefsCount),
    unverifiedRefs,
    unverifiedDetails,
    removedSentences,
    removedRows,
    coherenceCorrected,
  };
}

/**
 * Helpers exposés pour réutilisation par parse-analysis.ts (Axe B).
 */
export {
  buildCorpusIndex,
  classifyRefFormat,
  checkRef,
  extractYearFromContext,
  normalizeRef,
};

function countTableRows(markdown: string): number {
  const lines = markdown.split("\n");
  let count = 0;
  let inTable = false;
  let sepSeen = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const isRow = trimmed.startsWith("|") && trimmed.endsWith("|");
    const isSep = /^\|[\s:\-|]+\|$/.test(trimmed);
    if (isRow && !inTable) {
      inTable = true;
      sepSeen = false;
      continue;
    }
    if (isRow && inTable && isSep) {
      sepSeen = true;
      continue;
    }
    if (isRow && inTable && sepSeen) {
      count++;
      continue;
    }
    if (!isRow && inTable && sepSeen) {
      return count;
    }
  }
  return count;
}

function patchAnnouncedCount(
  markdown: string,
  oldN: number,
  newN: number,
): string {
  if (oldN === newN) return markdown;
  let out = markdown;
  out = out.replace(
    new RegExp(
      `(\\bsur(?:\\s+les)?\\s+)${oldN}(\\s+(?:décisions?|arrêts?|d\\u00e9cisions?))`,
      "gi",
    ),
    `$1${newN}$2`,
  );
  out = out.replace(
    new RegExp(`\\b${oldN}(\\s+décisions?\\s+analysées?)`, "gi"),
    `${newN}$1`,
  );
  out = out.replace(
    new RegExp(
      `\\b${oldN}(\\s+décisions?\\s+(?:ont|du|de|cit|retenu|favorables?|défavorables?))`,
      "gi",
    ),
    `${newN}$1`,
  );
  out = out.replace(
    new RegExp(
      `(Total(?:\\s+décisions?\\s+analysées?)?\\s*:\\s*)${oldN}\\b`,
      "gi",
    ),
    `$1${newN}`,
  );
  out = out.replace(
    new RegExp(`(Sur\\s+(?:les\\s+)?)${oldN}(\\s+décisions?)`, "gi"),
    `$1${newN}$2`,
  );
  return out;
}
