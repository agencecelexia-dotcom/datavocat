/**
 * Client TypeScript pour l'API Légifrance via PISTE.
 *
 * Utilise le singleton OAuth (oauth.ts). Toutes les méthodes sont typées
 * et fail-silent : en cas d'erreur API, retournent null plutôt que de
 * casser la pipeline d'analyse.
 *
 * Endpoints couverts :
 *   - /search          : recherche dans tous les fonds
 *   - /consult/getArticle : article par ID LEGIARTI
 *   - /consult/code    : table des matières d'un code
 *   - /consult/kaliArticle : article de convention collective
 */

import { getPisteToken, isLegifranceAvailable } from "./oauth";

const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";

/** Fonds Légifrance disponibles (paramètre `fond` du POST /search). */
export type LegifranceFond =
  | "JORF"
  | "CNIL"
  | "CETAT"
  | "JURI"
  | "JUFI"
  | "CONSTIT"
  | "KALI"
  | "CODE_DATE"
  | "CODE_ETAT"
  | "LODA_DATE"
  | "LODA_ETAT"
  | "ALL"
  | "CIRC"
  | "ACCO";

export interface SearchArticleParams {
  /** Texte à rechercher */
  query: string;
  /** Fond ciblé (par défaut CODE_DATE = codes en vigueur à la date donnée) */
  fond?: LegifranceFond;
  /** Nom du code (filtre, ex: "Code du travail") */
  codeName?: string;
  /** Date d'application (YYYY-MM-DD), aujourd'hui si omis */
  date?: string;
  /** Nombre de résultats (défaut 5, max 100) */
  pageSize?: number;
}

export interface LegifranceArticleHit {
  /** ID LEGIARTI ou KALIARTI */
  id: string;
  /** Numéro de l'article (ex: "L1232-1") */
  num?: string;
  /** Titre du texte (ex: "Code du travail") */
  titreTexte?: string;
  /** Texte intégral (HTML) */
  texte?: string;
  /** Texte sans HTML (extrait) */
  textePlain?: string;
  /** ETAT de l'article (VIGUEUR, ABROGE…) */
  etat?: string;
  /** URL Légifrance publique */
  url?: string;
}

interface SearchResponse {
  results?: Array<{
    titles?: Array<{ id?: string; titre?: string; cid?: string }>;
    sections?: Array<{
      title?: string;
      extracts?: Array<{
        id?: string;
        num?: string;
        title?: string;
        values?: string[];
      }>;
    }>;
  }>;
  totalResultNumber?: number;
  totalArticleResultNumber?: number;
}

async function postJson<T>(
  path: string,
  payload: unknown
): Promise<T | null> {
  if (!isLegifranceAvailable()) return null;
  try {
    const token = await getPisteToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(
        `[Legifrance] ${path} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(
      `[Legifrance] ${path} threw:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Strippe les balises HTML et normalise les espaces.
 */
function stripHtml(s: string): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Recherche un article dans Légifrance (par défaut dans les codes en vigueur).
 * Retourne les meilleurs hits, triés par pertinence.
 */
export async function searchArticle(
  params: SearchArticleParams
): Promise<LegifranceArticleHit[]> {
  const date = params.date || new Date().toISOString().slice(0, 10);
  const pageSize = params.pageSize ?? 5;
  const fond = params.fond ?? "CODE_DATE";

  const filtres: Array<Record<string, unknown>> = [];
  if (params.codeName) {
    filtres.push({ facette: "NOM_CODE", valeurs: [params.codeName] });
  }
  filtres.push({ facette: "DATE_VERSION", singleDate: date });

  const payload = {
    recherche: {
      champs: [
        {
          typeChamp: "ALL",
          criteres: [
            {
              typeRecherche: "EXACTE",
              valeur: params.query,
              operateur: "ET",
            },
          ],
          operateur: "ET",
        },
      ],
      filtres,
      pageNumber: 1,
      pageSize,
      operateur: "ET",
      sort: "PERTINENCE",
      typePagination: "ARTICLE",
    },
    fond,
  };

  const res = await postJson<SearchResponse>("/search", payload);
  if (!res || !Array.isArray(res.results)) return [];

  const hits: LegifranceArticleHit[] = [];
  for (const r of res.results) {
    const titre =
      r.titles?.[0]?.titre || r.titles?.[0]?.id || "Texte juridique";
    const sections = r.sections || [];
    for (const sec of sections) {
      const extracts = sec.extracts || [];
      for (const ex of extracts) {
        if (!ex.id) continue;
        const rawHtml = (ex.values || []).join(" ");
        hits.push({
          id: ex.id,
          num: ex.num,
          titreTexte: titre,
          texte: rawHtml,
          textePlain: stripHtml(rawHtml),
          url: ex.id.startsWith("LEGIARTI")
            ? `https://www.legifrance.gouv.fr/codes/article_lc/${ex.id}`
            : undefined,
        });
      }
    }
  }
  return hits.slice(0, pageSize);
}

/**
 * Récupère un article par son ID LEGIARTI.
 */
export async function getArticle(
  legiartiId: string
): Promise<LegifranceArticleHit | null> {
  const res = await postJson<{
    article?: {
      id?: string;
      num?: string;
      texte?: string;
      etat?: string;
      cidTexte?: string;
    };
  }>("/consult/getArticle", { id: legiartiId });
  if (!res?.article?.id) return null;
  const a = res.article;
  return {
    id: a.id!,
    num: a.num,
    texte: a.texte,
    textePlain: stripHtml(a.texte || ""),
    etat: a.etat,
    url: `https://www.legifrance.gouv.fr/codes/article_lc/${a.id}`,
  };
}
