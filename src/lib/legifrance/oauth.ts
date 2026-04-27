/**
 * Singleton OAuth 2.0 PISTE pour l'API Légifrance.
 *
 * PISTE délivre des tokens valides 1h (expires_in: 3600). On garde le token
 * en mémoire et on le renouvelle automatiquement 60s avant expiration.
 *
 * Variables d'env requises :
 *   PISTE_CLIENT_ID      — UUID du client OAuth (obtenu sur piste.gouv.fr)
 *   PISTE_CLIENT_SECRET  — secret associé
 *
 * Si l'une des deux manque : getPisteToken() throw, ce qui permet aux
 * appelants de fallback proprement (Légifrance optionnel).
 */

const OAUTH_PROD_URL = "https://oauth.piste.gouv.fr/api/oauth/token";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cache: CachedToken | null = null;
let inflight: Promise<string> | null = null;

async function fetchNewToken(): Promise<string> {
  const clientId = process.env.PISTE_CLIENT_ID;
  const clientSecret = process.env.PISTE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PISTE_CLIENT_ID / PISTE_CLIENT_SECRET manquants");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "openid",
  });

  const res = await fetch(OAUTH_PROD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PISTE OAuth ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cache.accessToken;
}

/**
 * Retourne un token PISTE valide. Rafraîchit automatiquement.
 * Thread-safe : si plusieurs callers demandent en parallèle pendant un refresh,
 * un seul fetch part (mutualisation via `inflight`).
 */
export async function getPisteToken(): Promise<string> {
  // Token encore valide (avec marge 60s)
  if (cache && Date.now() < cache.expiresAt - 60_000) {
    return cache.accessToken;
  }
  // Une requête est déjà en cours, on l'attend
  if (inflight) return inflight;
  inflight = fetchNewToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Indique si Légifrance est utilisable (credentials configurées).
 * Utile pour fallback gracieux dans la pipeline.
 */
export function isLegifranceAvailable(): boolean {
  return !!process.env.PISTE_CLIENT_ID && !!process.env.PISTE_CLIENT_SECRET;
}
