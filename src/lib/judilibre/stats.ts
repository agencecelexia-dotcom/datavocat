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
  /**
   * Décisions dont le dispositif est absent ou non interprétable.
   * Elles sont EXCLUES du dénominateur des taux : les compter reviendrait à
   * faire baisser mécaniquement tout taux d'acceptation à proportion des
   * sources qui n'exposent pas de champ `solution` (fonds JURI notamment).
   */
  indetermines: number;
  /**
   * Dénominateur réellement utilisé pour `acceptanceRate` :
   * total − indetermines. Exposé pour que l'UI puisse afficher « n = X ».
   */
  classifiables: number;
  acceptanceRate: number | null;
  // Spécifique cassation : taux de cassation (cassations / classifiables)
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
   * Taux de RÉFORMATION / d'issue favorable au demandeur observé dans le
   * corpus. Ce n'est PAS une probabilité de succès pour l'affaire de l'avocat :
   *   - le corpus n'est pas un échantillon aléatoire (top-N d'un moteur de
   *     recherche, sur un fonds où la 1re instance est peu publiée) ;
   *   - Judilibre n'indique pas qui est appelant, donc « infirme » ne veut pas
   *     dire « le demandeur initial gagne ».
   * À présenter comme une observation sur le corpus, jamais comme un pronostic.
   *   - corpus mixte ou majoritairement fond → taux d'issue favorable au fond
   *   - corpus 100% Cassation → taux de cassation (succès du pourvoi)
   *   - échantillon < 15 décisions classifiables → null
   */
  tauxSuccesRetenu: number | null;
  /** Source du taux retenu (informatif, pour l'UI). */
  tauxSuccesSource: "fond" | "cassation" | "mixte" | null;
  /** Effectif sur lequel le taux est calculé (décisions classifiables). */
  tauxSuccesN: number;
  /** Marge d'erreur à 95 %, en points de pourcentage. */
  tauxSuccesMarge: number | null;
  /** Décisions du corpus dont le dispositif est absent ou illisible. */
  indeterminesTotal: number;
  /**
   * Vrai si le corpus ne contient des dispositifs que d'un seul sens (aucune
   * décision défavorable). Le taux y vaudrait 100 % ± 0 et ne mesurerait que
   * le biais de sélection du moteur de recherche : il n'est donc pas publié.
   */
  corpusUnilateral: boolean;
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

/**
 * Juridictions dont le dispositif ne décrit pas une issue au fond et qui ne
 * doivent donc jamais peser dans un taux :
 *   - "tc"      : Tribunal des conflits (tranche la compétence, pas le litige)
 *   - "constit" : Conseil constitutionnel (contrôle de constitutionnalité)
 */
const JURIDICTIONS_HORS_TAUX = new Set(["tc", "constit"]);

function classifyOutcome(
  solution: string
): "favorable" | "defavorable" | "nuance" | "indetermine" {
  // "favorable" pour la partie qui demande, "défavorable" sinon.
  // - dispositif ABSENT ou "other"  → "indetermine" : exclu des dénominateurs.
  // - dispositif lu mais mitigé     → "nuance"      : compté, ni fav ni défav.
  //
  // La distinction est essentielle : les fonds Légifrance (JURI) n'exposent
  // aucun champ `solution`. Les classer en "nuance" les faisait entrer dans
  // le dénominateur des taux sans pouvoir être favorables — ajouter 30 JURI
  // à un corpus de 100 abaissait mécaniquement tout taux d'environ 23 %.
  //
  // Couvre les libellés réels de Judilibre :
  // - Cass : "Cassation", "Rejet", "Cassation partielle"...
  // - CA   : "Infirme partiellement, réforme...", "Confirme la décision déférée...",
  //          "Infirme la décision déférée dans toutes ses dispositions..."
  const s = (solution || "").toLowerCase().trim();
  if (s === "" || s === "other") return "indetermine";

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
    indetermines: 0,
    classifiables: 0,
    acceptanceRate: null,
  };
}

/**
 * Calcule les stats d'une catégorie de la hiérarchie.
 *
 * Les taux sont rapportés aux décisions CLASSIFIABLES (dispositif lisible),
 * pas au total : une décision sans dispositif n'apporte aucune information
 * sur l'issue et ne doit pas peser dans un taux.
 */
function statsFromDecisions(decisions: JudilibreDecision[]): CategoryStats {
  if (decisions.length === 0) return emptyCategoryStats();
  let favorables = 0;
  let defavorables = 0;
  let nuances = 0;
  let indetermines = 0;
  let cassations = 0;
  let rejets = 0;
  for (const d of decisions) {
    const sol = d.solution_alt || d.solution || "";
    // Une juridiction qui ne tranche pas le fond est comptée comme
    // indéterminée : elle reste dans le corpus mais sort des dénominateurs.
    const o = JURIDICTIONS_HORS_TAUX.has((d.jurisdiction || "").toLowerCase())
      ? "indetermine"
      : classifyOutcome(sol);
    if (o === "favorable") favorables++;
    else if (o === "defavorable") defavorables++;
    else if (o === "nuance") nuances++;
    else indetermines++;

    const c = classifySolution(sol);
    if (c === "cassation") cassations++;
    else if (c === "rejet") rejets++;
  }
  const classifiables = decisions.length - indetermines;
  return {
    total: decisions.length,
    favorables,
    defavorables,
    nuances,
    indetermines,
    classifiables,
    acceptanceRate: classifiables > 0 ? pct(favorables, classifiables) : null,
    cassations,
    rejets,
    cassationRate: classifiables > 0 ? pct(cassations, classifiables) : null,
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

  // Cohérence jurisprudentielle = max(fav, def) / décisions classifiables.
  // Le dénominateur exclut les décisions sans dispositif : les inclure faisait
  // chuter la « cohérence » à proportion des sources muettes (JURI, CETAT sans
  // dispositif inférable) — or ce chiffre pèse 35 % de l'indice de fiabilité,
  // si bien qu'un défaut de parsing se transformait en verdict de fiabilité.
  let totalFav = 0;
  let totalDef = 0;
  let totalIndetermine = 0;
  for (const d of decisions) {
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    if (o === "favorable") totalFav++;
    else if (o === "defavorable") totalDef++;
    else if (o === "indetermine") totalIndetermine++;
  }
  const classifiablesTotal = total - totalIndetermine;
  const dominant = Math.max(totalFav, totalDef);
  const coherencePct =
    classifiablesTotal > 0 ? pct(dominant, classifiablesTotal) : 0;

  // Taux de succès retenu — chiffre canonique à afficher au client.
  // Logique :
  //   - Si corpus contient des décisions du fond (1er degré OU CA) → on
  //     prend le taux d'acceptation calculé sur le fond (le plus pertinent
  //     pour estimer les chances en pratique).
  //   - Sinon (corpus 100% Cass) → on affiche le taux de cassation, qui
  //     est le taux de succès des pourvois (signal pour un client en Cass).
  //   - Si vide → null.
  // Dénominateur = décisions au fond dont le dispositif est lisible.
  const fondTotal =
    hierarchy.premierDegre.classifiables + hierarchy.courAppel.classifiables;
  const fondFav =
    hierarchy.premierDegre.favorables + hierarchy.courAppel.favorables;
  let tauxSuccesRetenu: number | null = null;
  let tauxSuccesSource: "fond" | "cassation" | "mixte" | null = null;
  let tauxSuccesN = 0;
  // Seuil relevé de 5 à 15 : sous 15 décisions, l'intervalle de confiance à
  // 95 % dépasse ±25 points — publier un pourcentage y suggère une précision
  // que l'échantillon ne porte pas. En dessous, on renvoie null et l'UI
  // affiche les effectifs bruts.
  const MIN_SAMPLE_FOR_RATE = 15;

  // ─── Garde-fou : corpus dégénéré ───────────────────────────────────
  // Constaté en test réel : sur certaines requêtes, Judilibre ne remonte que
  // des dispositifs d'un seul sens (52 cassations + 35 infirmations, aucun
  // rejet ni confirmation). Le taux vaut alors 100 % avec une marge de ±0 —
  // un chiffre d'apparence parfaitement précise qui ne mesure QUE le biais de
  // sélection du moteur de recherche, pas une réalité jurisprudentielle.
  //
  // Publier ce chiffre serait plus trompeur que de n'en publier aucun : on le
  // supprime et l'UI se rabat sur les effectifs bruts.
  const fondDefav =
    hierarchy.premierDegre.defavorables + hierarchy.courAppel.defavorables;
  const fondNuances =
    hierarchy.premierDegre.nuances + hierarchy.courAppel.nuances;
  const corpusFondDegenere =
    fondTotal > 0 && fondDefav === 0 && fondNuances === 0;
  const corpusCassDegenere =
    hierarchy.cassation.classifiables > 0 &&
    (hierarchy.cassation.rejets ?? 0) === 0;

  if (fondTotal >= MIN_SAMPLE_FOR_RATE && !corpusFondDegenere) {
    tauxSuccesRetenu = pct(fondFav, fondTotal);
    tauxSuccesN = fondTotal;
    tauxSuccesSource =
      hierarchy.cassation.classifiables >= MIN_SAMPLE_FOR_RATE
        ? "mixte"
        : "fond";
  } else if (
    hierarchy.cassation.classifiables >= MIN_SAMPLE_FOR_RATE &&
    !corpusCassDegenere
  ) {
    tauxSuccesRetenu = hierarchy.cassation.cassationRate ?? null;
    tauxSuccesN = hierarchy.cassation.classifiables;
    tauxSuccesSource = "cassation";
  }

  // Marge d'erreur à 95 % (approximation normale : 1,96 × √(p(1−p)/n)).
  // Affichée à côté du taux pour que l'avocat lise l'incertitude réelle.
  let tauxSuccesMarge: number | null = null;
  if (tauxSuccesRetenu !== null && tauxSuccesN > 0) {
    const p = tauxSuccesRetenu / 100;
    tauxSuccesMarge =
      Math.round(1.96 * Math.sqrt((p * (1 - p)) / tauxSuccesN) * 1000) / 10;
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
    if (o === "indetermine") continue; // hors dénominateur
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

  // ─── Variations régionales : DÉSACTIVÉES ────────────────────────────
  // Judilibre n'expose pas le ressort d'une cour d'appel. L'implémentation
  // précédente construisait `label = "CA " + d.chamber` — elle produisait donc
  // des variations PAR CHAMBRE étiquetées comme des variations PAR COUR, et le
  // prompt faisait affirmer à l'analyse « la CA la plus favorable est X » sur
  // cette base. C'est une information fausse pour l'avocat, qui peut orienter
  // un choix de juridiction de saisine.
  //
  // `chamberVariations` (ci-dessous) calcule déjà correctement la même chose
  // sous son vrai nom. On renvoie donc un tableau vide tant que la donnée de
  // ressort n'est pas disponible.
  const regionalVariations: Array<{
    label: string;
    total: number;
    favorables: number;
    rate: number;
  }> = [];

  // Variations par chambre / formation
  const chamberAccum: Record<
    string,
    { total: number; favorables: number }
  > = {};
  for (const d of decisions) {
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    if (o === "indetermine") continue; // hors dénominateur
    // Une chambre non renseignée reste "Non précisé" — on ne la range pas
    // dans "Autre" avec les chambres connues mais non mappées.
    const ch = CHAMBER_LABELS[d.chamber] || d.chamber || "Non précisé";
    if (!chamberAccum[ch]) chamberAccum[ch] = { total: 0, favorables: 0 };
    chamberAccum[ch].total++;
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
  // NB : une décision alimente jusqu'à 3 thèmes — la somme des `total` de
  // themeVariations dépasse donc le corpus. Ces effectifs ne sont PAS
  // additionnables entre eux ni comparables au total du corpus.
  for (const d of decisions) {
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    if (o === "indetermine") continue; // hors dénominateur
    const themes = d.themes || [];
    for (const t of themes.slice(0, 3)) {
      // top 3 thèmes max par décision pour éviter explosion
      const label = t.split(" - ")[0]?.trim() || t.trim();
      if (!label) continue;
      if (!themeAccum[label]) themeAccum[label] = { total: 0, favorables: 0 };
      themeAccum[label].total++;
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

  // Issue favorable PAR THÈME DE CLASSEMENT (top 8).
  //
  // ⚠️ Ce n'est PAS un « taux de succès par argument juridique ». Le champ
  // `themes` de Judilibre est un classement documentaire (titrage matière),
  // pas la liste des moyens invoqués par les parties : il n'existe aucun lien
  // causal entre le thème sous lequel une décision est indexée et le moyen qui
  // a emporté la conviction du juge. Les libellés `invoque`/`retenu` sont
  // conservés pour compatibilité, mais l'UI et le prompt doivent parler de
  // « décisions classées sous ce thème » et « issue favorable ».
  const argAccum: Record<string, { invoque: number; retenu: number }> = {};
  for (const d of decisions) {
    const outcome = classifyOutcome(d.solution_alt || d.solution || "");
    if (outcome === "indetermine") continue; // hors dénominateur
    const themes = d.themes || [];
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
    // Seuil relevé de 2 à 5 : un « taux » sur 2 décisions ne vaut que 0 %,
    // 50 % ou 100 % et se lit pourtant comme une statistique.
    .filter(([, v]) => v.invoque >= 5)
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
    tauxSuccesN,
    tauxSuccesMarge,
    indeterminesTotal: totalIndetermine,
    corpusUnilateral: corpusFondDegenere || corpusCassDegenere,
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
      stats.tauxSuccesSource === "cassation"
        ? "part des arrêts de Cassation ayant cassé — applicable UNIQUEMENT si la stratégie envisage un pourvoi"
        : "part des décisions du fond (1er degré + CA) dont le dispositif est favorable au demandeur";
    const marge =
      stats.tauxSuccesMarge !== null ? ` ± ${stats.tauxSuccesMarge} points` : "";
    lines.push(
      `TAUX D'ISSUE FAVORABLE OBSERVÉ : ${stats.tauxSuccesRetenu}%${marge} (n = ${stats.tauxSuccesN} décisions au dispositif lisible — ${labelSrc})`
    );
    lines.push(
      `⚠️ CADRAGE OBLIGATOIRE de ce chiffre : c'est une OBSERVATION SUR CE CORPUS, PAS une probabilité de succès.`
    );
    lines.push(
      `   - Le corpus n'est pas un échantillon aléatoire : ce sont les décisions les plus proches textuellement de la requête, sur un fonds où la 1re instance est très partiellement publiée.`
    );
    lines.push(
      `   - Judilibre n'indique pas quelle partie a formé le recours : « infirme » ne signifie donc pas « le demandeur initial l'emporte ».`
    );
    lines.push(
      `   Tu DOIS présenter ce chiffre comme une tendance observée, et n'écris JAMAIS « X% de chances de succès ».`
    );
  } else if (stats.corpusUnilateral) {
    lines.push(
      `TAUX D'ISSUE FAVORABLE : NON PUBLIABLE sur ce corpus.`
    );
    lines.push(
      `Motif : toutes les décisions récupérées vont dans le même sens (aucune décision défavorable). Le taux vaudrait mécaniquement 100 % — il mesurerait le biais de sélection du moteur de recherche, pas la jurisprudence.`
    );
    lines.push(
      `Tu DOIS écrire : « Le taux d'issue favorable n'est pas calculable sur ce corpus : la recherche n'a remonté que des décisions allant dans un seul sens (aucun rejet ni confirmation). Ce déséquilibre reflète le mode de sélection des décisions, non la réalité du contentieux. » Puis donne les effectifs bruts SANS en tirer de pourcentage de succès.`
    );
  } else {
    lines.push(
      `TAUX D'ISSUE FAVORABLE : non calculable — moins de 15 décisions au dispositif lisible dans la catégorie pertinente. Écris « non calculable sur ce corpus » et donne les effectifs bruts.`
    );
  }
  if (stats.indeterminesTotal > 0) {
    lines.push(
      `Décisions au dispositif absent ou illisible : ${stats.indeterminesTotal} sur ${stats.total} — EXCLUES du dénominateur de tous les taux ci-dessus.`
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
  // Seuil minimal pour publier une distribution de montants. En dessous, une
  // « médiane » sur 1 ou 2 décisions se lit comme une fourchette de marché
  // alors qu'elle ne décrit qu'un ou deux cas isolés.
  const MIN_MONTANT_SAMPLES = 5;
  const m = stats.montantsStats;
  const montantsCaveat =
    "⚠️ Ces montants proviennent des SOMMAIRES, or seuls les arrêts publiés en ont — la Cour de cassation ne fixe d'ailleurs pas les montants. Présente-les comme des ordres de grandeur observés, jamais comme un barème.";

  if (m.montants.samples >= MIN_MONTANT_SAMPLES) {
    lines.push(
      `MONTANTS DÉTECTÉS DANS LES SOMMAIRES (échantillon : ${m.montants.samples} décisions) :`,
    );
    lines.push(`- Min : ${formatEuros(m.montants.min)}`);
    lines.push(`- Médiane : ${formatEuros(m.montants.median)}`);
    lines.push(`- Max : ${formatEuros(m.montants.max)}`);
    lines.push(montantsCaveat);
    lines.push("");
  } else if (m.montants.samples > 0) {
    lines.push(
      `MONTANTS DÉTECTÉS : seulement ${m.montants.samples} décision${m.montants.samples > 1 ? "s" : ""} avec un montant identifiable — échantillon insuffisant pour une fourchette. Écris « non documenté dans le corpus analysé ».`,
    );
    lines.push("");
  } else {
    lines.push("MONTANTS DÉTECTÉS DANS LES SOMMAIRES : aucun montant indemnitaire détecté arithmétiquement dans le corpus (samples=0).");
    lines.push("");
  }

  if (m.article700.sampleSize >= MIN_MONTANT_SAMPLES) {
    lines.push(
      `ARTICLE 700 CPC — montants observés (échantillon : ${m.article700.sampleSize} décisions) :`,
    );
    lines.push(`- Montant moyen : ${formatEuros(m.article700.montantMoyen)}`);
    lines.push(`- Montant médian : ${formatEuros(m.article700.montantMedian)}`);
    lines.push(
      `- Taux de condamnation : NON CALCULABLE sur cette source. N'annonce AUCUN pourcentage de condamnation à l'article 700 : les sommaires ne mentionnent les frais irrépétibles que de façon marginale, un ratio serait un artefact de détection textuelle.`,
    );
    lines.push("");
  } else {
    lines.push(
      "ARTICLE 700 CPC : échantillon insuffisant pour publier des montants. Écris « non documenté dans le corpus analysé ».",
    );
    lines.push("");
  }

  if (m.dommagesInterets.samples >= MIN_MONTANT_SAMPLES) {
    lines.push(
      `DOMMAGES-INTÉRÊTS DÉTECTÉS (échantillon : ${m.dommagesInterets.samples}) :`,
    );
    lines.push(`- Min : ${formatEuros(m.dommagesInterets.min)}`);
    lines.push(`- Médiane : ${formatEuros(m.dommagesInterets.median)}`);
    lines.push(`- Max : ${formatEuros(m.dommagesInterets.max)}`);
    lines.push(montantsCaveat);
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

  // ─── Variations régionales ───
  // Non calculables : Judilibre n'expose pas le ressort d'une cour d'appel.
  // On l'indique explicitement pour que le modèle n'improvise pas la section.
  lines.push(
    "VARIATIONS RÉGIONALES : non disponibles — l'API Judilibre n'expose pas le ressort géographique des cours d'appel. N'affirme AUCUN écart entre cours d'appel et écris « non documenté dans le corpus analysé » si la question se pose."
  );
  lines.push("");

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

  // ─── Issue favorable par thème de classement ───
  if (stats.argumentStats.length > 0) {
    lines.push("ISSUE FAVORABLE PAR THÈME DE CLASSEMENT (top 8 — au moins 5 décisions) :");
    lines.push(
      "⚠️ Ces thèmes sont le CLASSEMENT DOCUMENTAIRE Judilibre, pas les moyens invoqués par les parties. Ne présente JAMAIS ces chiffres comme un « taux de succès par argument » : rien n'établit que le thème de classement soit le moyen qui a emporté la décision.",
    );
    for (const a of stats.argumentStats) {
      lines.push(
        `- ${a.name} : ${a.retenu} issues favorables sur ${a.invoque} décisions classées sous ce thème (${a.taux}%)`,
      );
    }
    lines.push("");
  }

  lines.push("══════════════════════════════════════════════════════════════════════");
  return lines.join("\n");
}

export { HIERARCHY_LABELS };
