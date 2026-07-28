#!/usr/bin/env node
/**
 * Test de l'intégration Justicelibre (serveur MCP public, sans auth).
 *
 * Vérifie la poignée de main MCP, la découverte des outils, puis interroge
 * les trois sources que Datavocat consomme réellement : CEDH, CJUE, CNIL.
 *
 * Usage :  node scripts/test-justicelibre.mjs
 */

const URL_MCP = process.env.JUSTICELIBRE_URL || "https://justicelibre.org/mcp";
const PROTOCOL_VERSION = "2025-06-18";

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": PROTOCOL_VERSION,
};

function parseRpcBody(body) {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const dataLines = trimmed
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(dataLines[i]);
      if (parsed.result || parsed.error) return parsed;
    } catch {
      /* heartbeat */
    }
  }
  return null;
}

let sessionId = null;
let rpcId = 100;

async function rpc(method, params, timeoutMs = 15000) {
  const headers = { ...HEADERS };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const res = await fetch(URL_MCP, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

console.log("\n━━━ TEST JUSTICELIBRE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`Endpoint : ${URL_MCP}\n`);

// 1) Poignée de main
console.log("1. initialize...");
let res;
try {
  res = await fetch(URL_MCP, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "datavocat-test", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
} catch (err) {
  console.error(`   ❌ Connexion impossible : ${err.message}`);
  console.error("   → Vérifie ta connexion réseau ou un éventuel proxy.");
  process.exit(1);
}

if (!res.ok) {
  console.error(`   ❌ HTTP ${res.status}`);
  console.error(`   ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

sessionId = res.headers.get("mcp-session-id");
await res.text();
console.log(
  `   ✅ OK — session : ${sessionId ? sessionId.slice(0, 16) + "…" : "mode stateless"}`
);

if (sessionId) {
  await fetch(URL_MCP, {
    method: "POST",
    headers: { ...HEADERS, "Mcp-Session-Id": sessionId },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {});
}

// 2) Découverte des outils
console.log("\n2. tools/list...");
const listRes = await rpc("tools/list", {});
const listBody = parseRpcBody(await listRes.text());
const tools = listBody?.result?.tools ?? [];
console.log(`   ✅ ${tools.length} outils exposés`);
const attendus = ["search_cedh", "search_cjue", "search_cnil", "search_admin"];
for (const t of attendus) {
  const present = tools.some((x) => x.name === t);
  console.log(`   ${present ? "✅" : "❌"} ${t}`);
}

// 3) Appels réels sur les sources consommées par Datavocat
const cas = [
  { tool: "search_cedh", args: { query: "procès équitable", limit: 3 } },
  { tool: "search_cjue", args: { query: "données personnelles", limit: 3 } },
  { tool: "search_cnil", args: { query: "sanction manquement sécurité", limit: 3 } },
  { tool: "search_admin", args: { query: "permis de construire", limit: 3 } },
];

console.log("\n3. Appels réels...");
let echecs = 0;
for (const { tool, args } of cas) {
  try {
    const r = await rpc("tools/call", { name: tool, arguments: args });
    if (!r.ok) {
      console.log(`   ❌ ${tool} → HTTP ${r.status}`);
      echecs++;
      continue;
    }
    const body = parseRpcBody(await r.text());
    if (body?.error) {
      console.log(`   ❌ ${tool} → ${body.error.message}`);
      echecs++;
      continue;
    }
    const text = (body?.result?.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("");
    let payload = body?.result?.structuredContent;
    if (!payload && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    const rows =
      payload?.decisions ?? payload?.results ?? payload?.deliberations ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`   ⚠️  ${tool} → 0 résultat (schéma inattendu ?)`);
      if (text) console.log(`      brut : ${text.slice(0, 200)}`);
      echecs++;
      continue;
    }
    const ex = rows[0];
    console.log(`   ✅ ${tool} → ${rows.length} résultats`);
    console.log(
      `      ex : id=${ex.id ?? "?"} date=${ex.date ?? "?"} « ${String(
        ex.title ?? ex.titre ?? ex.extract ?? ""
      ).slice(0, 70)}… »`
    );
  } catch (err) {
    console.log(`   ❌ ${tool} → ${err.message}`);
    echecs++;
  }
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (echecs === 0) {
  console.log("✅ Justicelibre opérationnel — l'intégration peut être activée.");
  process.exit(0);
}
console.log(
  `⚠️  ${echecs}/${cas.length} sources en échec.\n` +
    "   L'analyse Datavocat continuera de fonctionner (dégradation\n" +
    "   silencieuse vers Judilibre seul), mais l'apport Justicelibre\n" +
    "   sera nul. Pour désactiver proprement : JUSTICELIBRE_ENABLED=false"
);
process.exit(1);
