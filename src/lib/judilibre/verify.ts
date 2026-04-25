/**
 * Vérification post-génération du rapport Claude.
 *
 * Pour chaque référence ECLI / numéro de pourvoi citée par Claude, on vérifie
 * qu'elle existe dans le corpus Judilibre fourni au modèle. Si non — on
 * SUPPRIME la phrase entière qui la contient (et la ligne du tableau de
 * preuve si c'est une ligne de tableau).
 *
 * Le résultat est un rapport `VerificationResult` qui dit combien de refs
 * ont été citées vs vérifiées vs supprimées, exposé dans le dashboard.
 */

import type { JudilibreDecision } from "./client";

export interface VerificationResult {
  /** Markdown nettoyé : phrases et lignes non vérifiables retirées. */
  cleanedMarkdown: string;
  /** Nombre total de refs (ECLI + pourvois) citées avant nettoyage. */
  citedRefs: number;
  /** Nombre de refs présentes dans le corpus. */
  verifiedRefs: number;
  /** Refs citées mais absentes du corpus. */
  unverifiedRefs: string[];
  /** Nombre de phrases supprimées. */
  removedSentences: number;
  /** Nombre de lignes de tableau supprimées. */
  removedRows: number;
}

const ECLI_REGEX = /ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+/g;
const POURVOI_REGEX = /\b\d{2,4}[-/.]\d{2,5}(?:\.\d+)?\b/g;

function normalizeRef(ref: string): string {
  return ref.toUpperCase().replace(/[\s.\-/]/g, "");
}

/**
 * Construit le set de refs autorisées à partir du corpus Judilibre fourni.
 */
function buildCorpusIndex(decisions: JudilibreDecision[]): Set<string> {
  const set = new Set<string>();
  for (const d of decisions) {
    if (d.ecli) set.add(normalizeRef(d.ecli));
    if (Array.isArray(d.number)) {
      for (const n of d.number) set.add(normalizeRef(n));
    }
    if (d.id) set.add(normalizeRef(d.id));
  }
  return set;
}

/**
 * Extrait toutes les ECLI et numéros de pourvoi cités dans le markdown.
 */
function extractRefs(markdown: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  ECLI_REGEX.lastIndex = 0;
  while ((m = ECLI_REGEX.exec(markdown)) !== null) {
    refs.push(m[0]);
  }
  POURVOI_REGEX.lastIndex = 0;
  while ((m = POURVOI_REGEX.exec(markdown)) !== null) {
    // Filtrer les faux positifs : dates (ex 12/03/2024), montants (10/100)
    const candidate = m[0];
    // Doit ressembler à un n° de pourvoi : 2 segments, dont un >= 4 chiffres typiquement
    if (/^\d{2}[-/.]\d{4,5}$/.test(candidate)) {
      refs.push(candidate);
    }
  }
  return Array.from(new Set(refs));
}

/**
 * Vérifie qu'une référence existe dans le corpus.
 */
function isRefInCorpus(ref: string, index: Set<string>): boolean {
  return index.has(normalizeRef(ref));
}

/**
 * Découpe le markdown en phrases, en respectant les limites de bloc.
 * Une "phrase" se termine sur un point/?/! suivi d'espace ou newline.
 */
function splitIntoSentences(line: string): string[] {
  // Tolère les abréviations courantes (Cass., n°, art., etc.)
  // Approche pragmatique : split sur les points suivis d'espace + capitale.
  const parts = line.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ÿ«])/);
  return parts.length > 0 ? parts : [line];
}

/**
 * Nettoie une ligne en supprimant les phrases qui contiennent une réf non
 * vérifiable. Retourne la ligne nettoyée + nombre de phrases supprimées.
 */
function cleanLine(
  line: string,
  index: Set<string>,
  unverifiedAccumulator: Set<string>
): { cleaned: string; removed: number } {
  const sentences = splitIntoSentences(line);
  const kept: string[] = [];
  let removed = 0;
  for (const s of sentences) {
    const refs = extractRefs(s);
    if (refs.length === 0) {
      kept.push(s);
      continue;
    }
    const allValid = refs.every((r) => isRefInCorpus(r, index));
    if (allValid) {
      kept.push(s);
    } else {
      removed++;
      for (const r of refs) {
        if (!isRefInCorpus(r, index)) unverifiedAccumulator.add(r);
      }
    }
  }
  return { cleaned: kept.join(" "), removed };
}

/**
 * Vérifie une ligne de tableau markdown : si elle cite une ref non vérifiable,
 * on retire la ligne entière.
 */
function isTableRowValid(
  row: string,
  index: Set<string>,
  unverifiedAccumulator: Set<string>
): boolean {
  const refs = extractRefs(row);
  if (refs.length === 0) {
    // Pas de ref → on garde (peut être une ligne sans ref explicite)
    return true;
  }
  const allValid = refs.every((r) => isRefInCorpus(r, index));
  if (!allValid) {
    for (const r of refs) {
      if (!isRefInCorpus(r, index)) unverifiedAccumulator.add(r);
    }
    return false;
  }
  return true;
}

/**
 * Vérifie l'ensemble du markdown généré par Claude.
 * Supprime les phrases et lignes de tableau qui citent des refs absentes
 * du corpus Judilibre fourni.
 */
export function verifyAndCleanMarkdown(
  markdown: string,
  corpus: JudilibreDecision[]
): VerificationResult {
  const index = buildCorpusIndex(corpus);

  const allCitedRefs = extractRefs(markdown);
  const verifiedRefs = allCitedRefs.filter((r) => isRefInCorpus(r, index));
  const unverifiedSet = new Set<string>();

  const lines = markdown.split("\n");
  const cleanedLines: string[] = [];
  let removedSentences = 0;
  let removedRows = 0;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Détection ligne de tableau markdown
    const isTableRow =
      trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
    const isSeparator = /^\|[\s:\-|]+\|$/.test(trimmed);

    if (isTableRow && isSeparator) {
      inTable = true;
      cleanedLines.push(line);
      continue;
    }
    if (isTableRow && !inTable) {
      // En-tête du tableau
      inTable = true;
      cleanedLines.push(line);
      continue;
    }
    if (isTableRow && inTable) {
      // Ligne de données : on vérifie les refs
      if (isTableRowValid(line, index, unverifiedSet)) {
        cleanedLines.push(line);
      } else {
        removedRows++;
      }
      continue;
    }
    if (!isTableRow && inTable) {
      inTable = false;
    }

    // Ligne de prose ordinaire — on nettoie phrase par phrase
    if (trimmed.length === 0) {
      cleanedLines.push(line);
      continue;
    }
    const { cleaned, removed } = cleanLine(line, index, unverifiedSet);
    removedSentences += removed;
    if (cleaned.trim().length > 0 || removed === 0) {
      cleanedLines.push(cleaned || line);
    }
    // Si la ligne entière a été vidée, on la skip pour ne pas laisser de blanc
  }

  return {
    cleanedMarkdown: cleanedLines.join("\n"),
    citedRefs: allCitedRefs.length,
    verifiedRefs: verifiedRefs.length,
    unverifiedRefs: Array.from(unverifiedSet),
    removedSentences,
    removedRows,
  };
}
