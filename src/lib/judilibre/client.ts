/**
 * Judilibre API Client — Cour de cassation
 *
 * Uses the PISTE portal (https://piste.gouv.fr) for authentication.
 * Endpoint: https://api.piste.gouv.fr/cassation/judilibre/v1.0
 *
 * Env vars needed:
 *   PISTE_CLIENT_ID — OAuth2 client ID from PISTE
 *   PISTE_CLIENT_SECRET — OAuth2 client secret from PISTE
 */

const PISTE_TOKEN_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const JUDILIBRE_BASE =
  process.env.JUDILIBRE_SANDBOX === "true"
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
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface JudilibreDecision {
  id: string;
  jurisdiction: string;
  chamber: string;
  number: string;
  ecli: string;
  formation: string;
  publication: string[];
  solution: string;
  decision_date: string;
  text: string;
  summary?: string;
  themes?: string[];
  files?: { id: string; type: string; url: string }[];
}

export interface JudilibreSearchResult {
  results: JudilibreDecision[];
  total: number;
  next_batch?: string;
  query: string;
}

export interface JudilibreSearchParams {
  query: string;
  /** Filter by matter: "civil", "social", "commercial", "criminelle" */
  matiere?: string;
  /** Filter by chamber */
  chambre?: string;
  /** Filter by solution: "cassation", "rejet", "non-lieu", etc. */
  solution?: string;
  /** Start date YYYY-MM-DD */
  dateStart?: string;
  /** End date YYYY-MM-DD */
  dateEnd?: string;
  /** Max results (default 10, max 50) */
  pageSize?: number;
  /** Batch key for pagination */
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
  if (params.matiere) searchParams.set("matiere", params.matiere);
  if (params.chambre) searchParams.set("chamber", params.chambre);
  if (params.solution) searchParams.set("solution", params.solution);
  if (params.dateStart) searchParams.set("date_start", params.dateStart);
  if (params.dateEnd) searchParams.set("date_end", params.dateEnd);
  if (params.pageSize) searchParams.set("page_size", String(params.pageSize));
  if (params.batch) searchParams.set("batch", params.batch);

  const url = `${JUDILIBRE_BASE}/search?${searchParams.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Judilibre search failed: ${res.status} — ${body}`);
  }

  const data = await res.json();

  return {
    results: data.results || [],
    total: data.total || 0,
    next_batch: data.next_batch,
    query: params.query,
  };
}

/**
 * Get a single decision by ID
 */
export async function getDecision(id: string): Promise<JudilibreDecision> {
  const token = await getAccessToken();

  const res = await fetch(`${JUDILIBRE_BASE}/decision?id=${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Judilibre decision fetch failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Search and format results for injection into Claude analysis context
 */
export async function searchJudilibreForAnalysis(
  userQuery: string
): Promise<string> {
  const clientId = process.env.PISTE_CLIENT_ID;
  if (!clientId) {
    return "API Judilibre non configuree (PISTE_CLIENT_ID manquant).";
  }

  try {
    // Extract key terms and search
    const result = await searchJudilibre({
      query: userQuery.slice(0, 300),
      pageSize: 20,
    });

    if (result.results.length === 0) {
      return `Judilibre : aucune decision trouvee pour "${userQuery.slice(0, 100)}..."`;
    }

    let context = `═══ JUDILIBRE (Cour de cassation) ═══\n`;
    context += `${result.total} decisions trouvees, ${result.results.length} analysees :\n\n`;

    for (const dec of result.results) {
      context += `--- ${dec.jurisdiction} ${dec.chamber} — ${dec.decision_date} ---\n`;
      context += `ECLI: ${dec.ecli}\n`;
      context += `Solution: ${dec.solution}\n`;
      if (dec.themes && dec.themes.length > 0) {
        context += `Themes: ${dec.themes.join(", ")}\n`;
      }
      if (dec.summary) {
        context += `Resume: ${dec.summary}\n`;
      }
      // Include relevant text excerpt (first 500 chars)
      if (dec.text) {
        context += `Extrait: ${dec.text.slice(0, 500)}...\n`;
      }
      context += "\n";
    }

    return context;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return `Erreur Judilibre : ${msg}`;
  }
}
