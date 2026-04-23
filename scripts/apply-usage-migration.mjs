#!/usr/bin/env node
// Applique la migration 00017 (table api_usage) sur Supabase prod via REST.

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ env Supabase manquant");
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "00017_create_api_usage.sql"),
  "utf8"
);

console.log("Applying migration 00017_create_api_usage.sql …");

// Supabase REST ne permet pas d'exécuter du SQL arbitraire. On utilise
// l'endpoint RPC "exec_sql" s'il existe, sinon on demande à l'utilisateur
// d'appliquer la migration via le SQL editor du dashboard.
const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ sql }),
});

if (res.status === 404) {
  console.log("\n⚠️  L'endpoint rpc/exec_sql n'existe pas sur ce projet Supabase.");
  console.log("   Tu dois appliquer la migration manuellement :");
  console.log("   1. Ouvre https://supabase.com/dashboard/project/" +
    url.replace(/^https:\/\//, "").replace(".supabase.co", "") +
    "/sql/new");
  console.log("   2. Colle le contenu de supabase/migrations/00017_create_api_usage.sql");
  console.log("   3. Run\n");
  process.exit(1);
}

if (!res.ok) {
  console.error(`❌ ${res.status}`, await res.text());
  process.exit(1);
}

console.log("✅ Migration appliquée");
