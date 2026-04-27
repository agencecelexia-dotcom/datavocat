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

  lines.push("MONTANTS / ARTICLE 700 :");
  lines.push(
    `Aucun calcul automatique de montants n'est possible à partir des sommaires Judilibre. Si le corpus mentionne explicitement des montants dans certaines décisions, l'avocat les retrouvera dans le tableau de preuve. Sinon, écris "non documenté dans le corpus analysé".`
  );
  lines.push("");

  lines.push("══════════════════════════════════════════════════════════════════════");
  return lines.join("\n");
}

export { HIERARCHY_LABELS };
