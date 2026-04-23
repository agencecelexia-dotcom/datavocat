#!/usr/bin/env node
// Usage :
//   node scripts/delete-user.mjs <email>             → dry-run (lecture seule)
//   node scripts/delete-user.mjs <email> --execute   → suppression RÉELLE (irréversible)
//
// Charge les env vars depuis .env.local si présent.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const email = process.argv[2];
const execute = process.argv.includes("--execute");

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/delete-user.mjs <email> [--execute]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n═══ ${execute ? "SUPPRESSION" : "DRY-RUN"} pour ${email} ═══`);
console.log(`Projet Supabase : ${url}\n`);

// 1. Trouver le user via auth.admin
const { data: userList, error: listErr } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listErr) {
  console.error("❌ Échec listUsers :", listErr.message);
  process.exit(1);
}
const user = userList.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
if (!user) {
  console.log(`⚠️  Aucun utilisateur avec l'email ${email}.`);
  process.exit(0);
}
const userId = user.id;
console.log(`✓ User trouvé : ${userId}`);
console.log(`  Créé : ${user.created_at}`);
console.log(`  Dernière connexion : ${user.last_sign_in_at || "jamais"}`);
console.log(`  Métadonnées : ${JSON.stringify(user.user_metadata || {})}\n`);

// 2. Lister les analyses
const { data: analyses, error: aErr } = await admin
  .from("analyses")
  .select("id, query, status, created_at")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
if (aErr) {
  console.error("❌ Échec lecture analyses :", aErr.message);
} else {
  console.log(`✓ Analyses liées : ${analyses?.length || 0}`);
  if (analyses && analyses.length > 0) {
    for (const a of analyses.slice(0, 5)) {
      console.log(`  • ${a.created_at.slice(0, 10)} — ${a.status} — ${a.query.slice(0, 70)}…`);
    }
    if (analyses.length > 5) console.log(`  … et ${analyses.length - 5} autres`);
  }
}

// 3. Lister profile
const { data: profile } = await admin
  .from("profiles")
  .select("id, cabinet_id, created_at")
  .eq("id", userId)
  .maybeSingle();
if (profile) {
  console.log(`\n✓ Profil trouvé : cabinet_id=${profile.cabinet_id || "—"}`);
} else {
  console.log(`\n- Pas de profil séparé (table profiles)`);
}

// 4. Lister cabinet (si profil + cabinet_id)
let cabinet = null;
if (profile?.cabinet_id) {
  const { data: cab } = await admin
    .from("cabinets")
    .select("id, name, created_at")
    .eq("id", profile.cabinet_id)
    .maybeSingle();
  cabinet = cab;
  if (cab) console.log(`✓ Cabinet lié : ${cab.name} (id=${cab.id})`);
}

console.log(`\n${execute ? "⚠️  SUPPRESSION EN COURS…" : "📋 Dry-run terminé. Ajoutez --execute pour supprimer."}\n`);

if (!execute) process.exit(0);

// ═══ SUPPRESSION RÉELLE ═══
let errors = 0;

// 1. Analyses
if (analyses && analyses.length > 0) {
  const { error } = await admin.from("analyses").delete().eq("user_id", userId);
  if (error) {
    console.error(`  ❌ analyses : ${error.message}`);
    errors++;
  } else {
    console.log(`  ✓ ${analyses.length} analyse(s) supprimée(s)`);
  }
}

// 2. Profile
if (profile) {
  const { error } = await admin.from("profiles").delete().eq("id", userId);
  if (error) {
    console.error(`  ❌ profiles : ${error.message}`);
    errors++;
  } else {
    console.log(`  ✓ Profil supprimé`);
  }
}

// 3. Cabinet (uniquement si l'utilisateur était le seul membre)
if (cabinet) {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("cabinet_id", cabinet.id);
  if ((count || 0) === 0) {
    const { error } = await admin.from("cabinets").delete().eq("id", cabinet.id);
    if (error) {
      console.error(`  ❌ cabinets : ${error.message}`);
      errors++;
    } else {
      console.log(`  ✓ Cabinet supprimé (plus aucun membre)`);
    }
  } else {
    console.log(`  - Cabinet ${cabinet.name} conservé : ${count} autre(s) membre(s)`);
  }
}

// 4. Auth user
const { error: authErr } = await admin.auth.admin.deleteUser(userId);
if (authErr) {
  console.error(`  ❌ auth.admin.deleteUser : ${authErr.message}`);
  errors++;
} else {
  console.log(`  ✓ Utilisateur auth supprimé`);
}

console.log(`\n${errors === 0 ? "✅ Suppression complète." : `⚠️  ${errors} erreur(s).`}\n`);
process.exit(errors === 0 ? 0 : 1);
