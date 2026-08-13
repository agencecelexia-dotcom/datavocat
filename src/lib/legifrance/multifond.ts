/**
 * Recherches multi-fonds Légifrance pour enrichir le corpus jurimétrique.
 *
 * Au-delà de JUDILIBRE (déjà branché), Légifrance expose plusieurs autres
 * fonds critiques pour la jurimétrie :
 *
 *  - JURI : jurisprudence judiciaire historique (complète Judilibre, surtout
 *    les arrêts < 1990 et certains inédits non publiés au Bulletin)
 *  - CONSTIT : Conseil constitutionnel (QPC, contrôle de constitutionnalité)
 *  - KALI : conventions collectives (essentielles en droit social)
 *  - JORF/LODA : lois récentes (vérifier qu'aucune réforme ne change la donne)
 *
 * Toutes les fonctions retournent des `JudilibreDecision[]` pour pouvoir
 * fusionner directement avec le corpus principal (rerank Haiku, verify, stats
 * fonctionnent sans changement).
 */

import type { JudilibreDecision } from "@/lib/judilibre/client";
import { getPisteToken, isLegifranceAvailable } from "./oauth";

const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";

interface LegifranceSearchResult {
  titles?: Array<{ id?: string; title?: string }>;
  text?: string;
  origin?: string;
  solution?: string;
  num?: string;
  date?: string;
}

interface LegifranceSearchResponse {
  results?: LegifranceSearchResult[];
  totalResultNumber?: number;
}

function cleanText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/?mark>/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\[\.\.\.\]/g, "[…]")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDateFromTitle(title: string): string {
  // Patterns "du 28 avril 1994" / "06 octobre 2023" / "21/02/2018"
  const dm = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) return `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  const months: Record<string, string> = {
    janvier: "01", "février": "02", fevrier: "02", mars: "03", avril: "04",
    mai: "05", juin: "06", juillet: "07", "août": "08", aout: "08",
    septembre: "09", octobre: "10", novembre: "11", "décembre": "12", decembre: "12",
  };
  const dm2 = title.match(/(\d{1,2})\s+([a-zéûôîâ]+)\s+(\d{4})/i);
  if (dm2) {
    const mm = months[dm2[2].toLowerCase()];
    if (mm) return `${dm2[3]}-${mm}-${dm2[1].padStart(2, "0")}`;
  }
  // Année seule : on NE fabrique PAS de date. Renvoyer `YYYY-01-01` faisait
  // entrer des 1ers janvier fictifs dans `byYear`, `temporalTrend`,
  // `freshDecisions` et `oldestDate` — créant une concentration artificielle
  // sur janvier dans toute analyse temporelle. Une date absente est traitée
  // comme telle par les statistiques.
  return "";
}

async function searchFond<T = JudilibreDecision>(
  fond: string,
  query: string,
  pageSize: number,
  toDecision: (r: LegifranceSearchResult) => T | null
): Promise<T[]> {
  if (!isLegifranceAvailable()) return [];
  try {
    const token = await getPisteToken();
    const payload = {
      recherche: {
        champs: [
          {
            typeChamp: "ALL",
            criteres: [
              {
                typeRecherche: "TOUS_LES_MOTS_DANS_UN_CHAMP",
                valeur: query.slice(0, 200),
                operateur: "ET",
              },
            ],
            operateur: "ET",
          },
        ],
        filtres: [],
        pageNumber: 1,
        pageSize: Math.min(pageSize, 50),
        operateur: "ET",
        sort: "PERTINENCE",
        typePagination: "DEFAUT",
      },
      fond,
    };
    const res = await fetch(`${API_BASE}/search`, {
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
        `[Legifrance ${fond}] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
      );
      return [];
    }
    const data = (await res.json()) as LegifranceSearchResponse;
    const out: T[] = [];
    for (const r of data.results || []) {
      const d = toDecision(r);
      if (d) out.push(d);
    }
    return out;
  } catch (err) {
    console.warn(`[Legifrance ${fond}] threw:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── JURI ─────────────────────────────────────────────────────────
// Jurisprudence judiciaire historique. Complète Judilibre (qui démarre
// principalement en 1990 et reste sélectif). Format différent : titre
// "Cour de Cassation, Chambre sociale, du 28 avril 1994, 90-45.687, Inédit".

function juriToDecision(r: LegifranceSearchResult): JudilibreDecision | null {
  const t = r.titles?.[0];
  if (!t?.id) return null;
  const title = t.title || "";

  // Axe C : déduire la juridiction depuis le titre. JURI contient à la fois
  // des arrêts Cass et des arrêts CA historiques. Forcer "cc" pour tout
  // le monde fausse les stats hiérarchiques et les liens.
  let jurisdiction: string;
  if (/^cour\s+de\s+cassation/i.test(title) || /^cass\./i.test(title)) {
    jurisdiction = "cc";
  } else if (/^cour\s+d['’]\s*appel/i.test(title) || /^c\.?a\./i.test(title)) {
    jurisdiction = "ca";
  } else {
    // Fallback : JURI est dominée par la Cass quand le titre est ambigu.
    jurisdiction = "cc";
  }

  // Détection chambre depuis le titre
  let chamber = "";
  const cm = title.match(/Chambre\s+([a-zéèêà]+)/i);
  if (cm) {
    const c = cm[1].toLowerCase();
    if (c.startsWith("soc")) chamber = "soc";
    else if (c.startsWith("com")) chamber = "com";
    else if (c.startsWith("crim")) chamber = "crim";
    else if (c.startsWith("civ")) chamber = "civ1";
  }
  // Numéro de pourvoi (Cass) ou RG (CA)
  let numero = "";
  if (jurisdiction === "ca") {
    // Format RG : "21/03476"
    const rgm = title.match(/(\d{2,4}\/\d{4,6})/);
    if (rgm) numero = rgm[1];
  }
  if (!numero) {
    // Fallback : format pourvoi "90-45.687"
    const nm = title.match(/(\d{2,4}[-.]\d{2,5}(?:\.\d+)?)/);
    if (nm) numero = nm[1];
  }

  return {
    id: t.id,
    jurisdiction,
    // Ne JAMAIS inventer de chambre. La version précédente attribuait "soc"
    // par défaut à toute décision Cass. dont le titre ne la mentionnait pas :
    // ces décisions étaient ensuite comptées comme chambre sociale dans
    // `byChamber` et `chamberVariations`, faisant afficher au rapport un
    // effectif de chambre sociale incluant des chambres inconnues.
    chamber,
    number: numero ? [numero] : [t.id],
    ecli: undefined,
    solution: r.solution || "",
    solution_alt: r.solution || "",
    date: extractDateFromTitle(title),
    sommaire: cleanText(r.text || "").slice(0, 500),
    themes: [],
    highlights: r.text
      ? { text: [cleanText(r.text).slice(0, 400)] }
      : undefined,
  };
}

export async function searchJuriHistorique(
  query: string,
  pageSize: number = 20
): Promise<JudilibreDecision[]> {
  return searchFond("JURI", query, pageSize, juriToDecision);
}

// ─── CONSTIT ──────────────────────────────────────────────────────
// Conseil constitutionnel : QPC, contrôle a priori, jurisprudence
// constitutionnelle. Crucial pour détecter une remise en cause récente
// d'une norme applicable.

function constitToDecision(r: LegifranceSearchResult): JudilibreDecision | null {
  const t = r.titles?.[0];
  if (!t?.id) return null;
  const title = t.title || "";
  // Détection numéro QPC (ex: "Décision 2023-1064 QPC")
  let numero = "";
  const nm = title.match(/(\d{4}-\d+\s*(?:QPC|DC|LP|FNR|REF))/i);
  if (nm) numero = nm[1];

  return {
    id: t.id,
    // On utilise un code unique "constit" — le rerank/stats le traitera comme
    // "autre" et il atterrira dans premierDegre. Pour le pipeline, c'est OK :
    // le but est de fournir cette décision en contexte à Sonnet, pas d'en
    // faire un % statistique au sens classique.
    jurisdiction: "constit",
    chamber: "Conseil constitutionnel",
    number: numero ? [numero] : [t.id],
    ecli: undefined,
    solution: r.solution || "",
    solution_alt: r.solution || "",
    date: extractDateFromTitle(title),
    sommaire: cleanText(r.text || "").slice(0, 500),
    themes: ["QPC", "Conseil constitutionnel"],
    highlights: r.text
      ? { text: [cleanText(r.text).slice(0, 400)] }
      : undefined,
  };
}

export async function searchConstitutional(
  query: string,
  pageSize: number = 10
): Promise<JudilibreDecision[]> {
  return searchFond("CONSTIT", query, pageSize, constitToDecision);
}

// ─── KALI (conventions collectives) ───────────────────────────────
// Plus complexe : la recherche directe par mots-clés ne marche pas
// bien. Approche en deux temps :
//   1) chercher LA convention applicable par titre (TYPE_DE_NORME)
//   2) ramener ses articles pertinents
// Pour cette première itération, on tente une recherche large et on
// retourne ce qu'on trouve (souvent 0 — à améliorer plus tard).

interface KaliArticle {
  /** ID KALIARTI ou KALITEXT */
  id: string;
  /** Titre de la convention (ex: "Convention collective nationale du bâtiment") */
  titreConvention: string;
  /** Numéro article si applicable */
  num: string;
  /** Texte intégral nettoyé */
  texte: string;
  /** URL Légifrance */
  url: string;
}

export async function searchKaliConvention(
  query: string,
  pageSize: number = 5
): Promise<KaliArticle[]> {
  if (!isLegifranceAvailable()) return [];
  try {
    const token = await getPisteToken();
    const payload = {
      recherche: {
        champs: [
          {
            typeChamp: "ALL",
            criteres: [
              {
                typeRecherche: "TOUS_LES_MOTS_DANS_UN_CHAMP",
                valeur: query.slice(0, 200),
                operateur: "ET",
              },
            ],
            operateur: "ET",
          },
        ],
        filtres: [],
        pageNumber: 1,
        pageSize: Math.min(pageSize, 50),
        operateur: "ET",
        sort: "PERTINENCE",
        typePagination: "DEFAUT",
      },
      fond: "KALI",
    };
    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as LegifranceSearchResponse;
    const out: KaliArticle[] = [];
    for (const r of data.results || []) {
      const t = r.titles?.[0];
      if (!t?.id) continue;
      out.push({
        id: t.id,
        titreConvention: t.title || "",
        num: r.num || "",
        texte: cleanText(r.text || "").slice(0, 800),
        url: `https://www.legifrance.gouv.fr/conv_coll/article/${t.id}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}
