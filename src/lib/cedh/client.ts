/**
 * Client HUDOC — jurisprudence de la Cour européenne des droits de l'homme.
 *
 * Source publique, sans authentification : ~182 000 arrêts disponibles en
 * français. Elle comble un angle mort du corpus français sur les matières où
 * la Convention EDH est déterminante : droit des étrangers, libertés
 * fondamentales, procès équitable, détention, vie privée.
 *
 * Particularités de l'API (établies par test) :
 *   - la recherche plein texte s'écrit entre guillemets seuls : `("terme")` ;
 *     `text=`, `fulltext=` et `docname=` ne fonctionnent PAS ;
 *   - les filtres exacts utilisent `champ=="valeur"` ;
 *   - `languageisocode=="FRE"` restreint aux documents en français.
 *
 * Les arrêts CEDH n'entrent PAS dans les statistiques du corpus : la Cour ne
 * statue pas sur le litige national, elle juge la conformité de l'État à la
 * Convention. Les mêler aux taux d'issue favorable n'aurait aucun sens. Ils
 * sont injectés comme contexte, au même titre que les QPC.
 */

const HUDOC_BASE = "https://hudoc.echr.coe.int/app/query/results";

/** Délai au-delà duquel on abandonne la requête HUDOC (source secondaire). */
const HUDOC_TIMEOUT_MS = 12_000;

export interface CedhDecision {
  itemid: string;
  /** Intitulé de l'affaire, ex. « AFFAIRE X c. FRANCE ». */
  docname: string;
  /** Date au format ISO si exploitable. */
  date: string;
  /** Article(s) de la Convention en cause. */
  article: string;
  /** Conclusion de la Cour (violation / non-violation…). */
  conclusion: string;
  /** Niveau d'importance HUDOC : 1 = key case. */
  importance: string;
  /** Lien public vers l'arrêt. */
  url: string;
}

/** Mots vides — mêmes principes que pour Légifrance. */
const STOPWORDS = new Set([
  "mon", "client", "cliente", "conteste", "contester", "affaire", "dossier",
  "jurisprudence", "retient", "motif", "invoque", "situation", "question",
  "sont", "peut", "doit", "faire", "avoir", "etre", "être", "dans", "pour",
  "avec", "sans", "leur", "cette", "elle", "quelle", "quelles", "quels",
  "les", "des", "une", "aux", "que", "qui", "est", "par", "sur", "devant",
  "tribunal", "administratif", "conseil", "cour", "appel", "cassation",
]);

function extractTerms(query: string, max = 6): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^a-zà-ÿ\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4 && !STOPWORDS.has(w))
    ),
  ].slice(0, max);
}

/**
 * Vrai si la demande touche une matière où la Convention EDH est
 * régulièrement mobilisée. On évite d'interroger HUDOC pour un litige
 * commercial ou un bail, où l'apport serait nul.
 */
export function isConventionMatter(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /étranger|etranger|oqtf|asile|séjour|sejour|expulsion|reconduite|réfugié|refugie|apatride/.test(q) ||
    /détention|detention|garde\s+à\s+vue|prison|incarcér|mandat\s+d'arrêt|extradition/.test(q) ||
    /procès\s+équitable|proces\s+equitable|délai\s+raisonnable|impartialité|droits\s+de\s+la\s+défense/.test(q) ||
    /vie\s+privée|vie\s+privee|données\s+personnelles|surveillance|écoutes|ecoutes|domicile/.test(q) ||
    /liberté\s+d'expression|liberte\s+d'expression|religion|manifestation|syndicale|discrimination/.test(q) ||
    /traitement\s+inhumain|torture|dignité|dignite|éloignement|eloignement/.test(q) ||
    /convention\s+européenne|convention\s+europeenne|\bcedh\b|cour\s+européenne/.test(q)
  );
}

/**
 * Recherche des arrêts CEDH en français pertinents pour la demande.
 * Échoue en silence (tableau vide) : la source est secondaire.
 */
export async function searchCedh(
  query: string,
  limit = 5
): Promise<CedhDecision[]> {
  const terms = extractTerms(query);
  if (terms.length === 0) return [];

  // Recherche plein texte : chaque terme entre guillemets, combinés en OR.
  const textClause = terms.map((t) => `("${t}")`).join(" OR ");
  const hudocQuery =
    `(languageisocode=="FRE") AND (documentcollectionid2=="JUDGMENTS") AND (${textClause})`;

  const url =
    `${HUDOC_BASE}?query=${encodeURIComponent(hudocQuery)}` +
    `&select=itemid,docname,kpdate,conclusion,article,importance` +
    `&sort=&start=0&length=${Math.min(limit, 20)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(HUDOC_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CEDH] HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      results?: Array<{ columns?: Record<string, string> }>;
    };

    const out: CedhDecision[] = [];
    for (const r of data.results || []) {
      const c = r.columns || {};
      if (!c.itemid) continue;
      out.push({
        itemid: c.itemid,
        docname: (c.docname || "").trim(),
        date: normalizeDate(c.kpdate || ""),
        article: (c.article || "").trim(),
        conclusion: (c.conclusion || "").trim(),
        importance: (c.importance || "").trim(),
        url: `https://hudoc.echr.coe.int/fre?i=${c.itemid}`,
      });
    }
    console.info(`[CEDH] ${out.length} arrêt(s) récupéré(s).`);
    return out;
  } catch (e) {
    console.warn(
      "[CEDH] recherche indisponible :",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

/** HUDOC renvoie des dates type « 12/03/2024 » ou ISO selon les champs. */
function normalizeDate(raw: string): string {
  const dm = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dm) return `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

/**
 * Formate les arrêts pour injection dans le prompt, en explicitant qu'ils
 * sont du contexte et non de la matière statistique.
 */
export function formatCedhForPrompt(decisions: CedhDecision[]): string {
  if (decisions.length === 0) return "";
  const lines = decisions.map((d) => {
    const meta = [
      d.date || null,
      d.article ? `art. ${d.article} CEDH` : null,
      d.conclusion || null,
    ]
      .filter(Boolean)
      .join(" — ");
    return `### ${d.docname}\n${meta}\nSource : ${d.url}`;
  });

  return (
    `\n\n═══ JURISPRUDENCE DE LA COUR EUROPÉENNE DES DROITS DE L'HOMME ═══\n` +
    `Ces arrêts touchent aux droits garantis par la Convention et peuvent être ` +
    `invoqués devant le juge national, qui est tenu de les appliquer.\n` +
    `⚠️ Ils ne sont PAS comptabilisés dans les statistiques : la Cour juge la ` +
    `conformité de l'État à la Convention, pas l'issue du litige national. ` +
    `Ne les inclus dans AUCUN taux ni dans le tableau de preuve.\n\n` +
    lines.join("\n\n") +
    `\n══════════════════════════════════════════════════════════════════════\n`
  );
}
