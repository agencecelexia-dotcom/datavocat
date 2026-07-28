#!/usr/bin/env node
/**
 * BANC D'ESSAI — vérifie la chaîne d'analyse SANS réseau et SANS clés API.
 *
 * On injecte un corpus fabriqué mais réaliste (mélangeant volontairement des
 * juridictions françaises et des sources européennes) puis on contrôle que
 * la mécanique jurimétrique tient :
 *
 *   1. Les statistiques ne comptent QUE les juridictions françaises
 *   2. Le corpus envoyé à l'IA distingue bien les deux blocs
 *   3. Chaque juridiction est étiquetée correctement
 *   4. Les liens de sources pointent vers la bonne base
 *   5. Le mode d'emploi de l'IA est cohérent avec ce qu'on lui envoie
 *
 * Usage :  npx tsx scripts/banc-essai.mjs
 */

import {
  computeCorpusStats,
  formatStatsForPrompt,
  isStatisticalDecision,
} from "../src/lib/judilibre/stats.ts";
import { buildSourceUrl } from "../src/lib/parse-analysis.ts";
import { DATAVOCAT_SYSTEM_PROMPT } from "../src/lib/claude/analyze-prompt.ts";

// ─────────────────────────────────────────────────────────────
// SCÉNARIO : licenciement pour faute grave contesté
// ─────────────────────────────────────────────────────────────

const SCENARIO =
  "Mon client, cadre commercial avec 12 ans d'ancienneté, a été licencié " +
  "pour faute grave. Il conteste la procédure et invoque le droit au procès " +
  "équitable. Quelles sont ses chances devant le conseil de prud'hommes ?";

const dec = (o) => ({
  chamber: "soc",
  themes: [],
  solution: "",
  solution_alt: "",
  ...o,
});

// 8 décisions françaises — l'échantillon statistique
const FRANCAISES = [
  dec({ id: "d1", jurisdiction: "cc", ecli: "ECLI:FR:CCASS:2024:SO00101", number: ["22-14.501"], date: "2024-03-12", solution: "Cassation", solution_alt: "Cassation", sommaire: "Faute grave non caractérisée, ancienneté importante." }),
  dec({ id: "d2", jurisdiction: "cc", ecli: "ECLI:FR:CCASS:2023:SO00202", number: ["21-19.882"], date: "2023-09-20", solution: "Rejet", solution_alt: "Rejet", sommaire: "Faute grave retenue, insubordination répétée." }),
  dec({ id: "d3", jurisdiction: "ca", number: "21/03476", date: "2023-05-04", solution: "Infirmation", solution_alt: "Infirmation", sommaire: "Requalification en cause réelle et sérieuse, indemnité 24 000 €." }),
  dec({ id: "d4", jurisdiction: "ca", number: "22/00918", date: "2024-01-18", solution: "Confirmation", solution_alt: "Confirmation", sommaire: "Faute grave confirmée." }),
  dec({ id: "d5", jurisdiction: "ca", number: "20/07733", date: "2022-11-09", solution: "Infirmation", solution_alt: "Infirmation", sommaire: "Procédure irrégulière, indemnité 15 000 €." }),
  dec({ id: "d6", jurisdiction: "tj", number: "19/00412", date: "2022-02-15", solution: "Rejet", solution_alt: "Rejet", sommaire: "Demande de nullité rejetée." }),
  dec({ id: "d7", jurisdiction: "ce", number: ["456789"], date: "2023-07-06", solution: "Annulation", solution_alt: "Annulation", sommaire: "Licenciement d'un salarié protégé, autorisation annulée." }),
  dec({ id: "d8", jurisdiction: "tcom", number: "21/00087", date: "2023-03-22", solution: "Rejet", solution_alt: "Rejet", sommaire: "Litige connexe rejeté." }),
];

// 3 sources supranationales — contexte normatif, JAMAIS statistique
const SUPRA = [
  dec({ id: "001-234567", jurisdiction: "cedh", chamber: "CEDH", number: ["001-234567"], date: "2023-05-11", sommaire: "Exigence du procès équitable, article 6 §1." }),
  dec({ id: "62019CJ0311", jurisdiction: "cjue", chamber: "CJUE", number: ["62019CJ0311"], date: "2021-06-15", sommaire: "Portée de la directive sur le temps de travail." }),
  dec({ id: "CNILTEXT000012345", jurisdiction: "cnil", chamber: "CNIL", number: ["SAN-2024-001"], date: "2024-01-09", sommaire: "Sanction pour surveillance excessive des salariés." }),
];

const CORPUS = [...FRANCAISES, ...SUPRA];

let echecs = 0;
const ok = (cond, label, detail = "") => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) echecs++;
};

console.log("\n━━━ BANC D'ESSAI DATAVOCAT ━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`Scénario : licenciement pour faute grave`);
console.log(`Corpus   : ${FRANCAISES.length} décisions françaises + ${SUPRA.length} européennes/CNIL\n`);

// ─── 1. Les statistiques ignorent les sources supranationales ───
console.log("1. Intégrité des statistiques");
const stats = computeCorpusStats(CORPUS);
const statsSansSupra = computeCorpusStats(FRANCAISES);

ok(stats.total === FRANCAISES.length, `total = ${stats.total}`, `attendu ${FRANCAISES.length}, pas ${CORPUS.length}`);
ok(
  JSON.stringify(stats) === JSON.stringify(statsSansSupra),
  "les sources européennes ne changent AUCUNE statistique"
);
ok(SUPRA.every((d) => !isStatisticalDecision(d)), "CEDH/CJUE/CNIL exclues de l'échantillon");
ok(FRANCAISES.every((d) => isStatisticalDecision(d)), "les 8 françaises sont bien conservées");

const hier = stats.hierarchy;
ok(hier.cassation.total === 2, `hiérarchie Cassation = ${hier.cassation.total}`, "attendu 2");
ok(hier.courAppel.total === 3, `hiérarchie Cour d'appel = ${hier.courAppel.total}`, "attendu 3");
ok(hier.conseilEtat.total === 1, `hiérarchie Conseil d'État = ${hier.conseilEtat.total}`, "attendu 1");
ok(hier.premierDegre.total === 2, `hiérarchie 1er degré = ${hier.premierDegre.total}`, "attendu 2 (TJ + TCOM)");

// ─── 2. Le bloc FAITS VÉRIFIÉS annonce le bon total ───
console.log("\n2. Bloc FAITS VÉRIFIÉS envoyé à l'IA");
const factsBlock = formatStatsForPrompt(stats);
ok(factsBlock.includes(`${FRANCAISES.length} décisions`), `annonce ${FRANCAISES.length} décisions`);
ok(!factsBlock.includes(`${CORPUS.length} décisions`), "n'annonce jamais le total gonflé");

// ─── 3. Étiquetage des juridictions ───
console.log("\n3. Étiquetage des juridictions dans le corpus");
const attendus = {
  cc: "Cour de cassation",
  ca: "Cour d'appel",
  tj: "Tribunal judiciaire",
  tcom: "Tribunal de commerce",
  ce: "Conseil d'État",
  cedh: "Cour européenne des droits de l'homme",
  cjue: "Cour de justice de l'Union européenne",
  cnil: "CNIL",
};
// On reconstruit le corpus formaté via la fonction réelle du produit.
const { formatJudilibreResults } = await import("../src/lib/judilibre/client.ts");
const corpusTexte = formatJudilibreResults({
  results: CORPUS,
  total: 999,
  query: SCENARIO,
});

for (const [code, libelle] of Object.entries(attendus)) {
  ok(corpusTexte.includes(libelle), `${code} → « ${libelle} »`);
}
ok(!corpusTexte.includes("CA (cedh)"), "aucune source européenne étiquetée « CA »");
ok(!corpusTexte.includes("CA (ce)"), "le Conseil d'État n'est plus étiqueté « CA »");
ok(!corpusTexte.includes("undefined"), "aucun « undefined » dans le corpus");

// ─── 4. Cloisonnement des deux blocs ───
console.log("\n4. Cloisonnement du corpus");
ok(corpusTexte.includes("CORPUS JUDILIBRE"), "le bloc français garde son nom historique");
ok(corpusTexte.includes("CONTEXTE NORMATIF EUROPEEN"), "le bloc européen est séparé et nommé");
const idxFr = corpusTexte.indexOf("CORPUS JUDILIBRE");
const idxEu = corpusTexte.indexOf("CONTEXTE NORMATIF EUROPEEN");
ok(idxFr < idxEu, "le bloc français est présenté en premier");
const blocFr = corpusTexte.slice(idxFr, idxEu);
ok(!blocFr.includes("001-234567"), "aucune décision CEDH dans le bloc statistique");
ok(!blocFr.includes("CNILTEXT"), "aucune délibération CNIL dans le bloc statistique");
ok(
  corpusTexte.slice(idxEu).includes("INTERDIT de les compter"),
  "l'interdiction de comptage est explicite"
);

// ─── 5. Liens de sources ───
console.log("\n5. Destination des liens de sources");
const liens = [
  ["ECLI:FR:CCASS:2024:SO00101", "www.legifrance.gouv.fr"],
  ["21/03476", "www.legifrance.gouv.fr"],
  ["001-234567", "hudoc.echr.coe.int"],
  ["62019CJ0311", "eur-lex.europa.eu"],
];
for (const [ref, host] of liens) {
  const u = new URL(buildSourceUrl(ref));
  ok(u.host === host, `${ref} → ${u.host}`, `attendu ${host}`);
}

// ─── 6. Cohérence du mode d'emploi de l'IA ───
console.log("\n6. Cohérence du mode d'emploi (prompt système)");
ok(DATAVOCAT_SYSTEM_PROMPT.includes("REGLE 6"), "la règle de cloisonnement existe");
ok(
  DATAVOCAT_SYSTEM_PROMPT.includes("CONTEXTE NORMATIF EUROPEEN"),
  "le prompt nomme le bloc exactement comme le corpus"
);
ok(
  !/les decisions de la CJUE\/CEDH et des autorites independantes ne sont PAS inclus/.test(
    DATAVOCAT_SYSTEM_PROMPT
  ),
  "l'affirmation périmée « CEDH/CJUE non incluses » a disparu"
);
ok(
  DATAVOCAT_SYSTEM_PROMPT.includes("hors echantillon statistique"),
  "l'IA doit signaler les citations hors échantillon"
);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (echecs === 0) {
  console.log("✅ Banc d'essai vert — la mécanique jurimétrique est cohérente.");
  console.log("   (Valide la mécanique, pas la pertinence juridique sur données réelles.)");
  process.exit(0);
}
console.log(`❌ ${echecs} contrôle(s) en échec.`);
process.exit(1);
