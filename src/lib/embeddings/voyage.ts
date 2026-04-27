/**
 * Client Voyage AI — embeddings sémantiques (Niveau 4 jurimétrie).
 *
 * Voyage est l'alternative recommandée par Anthropic (qui ne fournit pas
 * d'embeddings). Le modèle `voyage-law-2` est entraîné spécifiquement sur
 * du contenu juridique (1024 dimensions, ~16k tokens par texte).
 *
 * Utilisé pour le rerank sémantique des candidates Judilibre/CETAT au
 * query time : on embedde la requête + chaque sommaire, on calcule la
 * similarité cosinus, on combine avec le score Haiku.
 *
 * Dégradation gracieuse : si VOYAGE_API_KEY est absent, les fonctions
 * retournent null et le pipeline retombe sur le rerank Haiku seul.
 */

const VOYAGE_API = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-law-2"; // spécialisé juridique
// Voyage limite à ~128 inputs/batch et ~120k tokens/batch.
const BATCH_SIZE = 96;
const TIMEOUT_MS = 25000;

export function isVoyageAvailable(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens: number };
}

async function callVoyage(
  inputs: string[],
  inputType: "document" | "query",
): Promise<number[][] | null> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return null;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(VOYAGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        input: inputs,
        model: VOYAGE_MODEL,
        input_type: inputType,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as VoyageResponse;
    if (!Array.isArray(json.data)) return null;
    // Réordonne par index pour garantir l'alignement avec inputs.
    const out = new Array<number[]>(inputs.length);
    for (const item of json.data) {
      if (Array.isArray(item.embedding) && typeof item.index === "number") {
        out[item.index] = item.embedding;
      }
    }
    return out;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Embedde une liste de documents (sommaires de décisions).
 * Découpe en batches de BATCH_SIZE pour respecter les limites Voyage.
 * Retourne null si le service est indisponible ou échoue.
 */
export async function embedDocuments(
  texts: string[],
): Promise<number[][] | null> {
  if (!isVoyageAvailable() || texts.length === 0) return null;

  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const vectors = await callVoyage(batch, "document");
    if (!vectors) return null; // un échec partiel = rerank invalide
    all.push(...vectors);
  }
  return all;
}

/**
 * Embedde une requête utilisateur (input_type=query — voyage applique
 * un encodage légèrement différent côté serveur).
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!isVoyageAvailable() || !text.trim()) return null;
  const result = await callVoyage([text], "query");
  return result?.[0] ?? null;
}

/**
 * Cosinus entre deux vecteurs de même dimension.
 * Voyage retourne déjà des embeddings normalisés (norme 1), donc le
 * dot product est équivalent au cosinus, mais on normalise par sécurité.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
