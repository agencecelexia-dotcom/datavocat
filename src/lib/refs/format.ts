/**
 * Formatage normalisé des citations jurisprudentielles (Axe F).
 *
 * Conventions de citation Dalloz / JCP :
 *   Cassation        : "Cass. soc., 22 mai 2024, n° 22-11.681"
 *   CA judiciaire    : "CA Paris, pôle 6 - ch. 4, 15 mars 2024, n° RG 22/01234"
 *   CAA admin        : "CAA Versailles, 12 février 2024, n° 22VE01234"
 *   CE / CETAT       : "CE, 6e ch., 8 avril 2024, n° 467890"
 *   TA admin         : "TA Paris, 14 mars 2024, n° 2201234"
 *   TJ judiciaire    : "TJ Paris, 12 janvier 2024, n° RG 22/01234"
 *   CPH judiciaire   : "CPH Paris, 5 février 2024, n° RG F22/01234"
 *   Conseil const.   : "Cons. const., 7 octobre 2022, n° 2022-1018 QPC"
 *
 * Espaces insécables (` `) systématiques avant les n°/numéros pour ne pas
 * casser la ligne. Italique appliqué côté UI sur l'abréviation de juridiction.
 */

import type { JudilibreDecision } from "@/lib/judilibre/client";

export type CitationSource =
  | "judilibre" // décision Cass / CA via Judilibre
  | "legifrance-juri" // JURI historique
  | "legifrance-cetat" // Conseil d'État / CAA / TA
  | "legifrance-constit" // Conseil constitutionnel
  | "legifrance-kali" // convention collective
  | "unknown";

export interface CitationFormatted {
  /** Libellé court rendu : "Cass. soc., 22 mai 2024, n° 22-11.681" */
  label: string;
  /** Partie en italique du label (ex. "Cass. soc.") — pour rendu typo. */
  italicPrefix: string;
  /** Reste du label (date + numéro). */
  suffix: string;
  /** URL Légifrance directe (si décision dans corpus). */
  url: string | null;
  /** Source du fonds — pour picto / badge UI. */
  source: CitationSource;
  /** Vrai si la décision a été vérifiée dans le corpus. */
  verified: boolean;
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function formatDateFr(iso: string | undefined): string | null {
  if (!iso) return null;
  // "2024-05-22" → "22 mai 2024"
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  return `${day} ${MONTHS_FR[month - 1]} ${year}`;
}

const CHAMBER_LABELS: Record<string, string> = {
  soc: "soc",
  civ1: "civ. 1re",
  civ2: "civ. 2e",
  civ3: "civ. 3e",
  com: "com",
  crim: "crim",
  mi: "ch. mixte",
  pl: "ass. plén",
};

function detectSource(d: JudilibreDecision): CitationSource {
  const id = d.id || "";
  if (/^CETATEXT/.test(id)) return "legifrance-cetat";
  if (/^JURI(?:TEXT|CA|HISTO)/.test(id)) return "legifrance-juri";
  if (/^CONSTEXT/.test(id)) return "legifrance-constit";
  // jurisdiction "constit" : QPC injectées en bloc séparé, fallback
  if ((d.jurisdiction || "").toLowerCase() === "constit") return "legifrance-constit";
  // jurisdiction admin : sans préfixe identifiable mais juridiction détectée
  const j = (d.jurisdiction || "").toLowerCase();
  if (j === "ce" || j === "caa" || j === "ta") return "legifrance-cetat";
  return "judilibre";
}

function pickFirstNumber(d: JudilibreDecision): string {
  const n = d.number;
  if (Array.isArray(n)) return n[0] || "";
  return n || "";
}

function buildUrl(d: JudilibreDecision): string | null {
  const id = d.id || "";
  if (/^CETATEXT\d+/.test(id)) return `https://www.legifrance.gouv.fr/ceta/id/${id}`;
  if (/^JURI(?:TEXT|CA|HISTO)\d+/.test(id))
    return `https://www.legifrance.gouv.fr/juri/id/${id}`;
  if (/^CONSTEXT\d+/.test(id)) return `https://www.legifrance.gouv.fr/cons/id/${id}`;
  if (d.ecli) {
    return `https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(d.ecli)}&page=1&init=true`;
  }
  const num = pickFirstNumber(d);
  if (num) {
    return `https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(num)}&page=1&init=true`;
  }
  return null;
}

/**
 * Formate une décision en citation normalisée style Dalloz / JCP.
 */
export function formatCitation(d: JudilibreDecision): CitationFormatted {
  const j = (d.jurisdiction || "").toLowerCase();
  const dateStr = formatDateFr(d.date);
  const num = pickFirstNumber(d);
  const source = detectSource(d);

  let italicPrefix: string;
  let numLabel: string;

  switch (j) {
    case "cc": {
      const ch = (d.chamber || "").toLowerCase();
      const chLabel = CHAMBER_LABELS[ch] || ch || "";
      italicPrefix = chLabel ? `Cass. ${chLabel}.,` : "Cass.,";
      numLabel = num ? `n° ${num}` : "";
      break;
    }
    case "ca": {
      italicPrefix = "CA,";
      numLabel = num ? `n° RG ${num}` : "";
      break;
    }
    case "caa": {
      italicPrefix = "CAA,";
      numLabel = num ? `n° ${num}` : "";
      break;
    }
    case "ce": {
      italicPrefix = "CE,";
      numLabel = num ? `n° ${num}` : "";
      break;
    }
    case "ta": {
      italicPrefix = "TA,";
      numLabel = num ? `n° ${num}` : "";
      break;
    }
    case "tj":
      italicPrefix = "TJ,";
      numLabel = num ? `n° RG ${num}` : "";
      break;
    case "tcom":
      italicPrefix = "T. com.,";
      numLabel = num ? `n° RG ${num}` : "";
      break;
    case "cph":
      italicPrefix = "CPH,";
      numLabel = num ? `n° RG ${num}` : "";
      break;
    case "constit":
      italicPrefix = "Cons. const.,";
      numLabel = num ? `n° ${num}` : "";
      break;
    default:
      italicPrefix = j ? j.toUpperCase() + "," : "";
      numLabel = num ? `n° ${num}` : "";
  }

  const parts: string[] = [];
  if (dateStr) parts.push(dateStr);
  if (numLabel) parts.push(numLabel);
  const suffix = parts.join(", ");
  const label = italicPrefix
    ? suffix
      ? `${italicPrefix} ${suffix}`
      : italicPrefix.replace(/,$/, "")
    : suffix;

  return {
    label,
    italicPrefix,
    suffix,
    url: buildUrl(d),
    source,
    verified: true, // par construction : on a une JudilibreDecision en main
  };
}

/**
 * Picto associé à une source pour rendu UI (texte court — peut être utilisé
 * comme contenu d'une span, ou matché à une icône lucide-react).
 */
export function sourceBadge(source: CitationSource): { label: string; tone: string } {
  switch (source) {
    case "judilibre":
      return { label: "Judilibre", tone: "var(--gold)" };
    case "legifrance-juri":
      return { label: "Légifrance JURI", tone: "var(--gold)" };
    case "legifrance-cetat":
      return { label: "Légifrance CETAT", tone: "var(--emerald)" };
    case "legifrance-constit":
      return { label: "Légifrance CONSTIT", tone: "var(--bordeaux)" };
    case "legifrance-kali":
      return { label: "Légifrance KALI", tone: "var(--muted-foreground)" };
    default:
      return { label: "Source non identifiée", tone: "var(--muted-foreground)" };
  }
}
