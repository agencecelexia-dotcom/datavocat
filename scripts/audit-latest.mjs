#!/usr/bin/env node
// Audit la dernière analyse Datavocat : extraction des refs, vérification
// contre le corpus stocké, contrôle de cohérence des statistiques.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ env Supabase manquantes");
  process.exit(1);
}

const ANALYSIS_ID = process.argv[2]; // optionnel — sinon dernière

// ─── Helpers ─────────────────────────────────────────────────────
const ECLI_REGEX = /ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+/g;
const POURVOI_REGEX = /\b\d{2}[-/.]\d{4,5}(?:\.\d+)?\b/g;

function normalizeRef(r) {
  return r.toUpperCase().replace(/[\s.\-/]/g, "");
}

function extractRefs(md) {
  const refs = new Set();
  let m;
  ECLI_REGEX.lastIndex = 0;
  while ((m = ECLI_REGEX.exec(md)) !== null) refs.add(m[0]);
  POURVOI_REGEX.lastIndex = 0;
  while ((m = POURVOI_REGEX.exec(md)) !== null) {
    if (/^\d{2}[-/.]\d{4,5}$/.test(m[0])) refs.add(m[0]);
  }
  return Array.from(refs);
}

function buildIndex(corpus) {
  const set = new Set();
  for (const d of corpus) {
    if (d.ecli) set.add(normalizeRef(d.ecli));
    if (Array.isArray(d.number)) for (const n of d.number) set.add(normalizeRef(n));
    if (d.id) set.add(normalizeRef(d.id));
  }
  return set;
}

function classifySolution(s) {
  const v = (s || "").toLowerCase();
  if (v.includes("cassation")) return "cassation";
  if (v.includes("rejet")) return "rejet";
  return "autre";
}
function classifyOutcome(s) {
  const v = (s || "").toLowerCase();
  if (v.includes("fait droit") || v.includes("accueil") || v.includes("annulation") || v.includes("condamnation"))
    return "favorable";
  if (v.includes("rejet") || v.includes("déboute") || v.includes("deboute") || v.includes("irrecevab"))
    return "defavorable";
  return "nuance";
}
function pct(p, w) {
  return w === 0 ? 0 : Math.round((p / w) * 1000) / 10;
}

function computeStats(corpus) {
  const total = corpus.length;
  const cass = corpus.filter((d) => d.jurisdiction === "cc");
  const cassByT = { cassation: 0, rejet: 0, autre: 0 };
  for (const d of cass) cassByT[classifySolution(d.solution_alt || d.solution)]++;
  const fond = corpus.filter((d) => d.jurisdiction !== "cc");
  const fondByO = { favorable: 0, defavorable: 0, nuance: 0 };
  for (const d of fond) fondByO[classifyOutcome(d.solution_alt || d.solution)]++;
  return {
    total,
    cassationRate: cass.length > 0 ? pct(cassByT.cassation, cass.length) : null,
    fondAcceptanceRate: fond.length > 0 ? pct(fondByO.favorable, fond.length) : null,
    cassTotal: cass.length,
    fondTotal: fond.length,
    cassByT,
    fondByO,
  };
}

// ─── Fetch analyse ───────────────────────────────────────────────
async function fetchAnalysis() {
  let url;
  if (ANALYSIS_ID) {
    url = `${SUPABASE_URL}/rest/v1/analyses?id=eq.${ANALYSIS_ID}&select=id,query,response,judilibre_corpus,verification,created_at,status`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/analyses?status=eq.done&select=id,query,response,judilibre_corpus,verification,created_at,status&order=created_at.desc&limit=1`;
  }
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error(`❌ Supabase ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const arr = await res.json();
  if (arr.length === 0) {
    console.error("❌ aucune analyse trouvée");
    process.exit(1);
  }
  return arr[0];
}

// ─── Audit ───────────────────────────────────────────────────────
const a = await fetchAnalysis();

console.log("\n━━━ AUDIT SOURCING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`ID         : ${a.id}`);
console.log(`Créée le   : ${a.created_at}`);
console.log(`Statut     : ${a.status}`);
console.log(`Demande    : ${(a.query || "").slice(0, 200).replace(/\n/g, " ")}`);
console.log("");

const corpus = a.judilibre_corpus;
const response = a.response || "";
const verification = a.verification;

// ─── Bloc 1 : compteurs corpus & verification ──
console.log("─── CORPUS & VÉRIFICATION ─────────────────────────────");
if (!corpus || !Array.isArray(corpus)) {
  console.log("⚠️  judilibre_corpus IS NULL — analyse antérieure à la migration 00018.");
  console.log("   Audit dégradé : on extrait juste les refs et on les compte.");
  console.log("");
} else {
  console.log(`Décisions Judilibre stockées : ${corpus.length}`);
}
if (verification) {
  console.log(`Verification (post-gen)      : ${JSON.stringify(verification, null, 2)}`);
} else {
  console.log("⚠️  Pas de champ verification — analyse antérieure au pipeline.");
}
console.log("");

// ─── Bloc 2 : extraction des refs citées ──
const cited = extractRefs(response);
console.log("─── RÉFÉRENCES CITÉES DANS LE RAPPORT ───────────────");
console.log(`Total refs uniques citées (ECLI + pourvois) : ${cited.length}`);
if (corpus && Array.isArray(corpus)) {
  const idx = buildIndex(corpus);
  const verified = cited.filter((r) => idx.has(normalizeRef(r)));
  const unverified = cited.filter((r) => !idx.has(normalizeRef(r)));
  console.log(`✅ Vérifiées dans le corpus : ${verified.length}`);
  console.log(`❌ Hallucinées (non trouvées) : ${unverified.length}`);
  if (unverified.length > 0) {
    console.log(`\nDétail des refs hallucinées (max 30) :`);
    for (const r of unverified.slice(0, 30)) {
      // contexte : extrait 80 chars autour
      const idx2 = response.indexOf(r);
      const start = Math.max(0, idx2 - 60);
      const end = Math.min(response.length, idx2 + r.length + 60);
      const ctx = response.slice(start, end).replace(/\n/g, " ");
      console.log(`  - ${r}`);
      console.log(`    « …${ctx}… »`);
    }
    if (unverified.length > 30) {
      console.log(`  … et ${unverified.length - 30} autres.`);
    }
  }
}
console.log("");

// ─── Bloc 3 : statistiques ──
console.log("─── STATISTIQUES ─────────────────────────────────────");
const pctMatches = Array.from(response.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)).map(
  (m) => parseFloat(m[1].replace(",", "."))
);
const uniquePcts = Array.from(new Set(pctMatches));
console.log(`% cités dans le rapport : ${uniquePcts.length} valeurs distinctes`);

if (corpus && Array.isArray(corpus) && corpus.length > 0) {
  const stats = computeStats(corpus);
  console.log("");
  console.log("Stats CALCULÉES sur le corpus :");
  console.log(`  - Cour de cassation : ${stats.cassTotal} arrêts`);
  if (stats.cassationRate !== null) {
    console.log(
      `    → Taux de cassation : ${stats.cassationRate}% (${stats.cassByT.cassation} cassations sur ${stats.cassTotal})`
    );
  }
  console.log(`  - Juges du fond : ${stats.fondTotal} décisions`);
  if (stats.fondAcceptanceRate !== null) {
    console.log(
      `    → Taux d'acceptation : ${stats.fondAcceptanceRate}% (${stats.fondByO.favorable} favorables sur ${stats.fondTotal})`
    );
  }
}

// ─── Bloc 4 : montants ──
const eurMatches = Array.from(
  response.matchAll(/(\d{1,3}(?:[ .,]\d{3})*)\s*(?:€|euros?\b)/g)
).map((m) => m[0]);
console.log("");
console.log(`Montants en euros cités : ${eurMatches.length}`);
if (eurMatches.length > 0) {
  console.log(`  Échantillon : ${eurMatches.slice(0, 5).join(" · ")}`);
}

// ─── Bloc 5 : recommandation ──
console.log("");
console.log("─── RECOMMANDATION ───────────────────────────────────");
if (corpus && Array.isArray(corpus)) {
  const idx = buildIndex(corpus);
  const ratio = cited.length === 0 ? 1 : cited.filter((r) => idx.has(normalizeRef(r))).length / cited.length;
  if (ratio === 1 && cited.length > 0) {
    console.log("✅ FIABLE : toutes les refs citées sont dans le corpus.");
  } else if (ratio >= 0.95) {
    console.log("⚠️  FIABLE AVEC RÉSERVES : majorité vérifiée mais quelques hallucinations.");
  } else if (ratio >= 0.5) {
    console.log("❌ FRAGILE : plus de 5% de refs hallucinées. Vérification manuelle obligatoire.");
  } else {
    console.log("❌ NON VIABLE : majorité de refs hallucinées.");
  }
} else {
  console.log("⚠️  Audit dégradé — corpus non disponible. Examiner manuellement les refs.");
}
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
