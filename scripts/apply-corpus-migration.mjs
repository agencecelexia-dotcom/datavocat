#!/usr/bin/env node
// Applique la migration 00018 (judilibre_corpus + verification) sur Supabase
// prod via l'API Management (nécessite SUPABASE_ACCESS_TOKEN).

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

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("❌ SUPABASE_ACCESS_TOKEN manquant dans .env.local");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL manquant");
  process.exit(1);
}
const ref = supabaseUrl.replace(/^https?:\/\//, "").split(".")[0];

const sqlPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "00018_analyses_corpus_verification.sql"
);
const sql = fs.readFileSync(sqlPath, "utf8");

console.log(`\n━━━ Migration via Management API ━━━`);
console.log(`Project : ${ref}`);
console.log(`File    : 00018_analyses_corpus_verification.sql\n`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await res.text();

if (!res.ok) {
  console.error(`❌ ${res.status}\n${body}`);
  process.exit(1);
}

console.log("✅ Migration appliquée");
try {
  const parsed = JSON.parse(body);
  if (Array.isArray(parsed) && parsed.length > 0) {
    console.log("Retour :", parsed);
  }
} catch {
  if (body.trim()) console.log(body);
}
