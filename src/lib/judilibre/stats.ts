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
 */

import type { JudilibreDecision } from "./client";

export interface CorpusStats {
  total: number;
  bySolution: Array<{ label: string; count: number; pct: number }>;
  byJurisdiction: Array<{ label: string; count: number; pct: number }>;
  byChamber: Array<{ label: string; count: number; pct: number }>;
  byYear: Array<{ year: string; count: number }>;
  freshDecisions: number; // < 3 ans
  oldestDate: string | null;
  freshestDate: string | null;
  cassationGroup: {
    total: number;
    cassations: number;
    rejets: number;
    autres: number;
    cassationRate: number | null; // % de cassation parmi les arrêts Cass.
  };
  fondGroup: {
    total: number;
    favorables: number;
    defavorables: number;
    nuances: number;
    acceptanceRate: number | null;
  };
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

function classifySolution(solution: string): "cassation" | "rejet" | "autre" {
  const s = (solution || "").toLowerCase();
  if (s.includes("cassation")) return "cassation";
  if (s.includes("rejet")) return "rejet";
  return "autre";
}

function classifyOutcome(
  solution: string
): "favorable" | "defavorable" | "nuance" {
  // Côté juge du fond : on regarde simplement si la demande est accueillie ou non.
  // On considère "favorable" toute solution qui inclut "fait droit", "accueil",
  // "infirmation" partielle ; "défavorable" si "rejet", "déboute" ; sinon "nuance".
  const s = (solution || "").toLowerCase();
  if (
    s.includes("fait droit") ||
    s.includes("accueil") ||
    s.includes("annulation") ||
    s.includes("condamnation")
  )
    return "favorable";
  if (
    s.includes("rejet") ||
    s.includes("déboute") ||
    s.includes("deboute") ||
    s.includes("irrecevab")
  )
    return "defavorable";
  return "nuance";
}

function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Calcule l'ensemble des statistiques agrégées sur le corpus.
 */
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
    const label =
      d.jurisdiction === "cc"
        ? "Cour de cassation"
        : `CA ${d.jurisdiction || ""}`.trim();
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
    .filter(Boolean)
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
  const freshDecisions = decisions.filter((d) => d.date >= threeYearsAgo).length;

  // Cassation group (juridiction = "cc")
  const cassDecisions = decisions.filter((d) => d.jurisdiction === "cc");
  const cassByType = { cassation: 0, rejet: 0, autre: 0 };
  for (const d of cassDecisions) {
    const t = classifySolution(d.solution_alt || d.solution || "");
    cassByType[t]++;
  }
  const cassationGroup = {
    total: cassDecisions.length,
    cassations: cassByType.cassation,
    rejets: cassByType.rejet,
    autres: cassByType.autre,
    cassationRate:
      cassDecisions.length > 0
        ? pct(cassByType.cassation, cassDecisions.length)
        : null,
  };

  // Fond group (juridiction != "cc" — CA, TJ, TC, CPH, etc.)
  const fondDecisions = decisions.filter((d) => d.jurisdiction !== "cc");
  const fondByOutcome = { favorable: 0, defavorable: 0, nuance: 0 };
  for (const d of fondDecisions) {
    const o = classifyOutcome(d.solution_alt || d.solution || "");
    fondByOutcome[o]++;
  }
  const fondGroup = {
    total: fondDecisions.length,
    favorables: fondByOutcome.favorable,
    defavorables: fondByOutcome.defavorable,
    nuances: fondByOutcome.nuance,
    acceptanceRate:
      fondDecisions.length > 0
        ? pct(fondByOutcome.favorable, fondDecisions.length)
        : null,
  };

  return {
    total,
    bySolution,
    byJurisdiction,
    byChamber,
    byYear,
    freshDecisions,
    oldestDate: dates[0] || null,
    freshestDate: dates[dates.length - 1] || null,
    cassationGroup,
    fondGroup,
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
    `(Ces chiffres sont calculés arithmétiquement sur les ${stats.total} décisions Judilibre fournies. RÉCITE-LES SANS LES MODIFIER. Si une rubrique manque, écris "non documenté dans le corpus analysé".)`
  );
  lines.push("");

  lines.push(`Total décisions analysées : ${stats.total}`);
  lines.push(
    `Période : ${stats.oldestDate || "N/C"} → ${stats.freshestDate || "N/C"}`
  );
  lines.push(
    `Décisions de moins de 3 ans : ${stats.freshDecisions} (${pct(stats.freshDecisions, stats.total)}%)`
  );
  lines.push("");

  lines.push("RÉPARTITION PAR INSTANCE :");
  lines.push(
    `- Cour de cassation : ${stats.cassationGroup.total} arrêts (${pct(stats.cassationGroup.total, stats.total)}%)`
  );
  lines.push(
    `- Juges du fond (CA + 1ère instance) : ${stats.fondGroup.total} décisions (${pct(stats.fondGroup.total, stats.total)}%)`
  );
  lines.push("");

  if (stats.cassationGroup.total >= 5) {
    lines.push(
      `GROUPE CASSATION (${stats.cassationGroup.total} arrêts) :`
    );
    lines.push(
      `- Cassations prononcées : ${stats.cassationGroup.cassations} (${pct(stats.cassationGroup.cassations, stats.cassationGroup.total)}%)`
    );
    lines.push(
      `- Rejets de pourvoi : ${stats.cassationGroup.rejets} (${pct(stats.cassationGroup.rejets, stats.cassationGroup.total)}%)`
    );
    lines.push(
      `- Autres dispositifs : ${stats.cassationGroup.autres} (${pct(stats.cassationGroup.autres, stats.cassationGroup.total)}%)`
    );
    lines.push(
      `- Taux de cassation : ${stats.cassationGroup.cassationRate}%`
    );
    lines.push("");
  } else if (stats.cassationGroup.total > 0) {
    lines.push(
      `GROUPE CASSATION : ${stats.cassationGroup.total} arrêt(s) — données insuffisantes pour ce groupe (< 10).`
    );
    lines.push("");
  }

  if (stats.fondGroup.total >= 5) {
    lines.push(`GROUPE FOND (${stats.fondGroup.total} décisions) :`);
    lines.push(
      `- Favorables au demandeur : ${stats.fondGroup.favorables} (${pct(stats.fondGroup.favorables, stats.fondGroup.total)}%)`
    );
    lines.push(
      `- Défavorables : ${stats.fondGroup.defavorables} (${pct(stats.fondGroup.defavorables, stats.fondGroup.total)}%)`
    );
    lines.push(
      `- Nuancées : ${stats.fondGroup.nuances} (${pct(stats.fondGroup.nuances, stats.fondGroup.total)}%)`
    );
    lines.push(
      `- Taux d'acceptation des demandes : ${stats.fondGroup.acceptanceRate}%`
    );
    lines.push("");
  } else if (stats.fondGroup.total > 0) {
    lines.push(
      `GROUPE FOND : ${stats.fondGroup.total} décision(s) — données insuffisantes pour ce groupe (< 10).`
    );
    lines.push("");
  }

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
