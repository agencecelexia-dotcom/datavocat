/**
 * Client MCP Justicelibre — https://justicelibre.org/mcp
 *
 * Justicelibre est un serveur MCP public (MIT + Licence Ouverte Etalab) qui
 * expose ~3,3 M de décisions et 1,5 M d'articles de loi, SANS authentification :
 *
 *   - CEDH   (~76 k)   — Cour européenne des droits de l'homme
 *   - CJUE   (~44 k)   — Cour de justice de l'UE
 *   - CNIL   (~8 k)    — délibérations et sanctions RGPD
 *   - Admin  (~550 k)  — CE + 9 CAA + 40 TA (complète/supplée Légifrance CETAT)
 *   - DILA   (~1,17 M) — Cass. + CA + Conseil constitutionnel
 *
 * Rôle dans Datavocat : SOURCE COMPLÉMENTAIRE. Judilibre reste prioritaire
 * (données PISTE officielles). Justicelibre couvre les angles morts —
 * européen, données personnelles, administratif — et sert de filet quand
 * les credentials PISTE manquent.
 *
 * Le serveur étant communautaire, TOUTES les fonctions de ce module sont
 * non-bloquantes : en cas d'erreur réseau, de schéma inattendu ou de
 * timeout, elles renvoient un tableau vide et la pipeline continue avec
 * le corpus Judilibre seul.
 *
 * Env :
 *   JUSTICELIBRE_ENABLED=false  — désactive complètement la source
 *   JUSTICELIBRE_URL=...        — override de l'endpoint (self-hosting)
 */

import type { JudilibreDecision } from "@/lib/judilibre/client";

const DEFAULT_URL = "https://justicelibre.org/mcp";
const PROTOCOL_VERSION = "2025-06-18";
const CALL_TIMEOUT_MS = 12_000;
const INIT_TIMEOUT_MS = 8_000;

function endpoint(): string {
  return process.env.JUSTICELIBRE_URL || DEFAULT_URL;
}

export function isJusticeLibreEnabled(): boolean {
  return process.env.JUSTICELIBRE_ENABLED !== "false";
}

// ════════════════════════════════════════════
// TRANSPORT MCP (Streamable HTTP)
// ════════════════════════════════════════════

interface JsonRpcResponse {
  result?: {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
    structuredContent?: unknown;
  };
  error?: { code: number; message: string };
}

/**
 * Extrait le payload JSON-RPC d'une réponse qui peut être soit du JSON brut,
 * soit un flux SSE (`event: message\ndata: {...}`). FastMCP renvoie l'un ou
 * l'autre selon la négociation de contenu.
 */
function parseRpcBody(body: string): JsonRpcResponse | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as JsonRpcResponse;
    } catch {
      return null;
    }
  }

  // Flux SSE : on prend la dernière ligne `data:` qui contient un résultat.
  const dataLines = trimmed
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);

  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(dataLines[i]) as JsonRpcResponse;
      if (parsed.result || parsed.error) return parsed;
    } catch {
      // ligne de heartbeat ou payload partiel — on continue
    }
  }
  return null;
}

/** Session MCP mise en cache au niveau du module (durée de vie du worker). */
let sessionId: string | null = null;
let initInflight: Promise<string | null> | null = null;

const MCP_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  "MCP-Protocol-Version": PROTOCOL_VERSION,
};

/**
 * Poignée de main MCP. Renvoie l'identifiant de session, ou null si le
 * serveur fonctionne en mode stateless (pas d'en-tête Mcp-Session-Id).
 */
async function initializeSession(): Promise<string | null> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "datavocat", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(INIT_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`initialize ${res.status}`);
  }

  const sid = res.headers.get("mcp-session-id");
  // On draine le corps pour libérer la connexion.
  await res.text();

  if (sid) {
    // Le protocole exige la notification `initialized` avant tout appel.
    await fetch(endpoint(), {
      method: "POST",
      headers: { ...MCP_HEADERS, "Mcp-Session-Id": sid },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      signal: AbortSignal.timeout(INIT_TIMEOUT_MS),
    }).catch(() => {
      // Certaines implémentations n'exigent pas la notification — non bloquant.
    });
  }

  return sid;
}

async function ensureSession(): Promise<string | null> {
  if (sessionId) return sessionId;
  if (initInflight) return initInflight;
  initInflight = initializeSession()
    .then((sid) => {
      sessionId = sid;
      return sid;
    })
    .finally(() => {
      initInflight = null;
    });
  return initInflight;
}

let rpcId = 100;

/**
 * Appelle un outil MCP et renvoie son résultat désérialisé.
 *
 * Justicelibre encode ses résultats en JSON dans un bloc `content[].text`.
 * On tente d'abord `structuredContent` (MCP moderne) puis le parsing du texte.
 */
async function callTool<T>(
  name: string,
  args: Record<string, unknown>
): Promise<T | null> {
  const attempt = async (sid: string | null): Promise<Response> => {
    const headers = { ...MCP_HEADERS };
    if (sid) headers["Mcp-Session-Id"] = sid;
    return fetch(endpoint(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpcId++,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  };

  let sid = await ensureSession();
  let res = await attempt(sid);

  // Session expirée ou invalide → on rejoue une poignée de main une fois.
  if ((res.status === 400 || res.status === 404) && sid) {
    sessionId = null;
    sid = await ensureSession();
    res = await attempt(sid);
  }

  if (!res.ok) {
    throw new Error(`tools/call ${name} → ${res.status}`);
  }

  const parsed = parseRpcBody(await res.text());
  if (!parsed) throw new Error(`réponse illisible pour ${name}`);
  if (parsed.error) throw new Error(`${name}: ${parsed.error.message}`);
  if (parsed.result?.isError) throw new Error(`${name} a renvoyé une erreur`);

  if (parsed.result?.structuredContent) {
    return parsed.result.structuredContent as T;
  }

  const text = (parsed.result?.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text as string)
    .join("");

  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════
// SCHÉMAS DE RÉPONSE
// ════════════════════════════════════════════

/** Ligne renvoyée par les outils `search_*`. Champs tous optionnels : le
 *  serveur varie légèrement le nommage selon la source interrogée. */
interface JlHit {
  id?: string;
  source?: string;
  juridiction?: string;
  date?: string;
  title?: string;
  titre?: string;
  numero?: string;
  extract?: string;
  score?: number;
}

/** Enveloppe commune aux outils ciblés (`search_cedh`, `search_admin`…). */
interface JlSearchResponse {
  total?: number;
  returned?: number;
  decisions?: JlHit[];
  results?: JlHit[];
  deliberations?: JlHit[];
}

function extractHits(payload: JlSearchResponse | null): JlHit[] {
  if (!payload) return [];
  const rows =
    payload.decisions ?? payload.results ?? payload.deliberations ?? [];
  return Array.isArray(rows) ? rows : [];
}

// ════════════════════════════════════════════
// ADAPTATEUR → JudilibreDecision
// ════════════════════════════════════════════

/**
 * Déduit le code juridiction interne Datavocat ("ce" | "caa" | "ta" | "cc"…)
 * à partir des champs libres renvoyés par Justicelibre.
 */
function mapJurisdiction(hit: JlHit, fallback: string): string {
  const raw = `${hit.juridiction ?? ""} ${hit.source ?? ""} ${hit.id ?? ""}`.toLowerCase();

  if (/conseil\s+d['’]?\s*[ée]tat|\bce\b|cetattext|dce_/.test(raw)) return "ce";
  if (/cour\s+administrative|caa|dcaa_/.test(raw)) return "caa";
  if (/tribunal\s+administratif|\bta\d*\b|dta_/.test(raw)) return "ta";
  if (/cassation|juritext|\bcass\b/.test(raw)) return "cc";
  if (/cour\s+d['’]?\s*appel|\bca\b/.test(raw)) return "ca";
  if (/cedh|echr|hudoc/.test(raw)) return "cedh";
  if (/cjue|curia|celex|cjeu/.test(raw)) return "cjue";
  if (/cnil|delib/.test(raw)) return "cnil";
  if (/constit|constext/.test(raw)) return "constit";
  return fallback;
}

/**
 * Convertit un résultat Justicelibre au format JudilibreDecision, seul format
 * accepté par le rerank Haiku et les statistiques serveur.
 *
 * Renvoie null si la ligne n'a pas d'identifiant exploitable — on ne fabrique
 * jamais de référence, conformément à la règle « ne jamais inventer d'ECLI ».
 */
function toJudilibreDecision(
  hit: JlHit,
  fallbackJurisdiction: string,
  chamberLabel: string
): JudilibreDecision | null {
  const id = hit.id?.trim();
  if (!id) return null;

  const title = (hit.title ?? hit.titre ?? "").trim();
  const extract = (hit.extract ?? "").trim();
  const jurisdiction = mapJurisdiction(hit, fallbackJurisdiction);

  // Les ECLI sont conservés uniquement s'ils sont réellement présents.
  const ecli = /^ECLI:/i.test(id) ? id : undefined;

  return {
    id,
    jurisdiction,
    chamber: chamberLabel,
    number: hit.numero ? [hit.numero] : [id],
    ecli,
    // Justicelibre ne qualifie pas le sens de la décision : on laisse le
    // rerank et le prompt l'inférer du texte plutôt que d'inventer une valeur.
    solution: "",
    solution_alt: "",
    date: hit.date || undefined,
    sommaire: (extract || title).slice(0, 500),
    themes: [],
    score: typeof hit.score === "number" ? hit.score : undefined,
    highlights: extract ? { text: [extract.slice(0, 400)] } : undefined,
  };
}

// ════════════════════════════════════════════
// ROUTAGE PAR MATIÈRE
// ════════════════════════════════════════════

const RE_CEDH =
  /cedh|convention\s+europ[ée]enne|droits?\s+de\s+l['’]homme|proc[èe]s\s+[ée]quitable|article\s+[3568]\s+(?:de\s+la\s+)?conv|garde\s+[àa]\s+vue|d[ée]tention\s+arbitraire|libert[ée]s?\s+fondamentales?|strasbourg/i;

const RE_CJUE =
  /cjue|cour\s+de\s+justice|droit\s+(?:de\s+l['’])?(?:union|ue)|directive\s+\d|r[èe]glement\s+(?:ue|ce)\s*\d|question\s+pr[ée]judicielle|luxembourg|concurrence\s+(?:europ[ée]enne|communautaire)/i;

const RE_CNIL =
  /cnil|rgpd|donn[ée]es\s+(?:[àa]\s+caract[èe]re\s+)?personnelles?|vie\s+priv[ée]e\s+num[ée]rique|sous-?traitant\s+de\s+donn[ée]es|dpo|d[ée]lib[ée]ration\s+cnil|consentement\s+(?:au\s+)?traitement/i;

/** Sources Justicelibre à interroger pour une requête donnée. */
export interface JusticeLibrePlan {
  cedh: boolean;
  cjue: boolean;
  cnil: boolean;
  admin: boolean;
}

/**
 * Décide quelles sources Justicelibre interroger.
 *
 * On reste conservateur : chaque source ajoutée consomme du budget de contexte
 * et du temps de latence. On n'interroge une source que si la requête la
 * justifie explicitement.
 *
 * @param isAdmin résultat de `isAdminMatter()` côté Légifrance
 * @param adminAlreadyCovered true si Légifrance CETAT est disponible et a déjà
 *        traité l'administratif — dans ce cas Justicelibre ne sert que de filet
 */
export function planJusticeLibre(
  query: string,
  isAdmin: boolean,
  adminAlreadyCovered: boolean
): JusticeLibrePlan {
  return {
    cedh: RE_CEDH.test(query),
    cjue: RE_CJUE.test(query),
    cnil: RE_CNIL.test(query),
    admin: isAdmin && !adminAlreadyCovered,
  };
}

export function planIsEmpty(plan: JusticeLibrePlan): boolean {
  return !plan.cedh && !plan.cjue && !plan.cnil && !plan.admin;
}

// ════════════════════════════════════════════
// API PUBLIQUE
// ════════════════════════════════════════════

interface SourceSpec {
  tool: string;
  args: Record<string, unknown>;
  jurisdiction: string;
  chamber: string;
  label: string;
}

/**
 * Interroge Justicelibre selon le plan fourni et renvoie les décisions au
 * format Judilibre, dédoublonnées par identifiant.
 *
 * Ne throw jamais : toute défaillance dégrade silencieusement vers [].
 */
export async function searchJusticeLibre(
  query: string,
  plan: JusticeLibrePlan,
  opts?: { limitPerSource?: number }
): Promise<JudilibreDecision[]> {
  if (!isJusticeLibreEnabled() || planIsEmpty(plan)) return [];

  const limit = Math.min(opts?.limitPerSource ?? 20, 50);
  const q = query.slice(0, 200);

  const specs: SourceSpec[] = [];
  if (plan.cedh) {
    specs.push({
      tool: "search_cedh",
      args: { query: q, limit },
      jurisdiction: "cedh",
      chamber: "CEDH",
      label: "CEDH",
    });
  }
  if (plan.cjue) {
    specs.push({
      tool: "search_cjue",
      args: { query: q, limit },
      jurisdiction: "cjue",
      chamber: "CJUE",
      label: "CJUE",
    });
  }
  if (plan.cnil) {
    specs.push({
      tool: "search_cnil",
      args: { query: q, limit },
      jurisdiction: "cnil",
      chamber: "CNIL",
      label: "CNIL",
    });
  }
  if (plan.admin) {
    specs.push({
      tool: "search_admin",
      args: { query: q, limit, sort: "relevance" },
      jurisdiction: "ta",
      chamber: "Administrative",
      label: "administratives (Justicelibre)",
    });
  }

  const batches = await Promise.all(
    specs.map(async (spec) => {
      try {
        const payload = await callTool<JlSearchResponse>(spec.tool, spec.args);
        const hits = extractHits(payload);
        const decisions = hits
          .map((h) => toJudilibreDecision(h, spec.jurisdiction, spec.chamber))
          .filter((d): d is JudilibreDecision => d !== null);
        if (process.env.NODE_ENV !== "production") {
          console.info(
            `[Justicelibre] ${spec.label} : ${decisions.length} décisions`
          );
        }
        return decisions;
      } catch (err) {
        // Source communautaire : on log sans casser l'analyse.
        console.warn(
          `[Justicelibre] ${spec.label} indisponible :`,
          err instanceof Error ? err.message : String(err)
        );
        return [];
      }
    })
  );

  const seen = new Set<string>();
  const merged: JudilibreDecision[] = [];
  for (const batch of batches) {
    for (const dec of batch) {
      if (seen.has(dec.id)) continue;
      seen.add(dec.id);
      merged.push(dec);
    }
  }
  return merged;
}

/**
 * Diagnostic de connectivité — utilisé par `scripts/test-justicelibre.mjs`
 * et par l'écran admin. Ne throw jamais.
 */
export async function pingJusticeLibre(): Promise<{
  ok: boolean;
  detail: string;
  sample?: number;
}> {
  if (!isJusticeLibreEnabled()) {
    return { ok: false, detail: "désactivé (JUSTICELIBRE_ENABLED=false)" };
  }
  try {
    const payload = await callTool<JlSearchResponse>("search_cedh", {
      query: "procès équitable",
      limit: 3,
    });
    const hits = extractHits(payload);
    return {
      ok: hits.length > 0,
      detail: hits.length > 0 ? "opérationnel" : "réponse vide",
      sample: hits.length,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
