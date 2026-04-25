#!/usr/bin/env node
// Inspecte le corpus stocké de la dernière analyse pour comprendre les
// formats de référence, dates et solutions retournés par Judilibre.

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

const url = `${SUPABASE_URL}/rest/v1/analyses?status=eq.done&select=id,query,judilibre_corpus,verification,response&order=created_at.desc&limit=1`;
const res = await fetch(url, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
const arr = await res.json();
const a = arr[0];

console.log("\n━━━ INSPECT CORPUS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`ID : ${a.id}`);
console.log(`Demande : ${a.query.slice(0, 120)}...`);
console.log(`\nCorpus stocké : ${a.judilibre_corpus?.length || 0} décisions\n`);

if (!a.judilibre_corpus || a.judilibre_corpus.length === 0) {
  console.log("Corpus vide.");
  process.exit(0);
}

// Distribution des champs
const sample = a.judilibre_corpus.slice(0, 5);
console.log("─── ÉCHANTILLON DES 5 PREMIÈRES DÉCISIONS ──");
for (const [i, d] of sample.entries()) {
  console.log(`\n[${i + 1}] jurisdiction=${d.jurisdiction} chamber=${d.chamber}`);
  console.log(`    date=${d.date}`);
  console.log(`    ecli=${d.ecli}`);
  console.log(`    number=${JSON.stringify(d.number)}`);
  console.log(`    solution="${d.solution || ""}"`);
  console.log(`    solution_alt="${d.solution_alt || ""}"`);
  console.log(
    `    sommaire (60 char)=${(d.sommaire || "").slice(0, 60).replace(/\n/g, " ")}...`
  );
}

// Stats globales
console.log("\n─── DISTRIBUTION ─────────────────────────────────────────");
const jurDist = {};
const solDist = {};
const dateYears = {};
for (const d of a.judilibre_corpus) {
  jurDist[d.jurisdiction || "?"] = (jurDist[d.jurisdiction || "?"] || 0) + 1;
  const sol = (d.solution_alt || d.solution || "?").trim();
  solDist[sol] = (solDist[sol] || 0) + 1;
  const y = (d.date || "").slice(0, 4);
  dateYears[y] = (dateYears[y] || 0) + 1;
}
console.log("Jurisdictions :", JSON.stringify(jurDist));
console.log("Solutions :", JSON.stringify(solDist, null, 2));
console.log("Années :", JSON.stringify(dateYears));

// Format des numéros
console.log("\n─── FORMAT DES NUMÉROS (number[]) ──");
const numFormats = new Set();
for (const d of a.judilibre_corpus.slice(0, 20)) {
  if (Array.isArray(d.number)) {
    for (const n of d.number) numFormats.add(n);
  }
}
console.log([...numFormats].slice(0, 10).join("\n"));

// Format des ECLI
console.log("\n─── FORMAT DES ECLI ──");
console.log(a.judilibre_corpus.slice(0, 5).map((d) => d.ecli).join("\n"));

// Inspection de ce que Claude a écrit dans le rapport
console.log("\n─── SECTION RAPPORT (head 600 chars) ──");
console.log((a.response || "").slice(0, 600));
console.log("\n─── SECTION TABLEAU (extrait) ──");
const md = a.response || "";
const tableMatch = md.match(/\|[^\n]*\n\|[\s:|\-]+\|\n([\s\S]{0,800})/);
if (tableMatch) console.log(tableMatch[0].slice(0, 1500));

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
