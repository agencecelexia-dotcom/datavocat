/**
 * Extraction arithmétique des montants en euros depuis les sommaires.
 *
 * Stratégie : on parse le texte (sommaire + highlights) de chaque décision
 * du corpus avec une regex tolérante pour récupérer les montants en €,
 * puis on filtre :
 *   - bornes : 100 € ≤ x ≤ 10 000 000 € (écarte années, RG, durées)
 *   - mot-clé indemnitaire dans la même phrase (condamne, indemnité,
 *     dommages-intérêts, alloue, fixe, accorde…) — évite les chiffres
 *     d'affaires, prix, etc. qui ne sont pas indemnitaires.
 *
 * Trois catégories isolées :
 *   1. Montants généraux indemnitaires (toutes condamnations confondues)
 *   2. Article 700 CPC spécifiquement (fenêtre ±60 chars autour de "art. 700")
 *   3. Dommages-intérêts spécifiquement (fenêtre autour du libellé)
 *
 * Les montants alimentent FAITS VÉRIFIÉS pour que Claude n'ait plus qu'à
 * recopier — anti-hallucination préservée.
 */

import type { JudilibreDecision } from "@/lib/judilibre/client";

export interface MontantExtraction {
  montants: {
    min: number | null;
    median: number | null;
    max: number | null;
    samples: number;
  };
  article700: {
    /**
     * @deprecated Toujours `null`. Ce champ valait un taux de détection
     * textuelle dans les sommaires, présenté à tort comme un taux de
     * condamnation. Aucun dénominateur correct n'est dérivable de Judilibre.
     * Conservé pour compatibilité de forme avec les analyses archivées.
     */
    tauxCondamnation: number | null;
    montantMoyen: number | null;
    montantMedian: number | null;
    sampleSize: number;
    /** Décisions dont le sommaire mentionne l'art. 700 avec un montant. */
    decisionsAvecMontant: number;
  };
  dommagesInterets: {
    min: number | null;
    median: number | null;
    max: number | null;
    samples: number;
  };
}

const MONTANT_RE =
  /(\d{1,3}(?:[\s .]\d{3})+|\d{2,7})(?:[,.](\d{1,2}))?\s*(?:€|euros?|EUR)\b/gi;

const ART700_RE = /\barticle\s+700|\bart\.?\s*700\b/i;
const DI_RE =
  /\bdommages?[-\s]int[ée]r[êe]ts?|\bindemnit[ée]\s+(?:de\s+)?(?:r[ée]paration|licenciement|rupture|pr[ée]avis)/i;

const INDEMNITAIRE_RE =
  /\b(condamne|condamn[ée]e?|indemnit[ée]|dommages?|article\s+700|alloue|alloc|fixe|accorde|verse|paiement|somme\s+de)\b/i;

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 10_000_000;

/**
 * Parse une string montant ("12 000", "1.500,50", "45000") en number EUR.
 * Renvoie null si invalide ou hors bornes.
 */
function parseMontant(intPart: string, decPart?: string): number | null {
  // Normalise les séparateurs : espace insécable, espace, point comme séparateur de millier
  const cleanInt = intPart.replace(/[\s .]/g, "");
  if (!/^\d+$/.test(cleanInt)) return null;
  const main = parseInt(cleanInt, 10);
  if (Number.isNaN(main)) return null;
  let value = main;
  if (decPart) {
    const dec = parseInt(decPart.padEnd(2, "0"), 10);
    if (!Number.isNaN(dec)) value += dec / 100;
  }
  if (value < MIN_AMOUNT || value > MAX_AMOUNT) return null;
  return Math.round(value);
}

/**
 * Vérifie qu'un mot-clé indemnitaire apparaît dans la même phrase que le
 * montant. La phrase est délimitée par . ! ? ou bornes du texte.
 */
function isIndemnitaireContext(
  text: string,
  matchIndex: number,
  matchLength: number,
): boolean {
  // Phrase = depuis le dernier . / ! / ? / start jusqu'au prochain ou end
  const before = text.slice(0, matchIndex);
  const after = text.slice(matchIndex + matchLength);
  const sentenceStart = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("! "),
    before.lastIndexOf("? "),
    before.lastIndexOf("\n"),
  );
  const sentenceEndRel = after.search(/[.!?\n]/);
  const sentence =
    text.slice(
      Math.max(0, sentenceStart),
      matchIndex + matchLength + (sentenceEndRel === -1 ? after.length : sentenceEndRel),
    ) || "";
  return INDEMNITAIRE_RE.test(sentence);
}

/**
 * Extrait tous les montants d'un texte avec leur position.
 */
function extractAmounts(
  text: string,
): Array<{ value: number; index: number; length: number }> {
  if (!text) return [];
  const out: Array<{ value: number; index: number; length: number }> = [];
  for (const m of text.matchAll(MONTANT_RE)) {
    if (m.index === undefined) continue;
    const value = parseMontant(m[1], m[2]);
    if (value === null) continue;
    if (!isIndemnitaireContext(text, m.index, m[0].length)) continue;
    out.push({ value, index: m.index, length: m[0].length });
  }
  return out;
}

/** Pour une décision, retourne le plus gros montant indemnitaire trouvé (ou null). */
function biggestAmount(
  amounts: Array<{ value: number; index: number; length: number }>,
): number | null {
  if (amounts.length === 0) return null;
  return Math.max(...amounts.map((a) => a.value));
}

/**
 * Fenêtre de proximité entre un motif et un montant.
 *
 * 60 caractères était trop court pour le cas nominal : la formule usuelle
 * « …au titre de l'article 700 du code de procédure civile la somme de 2 000 € »
 * fait 78 caractères, et n'était donc jamais captée.
 */
const PROXIMITY_WINDOW = 120;

/** Pour une décision, retourne les montants proches d'un pattern. */
function amountsNearPattern(
  text: string,
  amounts: Array<{ value: number; index: number; length: number }>,
  pattern: RegExp,
): number[] {
  // `flags` peut déjà contenir "g" : le dupliquer lève une SyntaxError.
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : pattern.flags + "g";
  const matches = [...text.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length === 0) return [];
  const result: number[] = [];
  for (const m of matches) {
    if (m.index === undefined) continue;
    const start = m.index - PROXIMITY_WINDOW;
    const end = m.index + m[0].length + PROXIMITY_WINDOW;
    for (const a of amounts) {
      if (a.index >= start && a.index <= end) result.push(a.value);
    }
  }
  return result;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Calcule les statistiques de montants sur l'ensemble du corpus.
 */
export function extractMontantsFromCorpus(
  corpus: JudilibreDecision[],
): MontantExtraction {
  const generalAmounts: number[] = []; // 1 max par décision
  const art700Amounts: number[] = [];
  const diAmounts: number[] = [];
  let art700DecisionCount = 0;

  for (const dec of corpus) {
    const sommaire = dec.sommaire || "";
    const highlights = (dec.highlights?.text || []).join(" ");
    const text = `${sommaire} ${highlights}`.trim();
    if (!text) continue;

    const amounts = extractAmounts(text);
    if (amounts.length === 0) continue;

    // Général : on garde le plus gros (généralement la condamnation principale)
    const big = biggestAmount(amounts);
    if (big !== null) generalAmounts.push(big);

    // Article 700 : montant proche du libellé
    const art700 = amountsNearPattern(text, amounts, ART700_RE);
    if (art700.length > 0) {
      art700DecisionCount++;
      art700Amounts.push(Math.min(...art700)); // l'art. 700 est généralement le plus petit
    }

    // Dommages-intérêts : montant proche du libellé
    const di = amountsNearPattern(text, amounts, DI_RE);
    if (di.length > 0) diAmounts.push(Math.max(...di));
  }

  return {
    montants: {
      min: generalAmounts.length ? Math.min(...generalAmounts) : null,
      median: median(generalAmounts),
      max: generalAmounts.length ? Math.max(...generalAmounts) : null,
      samples: generalAmounts.length,
    },
    article700: {
      // `tauxCondamnation` a été SUPPRIMÉ (toujours null).
      //
      // Il valait `décisions dont le sommaire mentionne l'art. 700 avec un
      // montant` / `corpus entier`. Or les sommaires Judilibre résument la
      // question de droit, pas le dispositif : la quasi-totalité des décisions
      // n'évoque pas les frais irrépétibles même quand ils ont été alloués.
      // C'était donc un taux de DÉTECTION TEXTUELLE publié sous le libellé
      // « taux de condamnation » — un avocat y lisait « 8 % de chances
      // d'obtenir un article 700 » là où la pratique avoisine 80 %.
      //
      // Aucun dénominateur correct n'est dérivable de cette source : on ne
      // publie plus de taux, seulement les montants observés.
      tauxCondamnation: null,
      montantMoyen: mean(art700Amounts),
      montantMedian: median(art700Amounts),
      sampleSize: art700Amounts.length,
      /** Décisions dont le sommaire mentionne l'art. 700 avec un montant. */
      decisionsAvecMontant: art700DecisionCount,
    },
    dommagesInterets: {
      min: diAmounts.length ? Math.min(...diAmounts) : null,
      median: median(diAmounts),
      max: diAmounts.length ? Math.max(...diAmounts) : null,
      samples: diAmounts.length,
    },
  };
}
