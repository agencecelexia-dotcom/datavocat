/**
 * Recherche de jurisprudence administrative via Légifrance fond CETAT.
 *
 * CETAT = Conseil d'État + CAA + Tribunaux administratifs (~270 000 décisions).
 * Cette source débloque tout le contentieux administratif que Judilibre n'indexe
 * pas (ordre administratif séparé).
 *
 * Les décisions CETAT sont retournées au format JudilibreDecision pour que le
 * reste du pipeline (rerank Haiku, verify, stats) fonctionne sans modification.
 *
 * Mapping :
 *   - CETATEXT000xxx → JudilibreDecision.id et number[]
 *   - "Conseil d'État, ..., 21/02/2018, 402109" → jurisdiction "ce"/"caa"/"ta"
 *   - text (avec <mark>) → highlights
 *   - extraits → sommaire
 */

import type { JudilibreDecision } from "@/lib/judilibre/client";
import { getPisteToken, isLegifranceAvailable } from "./oauth";

const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";

interface CetatTitle {
  id?: string;
  cid?: string;
  title?: string;
}

interface CetatResult {
  titles?: CetatTitle[];
  text?: string;
  type?: string;
  nature?: string;
  origin?: string;
  sections?: Array<{
    extracts?: Array<{
      values?: string[];
      title?: string;
    }>;
  }>;
}

interface CetatSearchResponse {
  results?: CetatResult[];
  totalResultNumber?: number;
}

/**
 * Détecte si la query relève du contentieux administratif.
 * Si oui, on déclenche une vague de recherche supplémentaire dans CETAT.
 */
export function isAdminMatter(query: string): boolean {
  const q = query.toLowerCase();
  return (
    // Mentions explicites de juridictions admin
    /conseil\s+d['’]\s*[ée]tat|c\.\s*e\.|cour\s+administrative\s+d['’]\s*appel|\bcaa\b|tribunal\s+administratif|\bta\b\s|juge\s+administratif|excès\s+de\s+pouvoir|\brep\b|recours\s+pour\s+excès/.test(
      q
    ) ||
    // Matières typiques admin
    /urbanisme|permis\s+de\s+construire|expropriation|pré[ée]mption|servitude\s+admin/.test(
      q
    ) ||
    /fiscal|fiscalit[ée]|impôt|impot|taxe|tva|redressement\s+fiscal|contrôle\s+fiscal|administration\s+fiscale|cotisation/.test(
      q
    ) ||
    /fonction\s+publique|fonctionnaire|agent\s+public|statut\s+de\s+la\s+fonction|décret\s+fonction/.test(
      q
    ) ||
    /march[ée]s?\s+public|appel\s+d['’]?offres|cahier\s+des\s+charges|mapa|marché\s+(?:de\s+)?travaux/.test(
      q
    ) ||
    /[ée]tranger|oqtf|asile|titre\s+de\s+s[ée]jour|naturalisation|reconduite\s+à\s+la\s+frontière|demandeur\s+d['’]asile/.test(
      q
    ) ||
    /environnement|icpe|biodiversit[ée]|installation\s+class[ée]e|loi\s+sur\s+l['’]eau/.test(
      q
    ) ||
    /collectivit[ée]\s+(?:territoriale|locale)|commune|d[ée]partement\s+contre|région\s+contre|intercommunalit[ée]/.test(
      q
    ) ||
    /cnil|rgpd|donn[ée]es?\s+personnelles?|pr[ée]fet|pr[ée]fecture/.test(q) ||
    /aaai|arcom|adlc|amf\s+sanction|cre\b|ansm/.test(q) ||
    /responsabilit[ée]\s+(?:de\s+(?:la\s+puissance\s+publique|l['’]?[ée]tat|l['’]?administration)|administrative)/.test(
      q
    )
  );
}

/**
 * Parse le titre Légifrance d'une décision CETAT pour extraire :
 *  - juridiction : "ce" (Conseil d'État), "caa" (CAA), "ta" (TA), "autre"
 *  - chamber : "6ème et 5ème chambres réunies", etc.
 *  - date : YYYY-MM-DD
 *  - numero : numéro de pourvoi/instance
 */
function parseTitleCetat(title: string): {
  jurisdiction: string;
  chamber: string;
  date: string;
  numero: string;
} {
  const t = title || "";
  // Juridiction (Légifrance écrit "Conseil d'Etat" sans accent — on tolère)
  let jurisdiction = "autre";
  if (/^conseil\s+d['’]\s*[eéEÉ]tat/i.test(t)) jurisdiction = "ce";
  else if (/^cour\s+administrative\s+d['’]\s*appel/i.test(t)) jurisdiction = "caa";
  else if (/^tribunal\s+administratif/i.test(t)) jurisdiction = "ta";

  // Date (DD/MM/YYYY ou YYYY-MM-DD)
  let date = "";
  const dm = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) date = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  const dm2 = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!date && dm2) date = `${dm2[1]}-${dm2[2]}-${dm2[3]}`;

  // Numéro : à la fin du titre, séquence de 5-7 chiffres
  let numero = "";
  const nm = t.match(/,\s*(\d{4,8})\s*$/);
  if (nm) numero = nm[1];

  // Chamber : entre la juridiction et la date
  let chamber = "";
  const cm = t.match(
    /(?:conseil\s+d['’]\s*[ée]tat|cour\s+administrative\s+d['’]\s*appel(?:\s+de\s+\w+)?|tribunal\s+administratif(?:\s+de\s+\w+)?)\s*,\s*([^,]+?)\s*,\s*\d/i
  );
  if (cm) chamber = cm[1].trim();

  return { jurisdiction, chamber, date, numero };
}

/**
 * Strippe HTML, conserve <mark> comme indication de pertinence (puis le retire).
 */
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

/**
 * Convertit un résultat CETAT au format JudilibreDecision.
 */
function cetatToJudilibreDecision(r: CetatResult): JudilibreDecision | null {
  const t = r.titles?.[0];
  if (!t?.id) return null;
  const { jurisdiction, chamber, date, numero } = parseTitleCetat(
    t.title || ""
  );
  const text = cleanText(r.text || "");
  return {
    id: t.id,
    jurisdiction,
    chamber: chamber || "Administrative",
    number: numero ? [numero] : [t.id],
    ecli: undefined,
    solution: "",
    solution_alt: "",
    date,
    sommaire: text.slice(0, 500),
    themes: [],
    highlights: text ? { text: [text.slice(0, 400)] } : undefined,
  };
}

/**
 * Recherche la jurisprudence administrative dans Légifrance CETAT.
 *
 * @param query mots-clés
 * @param pageSize max 50 (limite Légifrance)
 * @param dateStart YYYY-MM-DD optionnel
 * @returns décisions au format JudilibreDecision (ou tableau vide en cas d'erreur)
 */
export async function searchAdminJurisprudence(args: {
  query: string;
  pageSize?: number;
  dateStart?: string;
  dateEnd?: string;
}): Promise<JudilibreDecision[]> {
  if (!isLegifranceAvailable()) return [];
  const pageSize = Math.min(args.pageSize ?? 30, 50);

  try {
    const token = await getPisteToken();
    const filtres: Array<Record<string, unknown>> = [];
    // Pas de filtre obligatoire pour CETAT — la recherche pleine texte suffit.
    // Si dateStart fourni, on filtre la période.
    if (args.dateStart || args.dateEnd) {
      filtres.push({
        facette: "DATE_DECISION",
        dates: {
          start: args.dateStart || "1970-01-01",
          end: args.dateEnd || new Date().toISOString().slice(0, 10),
        },
      });
    }

    const payload = {
      recherche: {
        champs: [
          {
            typeChamp: "ALL",
            criteres: [
              {
                typeRecherche: "EXACTE",
                valeur: args.query.slice(0, 200),
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
        typePagination: "DEFAUT",
      },
      fond: "CETAT",
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
        `[Legifrance CETAT] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`
      );
      return [];
    }
    const data = (await res.json()) as CetatSearchResponse;
    const results = data.results || [];
    const decisions: JudilibreDecision[] = [];
    for (const r of results) {
      const d = cetatToJudilibreDecision(r);
      if (d) decisions.push(d);
    }
    return decisions;
  } catch (err) {
    console.warn(
      `[Legifrance CETAT] threw:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
