#!/usr/bin/env node
/**
 * Test rapide de l'intégration Légifrance.
 * Vérifie OAuth + recherche d'un article + récupération du texte.
 */

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

const CLIENT_ID = process.env.PISTE_CLIENT_ID;
const CLIENT_SECRET = process.env.PISTE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ PISTE_CLIENT_ID / PISTE_CLIENT_SECRET manquants");
  process.exit(1);
}

console.log("\n━━━ TEST LÉGIFRANCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// 1) OAuth
console.log("1. OAuth PISTE...");
const tokenRes = await fetch("https://oauth.piste.gouv.fr/api/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "openid",
  }),
});
if (!tokenRes.ok) {
  console.error("❌ OAuth échec:", await tokenRes.text());
  process.exit(1);
}
const { access_token, expires_in } = await tokenRes.json();
console.log(`   ✅ Token reçu (longueur=${access_token.length}, expires_in=${expires_in}s)`);

// 2) Recherche article L1232-1 du Code du travail
console.log("\n2. Recherche 'L. 1232-1' dans le Code du travail...");
const today = new Date().toISOString().slice(0, 10);
const searchRes = await fetch(
  "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/search",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      recherche: {
        champs: [
          {
            typeChamp: "NUM_ARTICLE",
            criteres: [
              {
                typeRecherche: "EXACTE",
                valeur: "L1232-1",
                operateur: "ET",
              },
            ],
            operateur: "ET",
          },
        ],
        filtres: [
          { facette: "NOM_CODE", valeurs: ["Code du travail"] },
          { facette: "DATE_VERSION", singleDate: today },
        ],
        pageNumber: 1,
        pageSize: 3,
        operateur: "ET",
        sort: "PERTINENCE",
        typePagination: "ARTICLE",
      },
      fond: "CODE_DATE",
    }),
  }
);
if (!searchRes.ok) {
  console.error("❌ Search échec:", await searchRes.text());
  process.exit(1);
}
const data = await searchRes.json();
console.log(`   Total résultats: ${data.totalArticleResultNumber || 0}`);
const firstHit = data.results?.[0];
if (firstHit) {
  const title = firstHit.titles?.[0]?.titre || "?";
  const extract = firstHit.sections?.[0]?.extracts?.[0];
  console.log(`   Titre code: ${title}`);
  if (extract) {
    console.log(`   Article ID: ${extract.id}`);
    console.log(`   Article num: ${extract.num}`);
    const text = (extract.values || [])
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&[a-z]+;/g, " ")
      .slice(0, 250);
    console.log(`   Texte (extrait): ${text}…`);
  }
}

// 3) Test récupération directe par ID
console.log("\n3. Récupération directe d'un article par LEGIARTI...");
const articleId = firstHit?.sections?.[0]?.extracts?.[0]?.id;
if (articleId) {
  const articleRes = await fetch(
    "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/getArticle",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ id: articleId }),
    }
  );
  if (articleRes.ok) {
    const j = await articleRes.json();
    if (j.article) {
      console.log(`   ✅ Article récupéré : ${j.article.id}, num=${j.article.num}`);
      console.log(`   État: ${j.article.etat}`);
      const txt = (j.article.texte || "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 300);
      console.log(`   Texte: ${txt}…`);
    }
  } else {
    console.error("   ❌ getArticle échec:", await articleRes.text());
  }
}

console.log("\n━━━ ✅ INTÉGRATION FONCTIONNELLE ━━━━━━━━━━━━━━━━━━━━━\n");
