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
 * Extract legal keywords from a natural language query.
 * Splits the user's verbose question into focused search terms.
 */
function extractSearchQueries(userQuery: string): string[] {
  // Common French legal stop words to remove
  const stopWords = new Set([
    "mon", "ma", "mes", "le", "la", "les", "un", "une", "des", "de", "du",
    "au", "aux", "en", "dans", "par", "pour", "sur", "avec", "sans", "son",
    "sa", "ses", "ce", "cette", "ces", "qui", "que", "quoi", "dont", "ou",
    "est", "sont", "a", "ont", "fait", "faire", "peut", "doit", "depuis",
    "il", "elle", "nous", "vous", "ils", "elles", "se", "ne", "pas",
    "client", "locataire", "proprietaire", "bailleur", "employeur", "salarie",
    "demandeur", "defendeur", "avocat", "quelles", "quelle", "quel", "quels",
    "comment", "combien", "pourquoi", "voit", "voir", "esperer", "obtenir",
  ]);

  // Legal domain keywords to detect (maps to focused search terms)
  const legalDomains: Record<string, string[]> = {
    "bail commercial": ["bail commercial", "renouvellement bail", "indemnite eviction", "L145-14 code commerce"],
    "licenciement": ["licenciement", "indemnite licenciement", "cause reelle serieuse"],
    "divorce": ["divorce", "prestation compensatoire", "partage communaute"],
    "accident travail": ["accident travail", "faute inexcusable", "rente incapacite"],
    "construction": ["malfacon", "responsabilite constructeur", "garantie decennale"],
    "propriete intellectuelle": ["contrefacon", "marque", "brevet", "droit auteur"],
    "concurrence": ["concurrence deloyale", "clause non-concurrence"],
    "responsabilite civile": ["responsabilite civile", "prejudice", "indemnisation"],
    "droit social": ["contrat travail", "convention collective", "accord collectif"],
    "immobilier": ["vente immobiliere", "vice cache", "servitude"],
    "succession": ["succession", "testament", "reserve hereditaire", "quotite disponible"],
    "copropriete": ["copropriete", "charges copropriete", "assemblee generale"],
  };

  const queryLower = userQuery.toLowerCase();
  const queries: string[] = [];

  // 1. Detect legal domain and add domain-specific queries
  for (const [domain, terms] of Object.entries(legalDomains)) {
    const domainWords = domain.split(" ");
    if (domainWords.every((w) => queryLower.includes(w))) {
      queries.push(...terms);
      break;
    }
  }

  // 2. Extract meaningful legal terms from the query
  const words = queryLower
    .replace(/['']/g, " ")
    .replace(/[^a-zàâäéèêëïîôùûüÿç\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Build 2-word and 3-word ngrams (legal terms are often multi-word)
  const ngrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    ngrams.push(`${words[i]} ${words[i + 1]}`);
    if (i < words.length - 2) {
      ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  // Add individual meaningful words
  const legalTerms = words.filter(
    (w) => w.length > 4 || ["bail", "dol", "abus", "vice", "faute"].includes(w)
  );

  // Combine: domain queries + best ngrams + individual terms
  if (ngrams.length > 0) {
    queries.push(ngrams[0]); // First bigram is usually the most relevant
    if (ngrams.length > 2) queries.push(ngrams[Math.floor(ngrams.length / 2)]);
  }
  if (legalTerms.length > 0) {
    queries.push(legalTerms.slice(0, 4).join(" "));
  }

  // 3. Fallback: simplified version of original query
  if (queries.length === 0) {
    queries.push(legalTerms.join(" ") || userQuery.slice(0, 100));
  }

  // Deduplicate
  return [...new Set(queries)].slice(0, 5);
}

/**
 * Detect which Judilibre chamber is most relevant for the query.
 */
function detectChamber(query: string): string[] | undefined {
  const q = query.toLowerCase();
  if (q.includes("travail") || q.includes("licenciement") || q.includes("salari") || q.includes("employeur") || q.includes("accord collectif")) return ["soc"];
  if (q.includes("bail commercial") || q.includes("commerce") || q.includes("societe") || q.includes("banque") || q.includes("fonds de commerce")) return ["com", "civ3"];
  if (q.includes("divorce") || q.includes("succession") || q.includes("famille") || q.includes("mariage")) return ["civ1"];
  if (q.includes("accident") || q.includes("assurance") || q.includes("prejudice corporel")) return ["civ2"];
  if (q.includes("construction") || q.includes("immobilier") || q.includes("copropriete") || q.includes("bail")) return ["civ3"];
  if (q.includes("penal") || q.includes("infraction") || q.includes("delit")) return ["crim"];
  return undefined; // No filter = search all chambers
}

/**
 * Search and format results for injection into Claude analysis context.
 * Uses multi-strategy search: extracts keywords, runs parallel searches,
 * deduplicates, and always returns maximum relevant results.
 */
export async function searchJudilibreForAnalysis(
  userQuery: string
): Promise<string> {
  const clientId = process.env.PISTE_CLIENT_ID;
  if (!clientId) {
    return "API Judilibre non configuree (PISTE_CLIENT_ID manquant). Pour activer : inscription gratuite sur https://piste.gouv.fr puis ajouter PISTE_CLIENT_ID et PISTE_CLIENT_SECRET.";
  }

  try {
    const searchQueries = extractSearchQueries(userQuery);
    const chamber = detectChamber(userQuery);

    // Run all search strategies in parallel
    const searchPromises = searchQueries.map((q) =>
      searchJudilibre({
        query: q,
        operator: "or",
        sort: "score",
        order: "desc",
        pageSize: 10,
        chamber,
      }).catch(() => ({ results: [], total: 0, query: q } as JudilibreSearchResult))
    );

    // Also run a broad search with OR on the full query (truncated)
    searchPromises.push(
      searchJudilibre({
        query: userQuery.slice(0, 200),
        operator: "or",
        sort: "score",
        order: "desc",
        pageSize: 10,
      }).catch(() => ({ results: [], total: 0, query: userQuery } as JudilibreSearchResult))
    );

    const allResults = await Promise.all(searchPromises);

    // Deduplicate by ECLI
    const seenEcli = new Set<string>();
    const uniqueDecisions: JudilibreDecision[] = [];
    let totalAcrossSearches = 0;

    for (const result of allResults) {
      totalAcrossSearches = Math.max(totalAcrossSearches, result.total);
      for (const dec of result.results) {
        const key = dec.ecli || dec.id;
        if (!seenEcli.has(key)) {
          seenEcli.add(key);
          uniqueDecisions.push(dec);
        }
      }
    }

    if (uniqueDecisions.length === 0) {
      // Last resort: single-word searches on the most important terms
      const lastResortTerms = extractSearchQueries(userQuery)
        .flatMap((q) => q.split(" "))
        .filter((w) => w.length > 4)
        .slice(0, 3);

      for (const term of lastResortTerms) {
        try {
          const r = await searchJudilibre({
            query: term,
            operator: "or",
            sort: "score",
            order: "desc",
            pageSize: 5,
            chamber,
          });
          for (const dec of r.results) {
            const key = dec.ecli || dec.id;
            if (!seenEcli.has(key)) {
              seenEcli.add(key);
              uniqueDecisions.push(dec);
            }
          }
          totalAcrossSearches = Math.max(totalAcrossSearches, r.total);
        } catch {
          // continue
        }
      }
    }

    if (uniqueDecisions.length === 0) {
      return `Judilibre : aucune decision trouvee. Recherches tentees : ${searchQueries.join(" | ")}`;
    }

    // Take the top 20 unique decisions
    const topDecisions = uniqueDecisions.slice(0, 20);

    return formatJudilibreResults({
      results: topDecisions,
      total: totalAcrossSearches,
      query: searchQueries.join(" + "),
    });
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
