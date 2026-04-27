/**
 * Calcul de VRAIES statistiques sur le corpus Judilibre fourni à Claude.
 *
 * Objectif : remplacer les "estimations" inventées par Claude par des chiffres
 * dérivés arithmétiquement des décisions réelles. Le résultat est injecté dans
 * le user message sous forme de bloc "FAITS VÉRIFIÉS" que le prompt système
 * ordonne à Claude de réciter sans modifier.
 *
 * Hallucination prevention : si une statistique ne peut pas être calculée
 * (donnée absente du corpus), on n'en produit pas — Claude écrira alors
 * "non documenté dans le corpus analysé".
 *
 * Hiérarchie : 4 catégories mutuellement exclusives sur le modèle français :
 *   - 1er degré : ordre judiciaire (TJ, TC, CPH, TGI…) + ordre administratif (TA)
 *   - Cour d'appel : ordre judiciaire (CA) + ordre administratif (CAA)
 *   - Cour de cassation : juge du droit ordre judiciaire
 *   - Conseil d'État : juge du droit ordre administratif (via Légifrance CETAT)
 */

import type { JudilibreDecision } from "./client";
import {
  extractMontantsFromCorpus,
  type MontantExtraction,
} from "./extractMontants";

export type HierarchyCategory =
  | "premierDegre"
  | "courAppel"
  | "cassation"
  | "conseilEtat";

export interface CategoryStats {
  total: number;
  favorables: number;
  defavorables: number;
  nuances: number;
  acceptanceRate: number | null;
  // Spécifique cassation : taux de cassation (cassations / total)
  cassationRate?: number | null;
  cassations?: number;
  rejets?: number;
}

export interface CorpusStats {
  total: number;
  bySolution: Array<{ label: string; count: number; pct: number }>;
  byJurisdiction: Array<{ label: string; count: number; pct: number }>;
  byChamber: Array<{ label: string; count: number; pct: number }>;
  byYear: Array<{ year: string; count: number }>;
  freshDecisions: number; // < 3 ans
  oldestDate: string | null;
  freshestDate: string | null;
  /**
   * Hiérarchie 4 catégories mutuellement exclusives. La somme de leurs `total`
   * vaut exactement `corpus.total` (invariant Règle 2).
   */
  hierarchy: {
    premierDegre: CategoryStats;
    courAppel: CategoryStats;
    cassation: CategoryStats;
    conseilEtat: CategoryStats & { sourceAvailable: boolean };
  };
  /** Récence < 5 ans pour la composante D de l'indice de fiabilité. */
  freshDecisionsFiveYears: number;
  /** Nombre de catégories juridictionnelles non vides (pour composante C). */
  nonEmptyCategories: number;
  /** Cohérence jurisprudentielle (max(fav,def)/total) sur tout le corpus, %. */
  coherencePct: number;
  /**
   * Taux de succès retenu — chiffre canonique à afficher comme « % de chances »
   * pour le client. Calculé selon la composition du corpus :
   *   - corpus mixte ou majoritairement fond → taux d'acceptation au fond
   *   - corpus 100% Cassation → taux de cassation (succès du pourvoi)
   *   - corpus vide ou sans signal → null
   */
  tauxSuccesRetenu: number | null;
  /** Source du taux retenu (informatif, pour l'UI). */
  tauxSuccesSource: "fond" | "cassation" | "mixte" | null;
  /**
   * Tendance temporelle : taux d'acceptation par année (au fond).
   * Chaque entrée a au moins 3 décisions pour être statistiquement
   * significative (sinon agrégée dans "Avant"). La direction (up/down/flat)
   * est calculée par régression linéaire simple sur les 5 dernières années.
   */
  temporalTrend: {
    buckets: Array<{ year: string; total: number; favorables: number; rate: number }>;
    direction: "ascending" | "descending" | "flat" | "insufficient";
    /** Variation de taux entre 1ère et dernière période (en points %). */
    deltaPct: number;
    /** Année médiane (50% des décisions sont avant/après). */
    medianYear: string | null;
  };
  /**
   * Variations régionales : taux par cour d'appel.
   * Identifie les CA les plus favorables et les plus défavorables.
   */
  regionalVariations: Array<{
    label: string;
    total: number;
    favorables: number;
    rate: number;
  }>;
  /**
   * Variations par chambre / formation (Cass. + CA).
   */
  chamberVariations: Array<{
    label: string;
    total: number;
    favorables: number;
    rate: number;
  }>;
  /**
   * Variations par thème juridique (champ Judilibre `themes`).
   * Aide à identifier les sous-sujets discriminants.
   */
  themeVariations: Array<{
    label: string;
    total: number;
    favorables: number;
    rate: number;
  }>;
  /**
   * Montants en euros extraits arithmétiquement des sommaires.
   * Trois catégories : généraux indemnitaires, article 700 CPC, dommages-intérêts.
   * Si aucun montant n'est trouvé, samples=0 et les valeurs sont null.
   */
  montantsStats: MontantExtraction;
  /**
   * Taux par moyen juridique : pour chaque thème Judilibre du corpus,
   * compte combien de décisions le citent (invoque) et combien donnent
   * une issue favorable (retenu). taux = retenu/invoque × 100.
   * Top 8, filtré à invoque ≥ 2 pour exclure le bruit statistique.
   */
  argumentStats: Array<{
    name: string;
    invoque: number;
    retenu: number;
    taux: number;
  }>;
}

const CHAMBER_LABELS: Record<string, string> = {
  soc: "Chambre sociale",
  civ1: "1ère chambre civile",
  civ2: "2ème chambre civile",
  civ3: "3ème chambre civile",
  com: "Chambre commerciale",
  crim: "Chambre criminelle",
  mi: "Chambre mixte",
  pl: "Assemblée plénière",
};

const HIERARCHY_LABELS: Record<HierarchyCategory, string> = {
  premierDegre: "1er degré (CPH, TJ, TC, TGI…)",
  courAppel: "Cour d'appel",
  cassation: "Cour de cassation",
  conseilEtat: "Conseil d'État",
};

/**
 * Classe une décision (Judilibre OU Légifrance CETAT) dans une des 4 catégories.
 *
 * Codes ordre judiciaire (Judilibre, testés en avril 2026) :
 *   - "cc" → cassation (~480 000)
 *   - "ca" → courAppel (~82 000)
 *   - "tj" → 1er degré, tribunal judiciaire
 *   - "tcom" → 1er degré, tribunal de commerce
 *   - "cph" → 1er degré, conseil de prud'hommes (encore vide côté API)
 *
 * Codes ordre administratif (Légifrance CETAT, branchés avril 2026) :
 *   - "ce" → conseilEtat (Conseil d'État, juge du droit admin)
 *   - "caa" → courAppel (Cour administrative d'appel — équivalent CA)
 *   - "ta" → premierDegre (Tribunal administratif — équivalent TJ)
 *
 * Tout autre code → premierDegre par défaut.
 */
function classifyHierarchy(d: JudilibreDecision): HierarchyCategory {
  const j = (d.jurisdiction || "").toLowerCase();
  if (j === "cc") return "cassation";
  if (j === "ca" || j === "caa") return "courAppel";
  if (j === "ce") return "conseilEtat";
  // tj, tcom, cph, ta, autres codes → 1er degré
  // (constit n'arrive pas ici : les décisions CONSTIT sont injectées
  // dans le prompt comme contexte séparé, hors stats hiérarchiques)
  return "premierDegre";
}

function classifySolution(solution: string): "cassation" | "rejet" | "autre" {
  const s = (solution || "").toLowerCase();
  if (s.includes("cassation")) return "cassation";
  if (s.includes("rejet")) return "rejet";
  return "autre";
}

function classifyOutcome(
  solution: string
): "favorable" | "defavorable" | "nuance" {
  // "favorable" pour la partie qui demande, "défavorable" sinon. Dans le doute → "nuance".
  // Couvre les libellés réels de Judilibre :
  // - Cass : "Cassation", "Rejet", "Cassation partielle"...
  // - CA   : "Infirme partiellement, réforme...", "Confirme la décision déférée...",
  //          "Infirme la décision déférée dans toutes ses dispositions..."
  const s = (solution || "").toLowerCase().trim();
  if (s === "" || s === "other") return "nuance";

  // Favorable : appelant gagne / cassation prononcée / demande accueillie.
  if (
    s.includes("fait droit") ||
    s.includes("accueil") ||
    s.includes("annule") || s.includes("annulation") ||
    s.includes("condamne") || s.includes("condamnation") ||
    s.startsWith("infirme") || // "Infirme la décision...", "Infirme partiellement..."
    s.includes("cassation") || // pourvoi cassation = succès demandeur
    s.includes("réforme") || s.includes("reforme")
  )
    return "favorable";

  // Défavorable : appelant perd / pourvoi rejeté / demande déboutée.
  if (
    s.startsWith("confirme") || // "Confirme la décision déférée..."
    s.includes("rejet") ||
    s.includes("déboute") || s.includes("deboute") ||
    s.includes("irrecevab")
  )
    return "defavorable";

  return "nuance";
}

function formatEuros(v: number | null): string {
  if (v === null || v === undefined) return "non disponible";
  return `${new Intl.NumberFormat("fr-FR").format(v)} €`;
}

function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function emptyCategoryStats(): CategoryStats {
  return {
    total: 0,
    favorables: 0,
    defavorables: 0,
    nuances: 0,
    acceptanceRate: null,
  };
}

/**
 * Calcule les stats d'une catégorie de la hiérarchie.
 */
function statsFromDecisions(decisions: JudilibreDecision[]): CategoryStats {
  if (decisions.length === 0) return emptyCategoryStats();
  let favorables = 0;
  let defavorables = 0;
  let nuances = 0;
  let cassations = 0;
  let rejets = 0;
  for (const d of decisions) {
    const sol = d.solution_alt || d.solution || "";
    const o = classifyOutcome(sol);
    if (o === "favorable") favorables++;
    else if (o === "defavorable") defavorables++;
    else nuances++;

    const c = classifySolution(sol);
    if (c === "cassation") cassations++;
    else if (c === "rejet") rejets++;
  }
  return {
    total: decisions.length,
    favorables,
    defavorables,
    nuances,
    acceptanceRate: pct(favorables, decisions.length),
    cassations,
    rejets,
    cassationRate: pct(cassations, decisions.length),
  };
}

export function computeCorpusStats(decisions: JudilibreDecision[]): CorpusStats {
  const total = decisions.length;

  // bySolution
  const solCounts: Record<string, number> = {};
  for (const d of decisions) {
    const key = (d.solution_alt || d.solution || "Non précisé").trim();
    solCounts[key] = (solCounts[key] || 0) + 1;
  }
  const bySolution = Object.entries(solCounts)
    .map(([label, count]) => ({ label, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);

  // byJurisdiction
  const jurCounts: Record<string, number> = {};
  for (const d of decisions) {
    const cat = classifyHierarchy(d);
    const label =
      cat === "cassation"
        ? "Cour de cassation"
        : cat === "courAppel"
          ? `Cour d'appel${d.jurisdiction && d.jurisdiction !== "ca" ? ` (${d.jurisdiction})` : ""}`
          : cat === "conseilEtat"
            ? "Conseil d'État"
            : "1er degré";
    jurCounts[label] = (jurCounts[label] || 0) + 1;
  }
  const byJurisdiction = Object.entries(jurCounts)
    .map(([label, count]) => ({ label, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);

  // byChamber
  const chCounts: Record<string, number> = {};
  for (const d of decisions) {
    const label = CHAMBER_LABELS[d.chamber] || d.chamber || "Non précisé";
    chCounts[label] = (chCounts[label] || 0) + 1;
  }
  const byChamber = Object.entries(chCounts)
    .map(([label, count]) => ({ label, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count);

  // byYear + dates extrêmes + fraîcheur
  const yearCounts: Record<string, number> = {};
  const dates = decisions
    .map((d) => d.date)
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .sort();
  for (const d of dates) {
    const year = d.slice(0, 4);
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  }
  const byYear = Object.entries(yearCounts)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  const now = new Date();
  const threeYearsAgo = new Date(
    now.getFullYear() - 3,
    now.getMonth(),
    now.getDate()
  )
    .toISOString()
    .slice(0, 10);
  const fiveYearsAgo = new Date(
    now.getFullYear() - 5,
    now.getMonth(),
    now.getDate()
  )
    .toISOString()
    .slice(0, 10);
  const freshDecisions = decisions.filter(
    (d) => (d.date || "") >= threeYearsAgo
  ).length;
  const freshDecisionsFiveYears = decisions.filter(
    (d) => (d.date || "") >= fiveYearsAgo
  ).length;

  // Hiérarchie 4 catégories — invariant : somme des `total` = `total`
  const buckets: Record<HierarchyCategory, JudilibreDecision[]> = {
    premierDegre: [],
    courAppel: [],
    cassation: [],
    conseilEtat: [],
  };
  for (const d of decisions) {
    buckets[classifyHierarchy(d)].push(d);
  }

  const hierarchy = {
    premierDegre: statsFromDecisions(buckets.premierDegre),
    courAppel: statsFromDecisions(buckets.courAppel),
    cassation: statsFromDecisions(buckets.cassation),
    conseilEtat: {
      ...statsFromDecisions(buckets.conseilEtat),
      sourceAvailable: true,
    },
  };

  const nonEmptyCategories = (
    ["premierDegre", "courAppel", "cassation", "conseilEtat"] as const
  ).filter((k) => hierarchy[k].total > 0).length;

  // Cohérence jurisprudentielle = max(fav, def) / total sur l'ensemble du corpus.
  let totalFav = 0;
  let totalDef = 0;
  for (const d of decisions) {
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    if (o === "favorable") totalFav++;
    else if (o === "defavorable") totalDef++;
  }
  const dominant = Math.max(totalFav, totalDef);
  const coherencePct = total > 0 ? pct(dominant, total) : 0;

  // Taux de succès retenu — chiffre canonique à afficher au client.
  // Logique :
  //   - Si corpus contient des décisions du fond (1er degré OU CA) → on
  //     prend le taux d'acceptation calculé sur le fond (le plus pertinent
  //     pour estimer les chances en pratique).
  //   - Sinon (corpus 100% Cass) → on affiche le taux de cassation, qui
  //     est le taux de succès des pourvois (signal pour un client en Cass).
  //   - Si vide → null.
  const fondTotal = hierarchy.premierDegre.total + hierarchy.courAppel.total;
  const fondFav =
    hierarchy.premierDegre.favorables + hierarchy.courAppel.favorables;
  let tauxSuccesRetenu: number | null = null;
  let tauxSuccesSource: "fond" | "cassation" | "mixte" | null = null;
  if (fondTotal >= 5) {
    tauxSuccesRetenu = pct(fondFav, fondTotal);
    tauxSuccesSource =
      hierarchy.cassation.total >= 5 ? "mixte" : "fond";
  } else if (hierarchy.cassation.total >= 5) {
    tauxSuccesRetenu = hierarchy.cassation.cassationRate ?? null;
    tauxSuccesSource = "cassation";
  }

  // ─── Niveau 3 : analyses statistiques avancées ──────────────
  // Tendance temporelle : on regroupe les décisions du fond par année
  // (les Cass. ont une logique différente, on les exclut). Si une année
  // n'a pas assez de décisions (< 3), on l'agrège à l'année précédente.
  const fondDecisions = decisions.filter(
    (d) => classifyHierarchy(d) === "premierDegre" || classifyHierarchy(d) === "courAppel"
  );

  const yearlyAccum: Record<
    string,
    { total: number; favorables: number }
  > = {};
  for (const d of fondDecisions) {
    const y = (d.date || "").slice(0, 4);
    if (!y) continue;
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    if (!yearlyAccum[y]) yearlyAccum[y] = { total: 0, favorables: 0 };
    yearlyAccum[y].total++;
    if (o === "favorable") yearlyAccum[y].favorables++;
  }
  const sortedYears = Object.keys(yearlyAccum).sort();
  const yearBuckets = sortedYears
    .filter((y) => yearlyAccum[y].total >= 2) // exclure bruit
    .map((y) => ({
      year: y,
      total: yearlyAccum[y].total,
      favorables: yearlyAccum[y].favorables,
      rate: pct(yearlyAccum[y].favorables, yearlyAccum[y].total),
    }));

  // Direction de tendance : régression linéaire simple sur les 5 dernières années
  let direction:
    | "ascending"
    | "descending"
    | "flat"
    | "insufficient" = "insufficient";
  let deltaPct = 0;
  if (yearBuckets.length >= 3) {
    const recent = yearBuckets.slice(-5);
    const xs = recent.map((_, i) => i);
    const ys = recent.map((b) => b.rate);
    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    deltaPct = Math.round((recent[n - 1].rate - recent[0].rate) * 10) / 10;
    if (slope > 1.5) direction = "ascending";
    else if (slope < -1.5) direction = "descending";
    else direction = "flat";
  } else if (yearBuckets.length > 0) {
    direction = "insufficient";
  }

  // Année médiane (50 % des décisions sont avant)
  let medianYear: string | null = null;
  if (fondDecisions.length > 0) {
    const sortedDates = fondDecisions
      .map((d) => d.date || "")
      .filter(Boolean)
      .sort();
    medianYear =
      sortedDates[Math.floor(sortedDates.length / 2)]?.slice(0, 4) || null;
  }

  // Variations régionales (par CA)
  const regionalAccum: Record<
    string,
    { total: number; favorables: number }
  > = {};
  for (const d of decisions) {
    if (classifyHierarchy(d) !== "courAppel") continue;
    let label = "CA inconnue";
    const j = (d.jurisdiction || "").toLowerCase();
    if (j === "ca") {
      // Tente d'extraire le ressort depuis chamber ou autres champs
      // (Judilibre ne donne pas toujours le ressort explicite ; c'est
      // une limitation de l'API)
      const ch = (d.chamber || "").trim();
      label = ch ? `CA ${ch}` : "CA";
    } else if (j === "caa") {
      label = "CAA";
    }
    if (!regionalAccum[label]) regionalAccum[label] = { total: 0, favorables: 0 };
    regionalAccum[label].total++;
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    if (o === "favorable") regionalAccum[label].favorables++;
  }
  const regionalVariations = Object.entries(regionalAccum)
    .filter(([, v]) => v.total >= 2)
    .map(([label, v]) => ({
      label,
      total: v.total,
      favorables: v.favorables,
      rate: pct(v.favorables, v.total),
    }))
    .sort((a, b) => b.rate - a.rate);

  // Variations par chambre / formation
  const chamberAccum: Record<
    string,
    { total: number; favorables: number }
  > = {};
  for (const d of decisions) {
    const ch = CHAMBER_LABELS[d.chamber] || d.chamber || "Autre";
    if (!chamberAccum[ch]) chamberAccum[ch] = { total: 0, favorables: 0 };
    chamberAccum[ch].total++;
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    if (o === "favorable") chamberAccum[ch].favorables++;
  }
  const chamberVariations = Object.entries(chamberAccum)
    .filter(([, v]) => v.total >= 3)
    .map(([label, v]) => ({
      label,
      total: v.total,
      favorables: v.favorables,
      rate: pct(v.favorables, v.total),
    }))
    .sort((a, b) => b.total - a.total);

  // Variations par thème (champ Judilibre `themes`)
  const themeAccum: Record<
    string,
    { total: number; favorables: number }
  > = {};
  for (const d of decisions) {
    const themes = d.themes || [];
    for (const t of themes.slice(0, 3)) {
      // top 3 thèmes max par décision pour éviter explosion
      const label = t.split(" - ")[0]?.trim() || t.trim();
      if (!label) continue;
      if (!themeAccum[label]) themeAccum[label] = { total: 0, favorables: 0 };
      themeAccum[label].total++;
      const o = classifyOutcome(d.solution_alt || d.solution || "");
      if (o === "favorable") themeAccum[label].favorables++;
    }
  }
  const themeVariations = Object.entries(themeAccum)
    .filter(([, v]) => v.total >= 3)
    .map(([label, v]) => ({
      label,
      total: v.total,
      favorables: v.favorables,
      rate: pct(v.favorables, v.total),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Taux par moyen juridique (Axe 2) : top 8 thèmes du corpus,
  // ratio retenu/invoqué. Plus large que themeVariations (qui prend 1 label
  // par décision) : on prend tous les thèmes de chaque décision.
  const argAccum: Record<string, { invoque: number; retenu: number }> = {};
  for (const d of decisions) {
    const themes = d.themes || [];
    const outcome = classifyOutcome(d.solution_alt || d.solution || "");
    const seenInDecision = new Set<string>();
    for (const t of themes) {
      const label = (t.split(" - ")[0] || t).trim();
      if (!label) continue;
      // 1 thème compté 1 fois par décision (évite double comptage si Judilibre
      // répète le même label sous des hiérarchies différentes).
      if (seenInDecision.has(label)) continue;
      seenInDecision.add(label);
      if (!argAccum[label]) argAccum[label] = { invoque: 0, retenu: 0 };
      argAccum[label].invoque++;
      if (outcome === "favorable") argAccum[label].retenu++;
    }
  }
  const argumentStats = Object.entries(argAccum)
    .filter(([, v]) => v.invoque >= 2)
    .map(([name, v]) => ({
      name,
      invoque: v.invoque,
      retenu: v.retenu,
      taux: pct(v.retenu, v.invoque),
    }))
    .sort((a, b) => b.invoque - a.invoque)
    .slice(0, 8);

  return {
    total,
    bySolution,
    byJurisdiction,
    byChamber,
    byYear,
    freshDecisions,
    oldestDate: dates[0] || null,
    freshestDate: dates[dates.length - 1] || null,
    hierarchy,
    freshDecisionsFiveYears,
    nonEmptyCategories,
    coherencePct,
    tauxSuccesRetenu,
    tauxSuccesSource,
    temporalTrend: { buckets: yearBuckets, direction, deltaPct, medianYear },
    regionalVariations,
    chamberVariations,
    themeVariations,
    montantsStats: extractMontantsFromCorpus(decisions),
    argumentStats,
  };
}

/**
 * Formate les stats en bloc markdown injecté dans le user message.
 * Le prompt système ordonne à Claude de RÉCITER ces chiffres sans les modifier.
 */
export function formatStatsForPrompt(stats: CorpusStats): string {
  if (stats.total === 0) {
    return `═══ FAITS VÉRIFIÉS — STATISTIQUES CALCULÉES SUR LE CORPUS ═══
Aucune décision dans le corpus. Toutes les statistiques doivent être marquées "non documenté dans le corpus analysé".
══════════════════════════════════════════════════════════════════════`;
  }

  const lines: string[] = [];
  lines.push(
    `═══ FAITS VÉRIFIÉS — STATISTIQUES CALCULÉES SUR LE CORPUS ═══`
  );
  lines.push(
    `(Ces chiffres sont calculés arithmétiquement sur les ${stats.total} décisions Judilibre fournies. RÉCITE-LES SANS LES MODIFIER. Le nombre total ${stats.total} doit apparaître EXACTEMENT à l'identique dans l'introduction, dans toutes les rubriques statistiques, et dans la synthèse du tableau. Si une rubrique n'est pas calculable ici, écris "non documenté dans le corpus analysé".)`
  );
  lines.push("");

  lines.push(`Total décisions analysées : ${stats.total}`);
  lines.push(
    `Période : ${stats.oldestDate || "N/C"} → ${stats.freshestDate || "N/C"}`
  );
  lines.push(
    `Décisions de moins de 3 ans : ${stats.freshDecisions} (${pct(stats.freshDecisions, stats.total)}%)`
  );
  lines.push(
    `Décisions de moins de 5 ans : ${stats.freshDecisionsFiveYears} (${pct(stats.freshDecisionsFiveYears, stats.total)}%)`
  );
  lines.push(
    `Cohérence jurisprudentielle (sens dominant) : ${stats.coherencePct}%`
  );

  // Taux retenu canonique — chiffre que Claude DOIT recopier dans la
  // section "## Statistiques > Taux de succès global".
  if (stats.tauxSuccesRetenu !== null) {
    const labelSrc =
      stats.tauxSuccesSource === "fond"
        ? "calculé sur les décisions du fond (1er degré + CA) — base pertinente pour estimer les chances en pratique"
        : stats.tauxSuccesSource === "mixte"
          ? "calculé sur les décisions du fond (1er degré + CA) à l'exclusion des arrêts de Cassation pour ne pas biaiser le taux"
          : "calculé sur les arrêts de Cour de cassation (taux de cassation) — applicable UNIQUEMENT si la stratégie envisage un pourvoi";
    lines.push(
      `TAUX DE SUCCÈS RETENU : ${stats.tauxSuccesRetenu}% (${labelSrc})`
    );
  } else {
    lines.push(
      `TAUX DE SUCCÈS RETENU : non calculable sur ce corpus — données insuffisantes par catégorie`
    );
  }
  lines.push("");

  // Hiérarchie 4 catégories
  lines.push("RÉPARTITION PAR INSTANCE (4 catégories mutuellement exclusives) :");
  const h = stats.hierarchy;
  lines.push(
    `- 1er degré (TJ, TC, CPH, TGI, TA…) : ${h.premierDegre.total} décisions (${pct(h.premierDegre.total, stats.total)}%)`
  );
  lines.push(
    `- Cour d'appel (CA + CAA) : ${h.courAppel.total} décisions (${pct(h.courAppel.total, stats.total)}%)`
  );
  lines.push(
    `- Cour de cassation : ${h.cassation.total} arrêts (${pct(h.cassation.total, stats.total)}%)`
  );
  lines.push(
    `- Conseil d'État : ${h.conseilEtat.total} arrêts (${pct(h.conseilEtat.total, stats.total)}%)`
  );
  const sumAll =
    h.premierDegre.total +
    h.courAppel.total +
    h.cassation.total +
    h.conseilEtat.total;
  lines.push(
    `Vérification : ${h.premierDegre.total} + ${h.courAppel.total} + ${h.cassation.total} + ${h.conseilEtat.total} = ${sumAll} (doit = ${stats.total}).`
  );
  lines.push("");

  // Détail par catégorie non vide
  const detailCat = (
    label: string,
    cat: CategoryStats,
    isCass: boolean
  ): string[] => {
    if (cat.total === 0) return [];
    const out: string[] = [];
    out.push(
      `${label} (${cat.total} décision${cat.total > 1 ? "s" : ""}) :`
    );
    if (isCass) {
      out.push(
        `- Cassations : ${cat.cassations ?? 0} (${pct(cat.cassations ?? 0, cat.total)}%)`
      );
      out.push(
        `- Rejets : ${cat.rejets ?? 0} (${pct(cat.rejets ?? 0, cat.total)}%)`
      );
      out.push(
        `- Taux de cassation : ${cat.cassationRate ?? 0}% (rappel : c'est un taux du juge du droit, pas un taux de succès au fond)`
      );
    } else {
      out.push(
        `- Favorables au demandeur : ${cat.favorables} (${pct(cat.favorables, cat.total)}%)`
      );
      out.push(
        `- Défavorables : ${cat.defavorables} (${pct(cat.defavorables, cat.total)}%)`
      );
      out.push(
        `- Nuancées : ${cat.nuances} (${pct(cat.nuances, cat.total)}%)`
      );
      out.push(
        `- Taux d'acceptation : ${cat.acceptanceRate ?? 0}%`
      );
    }
    return out;
  };

  for (const line of detailCat("1er DEGRÉ", h.premierDegre, false)) lines.push(line);
  if (h.premierDegre.total > 0) lines.push("");
  for (const line of detailCat("COUR D'APPEL", h.courAppel, false)) lines.push(line);
  if (h.courAppel.total > 0) lines.push("");
  for (const line of detailCat("COUR DE CASSATION", h.cassation, true)) lines.push(line);
  if (h.cassation.total > 0) lines.push("");

  lines.push("RÉPARTITION PAR JURIDICTION (top 8) :");
  for (const j of stats.byJurisdiction.slice(0, 8)) {
    lines.push(`- ${j.label} : ${j.count} décisions (${j.pct}%)`);
  }
  lines.push("");

  lines.push("RÉPARTITION PAR CHAMBRE (top 8) :");
  for (const c of stats.byChamber.slice(0, 8)) {
    lines.push(`- ${c.label} : ${c.count} décisions (${c.pct}%)`);
  }
  lines.push("");

  lines.push("DISPOSITIF (top 6) :");
  for (const s of stats.bySolution.slice(0, 6)) {
    lines.push(`- ${s.label} : ${s.count} décisions (${s.pct}%)`);
  }
  lines.push("");

  // Montants extraits arithmétiquement des sommaires (regex + filtre indemnitaire).
  const m = stats.montantsStats;
  if (m.montants.samples > 0) {
    lines.push(
      `MONTANTS DÉTECTÉS DANS LES SOMMAIRES (échantillon : ${m.montants.samples} décision${m.montants.samples > 1 ? "s" : ""}) :`,
    );
    lines.push(`- Min : ${formatEuros(m.montants.min)}`);
    lines.push(`- Médiane : ${formatEuros(m.montants.median)}`);
    lines.push(`- Max : ${formatEuros(m.montants.max)}`);
    lines.push("");
  } else {
    lines.push("MONTANTS DÉTECTÉS DANS LES SOMMAIRES : aucun montant indemnitaire détecté arithmétiquement dans le corpus (samples=0).");
    lines.push("");
  }
  if (m.article700.sampleSize > 0) {
    lines.push(
      `ARTICLE 700 CPC (échantillon : ${m.article700.sampleSize} décision${m.article700.sampleSize > 1 ? "s" : ""}) :`,
    );
    lines.push(
      `- Taux de condamnation : ${m.article700.tauxCondamnation ?? 0}% (corpus de ${stats.total} décisions)`,
    );
    lines.push(`- Montant moyen : ${formatEuros(m.article700.montantMoyen)}`);
    lines.push(`- Montant médian : ${formatEuros(m.article700.montantMedian)}`);
    lines.push("");
  } else {
    lines.push("ARTICLE 700 CPC : aucun montant détecté arithmétiquement (samples=0).");
    lines.push("");
  }
  if (m.dommagesInterets.samples > 0) {
    lines.push(
      `DOMMAGES-INTÉRÊTS DÉTECTÉS (échantillon : ${m.dommagesInterets.samples}) :`,
    );
    lines.push(`- Min : ${formatEuros(m.dommagesInterets.min)}`);
    lines.push(`- Médiane : ${formatEuros(m.dommagesInterets.median)}`);
    lines.push(`- Max : ${formatEuros(m.dommagesInterets.max)}`);
    lines.push("");
  }

  // ─── Tendances temporelles (Niveau 3 jurimétrie avancée) ───
  if (stats.temporalTrend.buckets.length >= 3) {
    lines.push("TENDANCE TEMPORELLE (taux d'acceptation au fond par année) :");
    for (const b of stats.temporalTrend.buckets) {
      lines.push(`- ${b.year} : ${b.favorables}/${b.total} favorables (${b.rate}%)`);
    }
    const dirLabel =
      stats.temporalTrend.direction === "ascending"
        ? `📈 EN HAUSSE (+${stats.temporalTrend.deltaPct} pts sur la période)`
        : stats.temporalTrend.direction === "descending"
          ? `📉 EN BAISSE (${stats.temporalTrend.deltaPct} pts sur la période)`
          : stats.temporalTrend.direction === "flat"
            ? `➡️ STABLE (variation ${stats.temporalTrend.deltaPct} pts, non significative)`
            : "Données insuffisantes pour conclure";
    lines.push(`Direction : ${dirLabel}`);
    if (stats.temporalTrend.medianYear) {
      lines.push(`Année médiane du corpus : ${stats.temporalTrend.medianYear}`);
    }
    lines.push("");
  }

  // ─── Variations régionales (CA) ───
  if (stats.regionalVariations.length >= 2) {
    lines.push("VARIATIONS RÉGIONALES (taux d'acceptation par cour d'appel) :");
    for (const v of stats.regionalVariations.slice(0, 8)) {
      lines.push(
        `- ${v.label} : ${v.favorables}/${v.total} favorables (${v.rate}%)`
      );
    }
    const max = stats.regionalVariations[0];
    const min = stats.regionalVariations[stats.regionalVariations.length - 1];
    if (max && min && max.label !== min.label) {
      lines.push(
        `Écart : ${max.label} (${max.rate}%) vs ${min.label} (${min.rate}%) = ${Math.round((max.rate - min.rate) * 10) / 10} pts`
      );
    }
    lines.push("");
  }

  // ─── Variations par chambre / formation ───
  if (stats.chamberVariations.length >= 2) {
    lines.push("VARIATIONS PAR CHAMBRE / FORMATION (taux d'acceptation) :");
    for (const v of stats.chamberVariations.slice(0, 6)) {
      lines.push(
        `- ${v.label} : ${v.favorables}/${v.total} favorables (${v.rate}%)`
      );
    }
    lines.push("");
  }

  // ─── Variations par thème juridique ───
  if (stats.themeVariations.length >= 2) {
    lines.push("VARIATIONS PAR THÈME JURIDIQUE (taux par sous-sujet du corpus) :");
    for (const v of stats.themeVariations.slice(0, 8)) {
      lines.push(
        `- ${v.label} : ${v.favorables}/${v.total} favorables (${v.rate}%)`
      );
    }
    lines.push("");
  }

  // ─── Taux par moyen juridique (Axe 2) ───
  if (stats.argumentStats.length > 0) {
    lines.push("TAUX PAR ARGUMENT JURIDIQUE (top 8 — invoqués ≥ 2) :");
    for (const a of stats.argumentStats) {
      lines.push(
        `- ${a.name} : ${a.invoque} invoqués, ${a.retenu} retenus (${a.taux}%)`,
      );
    }
    lines.push("");
  }

  lines.push("══════════════════════════════════════════════════════════════════════");
  return lines.join("\n");
}

export { HIERARCHY_LABELS };
