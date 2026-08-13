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
import { extractLegifranceTerms } from "./searchTerms";

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
export function parseTitleCetat(title: string): {
  jurisdiction: string;
  chamber: string;
  date: string;
  numero: string;
} {
  // L'API Légifrance surligne les termes de la recherche avec des balises
  // `<mark>` À L'INTÉRIEUR du titre : « <mark>Tribunal</mark> des Conflits… ».
  // Sans les retirer, aucune regex de juridiction ne peut matcher, et toutes
  // les décisions dont le nom de juridiction contient un terme recherché
  // repartaient en « autre ».
  const t = (title || "").replace(/<\/?[^>]+>/g, "").trim();

  // Juridiction.
  //
  // L'API renvoie en pratique les formes ABRÉGÉES : « CAA de PARIS, … »,
  // « TA de LYON, … ». Les regex précédentes n'acceptaient que les formes
  // développées (« Cour administrative d'appel ») ancrées en début de chaîne :
  // aucune CAA ni aucun TA n'était donc reconnu. Ces décisions repartaient en
  // juridiction « autre », puis étaient rangées en 1er degré par
  // `classifyHierarchy` — faussant la répartition hiérarchique du corpus.
  let jurisdiction = "autre";
  if (/conseil\s+d['’]?\s*[eéEÉ]tat/i.test(t)) {
    jurisdiction = "ce";
  } else if (
    /\bCAA\b|cour\s+administrative\s+d['’]?\s*appel/i.test(t)
  ) {
    jurisdiction = "caa";
  } else if (/tribunal\s+des\s+conflits/i.test(t)) {
    // Le Tribunal des conflits tranche la compétence entre les deux ordres.
    // Il n'appartient à aucun, et son dispositif ne décrit pas une issue au
    // fond : le classer en « tc » permet de l'exclure des taux tout en le
    // conservant comme contexte.
    jurisdiction = "tc";
  } else if (/\bTA\s+de\b|tribunal\s+administratif/i.test(t)) {
    jurisdiction = "ta";
  }

  // Date (DD/MM/YYYY ou YYYY-MM-DD)
  let date = "";
  const dm = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) date = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  const dm2 = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!date && dm2) date = `${dm2[1]}-${dm2[2]}-${dm2[3]}`;

  // Numéro d'instance. Deux formats coexistent :
  //   - Conseil d'État : numérique pur (« 402109 »)
  //   - CAA / TA       : alphanumérique (« 25PA05264 », « 19MA02913 »)
  // L'ancienne regex, ancrée en fin de chaîne et purement numérique, échouait
  // dès qu'une mention suivait (« , Inédit au recueil Lebon ») — le numéro
  // était alors remplacé par l'identifiant technique CETATEXT…, produisant des
  // citations inexploitables pour l'avocat.
  let numero = "";
  const parts = t.split(",").map((p) => p.trim());
  for (const p of parts) {
    if (/^\d{4,8}$/.test(p) || /^\d{2}[A-Z]{2}\d{3,6}$/i.test(p)) {
      numero = p;
      break;
    }
  }

  // Formation : segment situé entre la juridiction et la date.
  let chamber = "";
  const idxDate = parts.findIndex((p) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(p));
  if (idxDate > 1) {
    const candidate = parts.slice(1, idxDate).join(", ").trim();
    if (candidate && candidate.length < 60) chamber = candidate;
  }

  return { jurisdiction, chamber, date, numero };
}

/**
 * Infère la solution de la décision admin à partir du dispositif (en fin
 * de texte). On limite aux 300 derniers caractères pour éviter les faux
 * positifs (ex: "la décision attaquée annule…" dans la motivation).
 *
 * Les valeurs retournées sont conformes au vocabulaire de classifyOutcome
 * (stats.ts) : "Annulation"/"Accueil" → favorable ; "Rejet"/"Non-lieu" →
 * défavorable ; "Sursis"/"" → nuance.
 */
function inferCetatSolution(text: string): string {
  if (!text) return "";
  const t = text.toLowerCase().slice(-300);
  if (/\b(annule|annulation\s+(?:est\s+)?prononc)/.test(t)) return "Annulation";
  if (/\bsursoit\s+à\s+statuer/.test(t)) return "Sursis";
  if (/\bnon[-\s]?lieu/.test(t)) return "Non-lieu";
  if (/\b(rejette|rejeté|déboute|débouté)/.test(t)) return "Rejet";
  if (/\b(fait\s+droit|accueille|accueil)/.test(t)) return "Accueil";
  if (/\bcondamne\b/.test(t)) return "Condamnation";
  return "";
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
  if (jurisdiction === "autre" && process.env.NODE_ENV !== "production") {
    console.warn(`[CETAT] titre non reconnu : ${JSON.stringify(t.title)}`);
  }
  const text = cleanText(r.text || "");
  const solution = inferCetatSolution(text);
  return {
    id: t.id,
    jurisdiction,
    chamber: chamber || "Administrative",
    number: numero ? [numero] : [t.id],
    ecli: undefined,
    solution,
    solution_alt: solution,
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

    // `typeRecherche: "EXACTE"` cherchait la phrase entière de l'avocat mot
    // pour mot : aucune décision ne correspond jamais, et la recherche
    // renvoyait systématiquement 0 résultat — le contentieux administratif
    // était donc absent de tous les corpus, en silence.
    const searchValue = extractLegifranceTerms(args.query);

    const payload = {
      recherche: {
        champs: [
          {
            typeChamp: "ALL",
            criteres: [
              {
                typeRecherche: "UN_DES_MOTS",
                valeur: searchValue,
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
