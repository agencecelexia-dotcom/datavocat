/**
 * Judilibre API Client — Cour de cassation
 *
 * Uses the PISTE portal (https://piste.gouv.fr) for authentication.
 * Endpoint: https://api.piste.gouv.fr/cassation/judilibre/v1.0
 *
 * Env vars needed:
 *   PISTE_CLIENT_ID — OAuth2 client ID from PISTE
 *   PISTE_CLIENT_SECRET — OAuth2 client secret from PISTE
 *   PISTE_KEY_ID — API key from PISTE portal (optional but recommended)
 *   PISTE_SANDBOX — set to "true" for sandbox mode
 */

const isSandbox = process.env.PISTE_SANDBOX === "true";

const PISTE_TOKEN_URL = isSandbox
  ? "https://sandbox-oauth.aife.economie.gouv.fr/api/oauth/token"
  : "https://oauth.aife.economie.gouv.fr/api/oauth/token";

const JUDILIBRE_BASE = isSandbox
  ? "https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0"
  : "https://api.piste.gouv.fr/cassation/judilibre/v1.0";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PISTE_CLIENT_ID;
  const clientSecret = process.env.PISTE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PISTE_CLIENT_ID and PISTE_CLIENT_SECRET are required");
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(PISTE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid",
    }),
  });

  if (!res.ok) {
    throw new Error(`PISTE auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

function getHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  const keyId = process.env.PISTE_KEY_ID;
  if (keyId) {
    headers["KeyId"] = keyId;
  }
  return headers;
}

export interface JudilibreDecision {
  id: string;
  score?: number;
  highlights?: Record<string, string[]>;
  jurisdiction: string;
  chamber: string;
  number: string[];
  ecli: string;
  formation: string;
  publication: string[];
  solution: string;
  solution_alt?: string;
  date: string;
  type: string;
  text?: string;
  themes?: string[];
  sommaire?: string;
  titrage?: string[];
  visa?: string[];
  rapprochements?: string[];
  files?: { id: string; type: string; url: string }[];
}

export interface JudilibreSearchResult {
  results: JudilibreDecision[];
  total: number;
  next_page?: string;
  query: string;
}

export interface JudilibreSearchParams {
  query: string;
  /** Searchable zones: expose, moyens, motivations, dispositif, annexes, sommaire, titrage */
  field?: string[];
  /** Operator: "or" (default), "and", "exact" */
  operator?: "or" | "and" | "exact";
  /** Decision type: arret, qpc, ordonnance, saisie */
  type?: string;
  /** Filter by chamber(s): soc, civ1, civ2, civ3, com, crim, mi, pl, crepa */
  chamber?: string[];
  /** Filter by formation */
  formation?: string[];
  /** Filter by jurisdiction: cc (Cass.), ca (CA) */
  jurisdiction?: string[];
  /** Filter by location (CA city) */
  location?: string[];
  /** Filter by publication level */
  publication?: string[];
  /** Filter by solution: cassation, rejet, etc. */
  solution?: string[];
  /** Filter by theme */
  theme?: string[];
  /** Start date YYYY-MM-DD */
  dateStart?: string;
  /** End date YYYY-MM-DD */
  dateEnd?: string;
  /** Sort: "score" or "date" */
  sort?: "score" | "date";
  /** Order: "asc" or "desc" */
  order?: "asc" | "desc";
  /** Max results per page (default 10) */
  pageSize?: number;
  /** Cursor for pagination (next_page from previous response) */
  batch?: string;
}

/**
 * Search decisions in Judilibre (Cour de cassation + Cours d'appel)
 */
export async function searchJudilibre(
  params: JudilibreSearchParams
): Promise<JudilibreSearchResult> {
  const token = await getAccessToken();

  const searchParams = new URLSearchParams();
  searchParams.set("query", params.query);

  if (params.operator) searchParams.set("operator", params.operator);
  if (params.type) searchParams.set("type", params.type);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.order) searchParams.set("order", params.order);
  if (params.dateStart) searchParams.set("date_start", params.dateStart);
  if (params.dateEnd) searchParams.set("date_end", params.dateEnd);
  if (params.pageSize) searchParams.set("page_size", String(params.pageSize));
  if (params.batch) searchParams.set("batch", params.batch);

  // Array params use bracket notation
  for (const f of params.field || []) searchParams.append("field[]", f);
  for (const c of params.chamber || []) searchParams.append("chamber[]", c);
  for (const f of params.formation || []) searchParams.append("formation[]", f);
  for (const j of params.jurisdiction || []) searchParams.append("jurisdiction[]", j);
  for (const l of params.location || []) searchParams.append("location[]", l);
  for (const p of params.publication || []) searchParams.append("publication[]", p);
  for (const s of params.solution || []) searchParams.append("solution[]", s);
  for (const t of params.theme || []) searchParams.append("theme[]", t);

  const url = `${JUDILIBRE_BASE}/search?${searchParams.toString()}`;

  const res = await fetch(url, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Judilibre search failed: ${res.status} — ${body}`);
  }

  const data = await res.json();

  return {
    results: data.results || [],
    total: data.total || 0,
    next_page: data.next_page,
    query: params.query,
  };
}

/**
 * Get a single decision by ID (includes full text)
 */
export async function getDecision(id: string): Promise<JudilibreDecision> {
  const token = await getAccessToken();

  const res = await fetch(`${JUDILIBRE_BASE}/decision?id=${id}`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Judilibre decision fetch failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Get taxonomy values for a given filter
 */
export async function getTaxonomy(
  id: "chamber" | "solution" | "type" | "field" | "publication" | "formation" | "jurisdiction" | "location" | "theme"
): Promise<{ id: string; label: string }[]> {
  const token = await getAccessToken();

  const res = await fetch(`${JUDILIBRE_BASE}/taxonomy?id=${id}`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Judilibre taxonomy fetch failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Search and format results for injection into Claude analysis context.
 * This is the main function called by /api/analyze.
 */
export async function searchJudilibreForAnalysis(
  userQuery: string
): Promise<string> {
  const clientId = process.env.PISTE_CLIENT_ID;
  if (!clientId) {
    return "API Judilibre non configuree (PISTE_CLIENT_ID manquant). Pour activer : inscription gratuite sur https://piste.gouv.fr puis ajouter PISTE_CLIENT_ID et PISTE_CLIENT_SECRET.";
  }

  try {
    // Search with AND operator for more relevant results
    const result = await searchJudilibre({
      query: userQuery.slice(0, 300),
      operator: "and",
      sort: "score",
      order: "desc",
      pageSize: 20,
    });

    if (result.results.length === 0) {
      // Retry with OR operator (broader)
      const retryResult = await searchJudilibre({
        query: userQuery.slice(0, 300),
        operator: "or",
        sort: "score",
        order: "desc",
        pageSize: 15,
      });

      if (retryResult.results.length === 0) {
        return `Judilibre : aucune decision trouvee pour cette recherche.`;
      }

      return formatJudilibreResults(retryResult);
    }

    return formatJudilibreResults(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return `Erreur Judilibre : ${msg}`;
  }
}

function formatJudilibreResults(result: JudilibreSearchResult): string {
  let context = `═══ JUDILIBRE (Cour de cassation + Cours d'appel) ═══\n`;
  context += `${result.total} decisions trouvees au total, ${result.results.length} les plus pertinentes analysees :\n\n`;

  for (const dec of result.results) {
    const pourvois = Array.isArray(dec.number)
      ? dec.number.join(", ")
      : dec.number || "N/A";
    const jurisdiction =
      dec.jurisdiction === "cc" ? "Cour de cassation" : `CA (${dec.jurisdiction})`;
    const chamberNames: Record<string, string> = {
      soc: "Chambre sociale",
      civ1: "1ere chambre civile",
      civ2: "2eme chambre civile",
      civ3: "3eme chambre civile",
      com: "Chambre commerciale",
      crim: "Chambre criminelle",
      mi: "Chambre mixte",
      pl: "Assemblee pleniere",
    };
    const chamber = chamberNames[dec.chamber] || dec.chamber;

    context += `--- ${jurisdiction}, ${chamber} — ${dec.date} ---\n`;
    context += `Pourvoi(s): ${pourvois}\n`;
    context += `ECLI: ${dec.ecli}\n`;
    context += `Solution: ${dec.solution_alt || dec.solution}\n`;

    if (dec.themes && dec.themes.length > 0) {
      context += `Themes: ${dec.themes.slice(0, 5).join(", ")}\n`;
    }
    if (dec.sommaire) {
      context += `Sommaire: ${dec.sommaire.slice(0, 400)}\n`;
    }
    if (dec.titrage && dec.titrage.length > 0) {
      context += `Titrage: ${dec.titrage.join(" > ")}\n`;
    }

    // Highlights (search excerpts) are very useful for relevance
    if (dec.highlights) {
      const excerpts = Object.values(dec.highlights)
        .flat()
        .slice(0, 2)
        .map((h) => h.replace(/<\/?em>/g, ""))
        .join(" [...] ");
      if (excerpts) {
        context += `Extraits pertinents: ${excerpts.slice(0, 600)}\n`;
      }
    }

    // Full text excerpt as fallback
    if (!dec.highlights && dec.text) {
      context += `Extrait: ${dec.text.slice(0, 400)}...\n`;
    }

    context += "\n";
  }

  return context;
}
