/**
 * Fonds CNIL — délibérations et sanctions de la Commission nationale de
 * l'informatique et des libertés (~26 000 documents).
 *
 * Accessible avec la clé Légifrance existante, ce fonds n'était pas exploité.
 * Il apporte la matière décisionnelle en conformité RGPD : sanctions
 * pécuniaires, mises en demeure, recommandations sectorielles.
 *
 * Comme les QPC et les arrêts CEDH, ces décisions sont du CONTEXTE : une
 * sanction administrative de la CNIL ne se compare pas à l'issue d'un litige
 * judiciaire, et n'entre donc dans aucun taux.
 */

import { getPisteToken, isLegifranceAvailable } from "./oauth";
import { extractLegifranceTerms } from "./searchTerms";

const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";
const CNIL_TIMEOUT_MS = 12_000;

export interface CnilDeliberation {
  id: string;
  title: string;
  date: string;
  /** Numéro de délibération, ex. « SAN-2026-002 ». */
  numero: string;
  /** Extrait du texte. */
  extrait: string;
  url: string;
}

/** Vrai si la demande touche la protection des données personnelles. */
export function isDataProtectionMatter(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\brgpd\b|données\s+personnelles|donnees\s+personnelles|\bcnil\b/.test(q) ||
    /traitement\s+de\s+données|traitement\s+de\s+donnees|responsable\s+de\s+traitement/.test(q) ||
    /sous-traitant|consentement|cookies?|prospection|démarchage|demarchage/.test(q) ||
    /vidéosurveillance|videosurveillance|géolocalisation|geolocalisation|biométrie|biometrie/.test(q) ||
    /droit\s+à\s+l'oubli|portabilité|violation\s+de\s+données|data\s+protection/.test(q)
  );
}

/**
 * Recherche des délibérations CNIL pertinentes. Fail-silent.
 */
export async function searchCnil(
  query: string,
  limit = 5
): Promise<CnilDeliberation[]> {
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
                typeRecherche: "UN_DES_MOTS",
                valeur: extractLegifranceTerms(query),
                operateur: "ET",
              },
            ],
            operateur: "ET",
          },
        ],
        filtres: [],
        pageNumber: 1,
        pageSize: Math.min(limit, 20),
        operateur: "ET",
        sort: "PERTINENCE",
        typePagination: "DEFAUT",
      },
      fond: "CNIL",
    };

    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CNIL_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[CNIL] HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      results?: Array<{
        titles?: Array<{ id?: string; title?: string }>;
        text?: string;
        date?: string;
      }>;
    };

    const out: CnilDeliberation[] = [];
    for (const r of data.results || []) {
      const t = r.titles?.[0];
      if (!t?.id) continue;
      const title = stripTags(t.title || "");
      out.push({
        id: t.id,
        title,
        date: extractDate(title, r.date),
        numero: extractNumero(title),
        extrait: stripTags(r.text || "").slice(0, 400),
        url: `https://www.legifrance.gouv.fr/cnil/id/${t.id}`,
      });
    }
    console.info(`[CNIL] ${out.length} délibération(s) récupérée(s).`);
    return out;
  } catch (e) {
    console.warn(
      "[CNIL] recherche indisponible :",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

/** L'API insère des <mark> de surlignage dans les titres. */
function stripTags(s: string): string {
  return s
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumero(title: string): string {
  const m = title.match(/n°\s*([A-Z]{2,4}-\d{4}-\d{1,4})/i);
  return m ? m[1] : "";
}

function extractDate(title: string, fallback?: string): string {
  const months: Record<string, string> = {
    janvier: "01", février: "02", fevrier: "02", mars: "03", avril: "04",
    mai: "05", juin: "06", juillet: "07", août: "08", aout: "08",
    septembre: "09", octobre: "10", novembre: "11", décembre: "12", decembre: "12",
  };
  const m = title.match(/(\d{1,2})\s+([a-zéûôîâ]+)\s+(\d{4})/i);
  if (m) {
    const mm = months[m[2].toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
  }
  if (fallback) {
    const iso = String(fallback).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return "";
}

/** Formate les délibérations pour le prompt. */
export function formatCnilForPrompt(delibs: CnilDeliberation[]): string {
  if (delibs.length === 0) return "";
  const lines = delibs.map((d) => {
    const head = [d.numero || null, d.date || null].filter(Boolean).join(" — ");
    return `### ${d.title.slice(0, 140)}\n${head}\n${d.extrait}\nSource : ${d.url}`;
  });

  return (
    `\n\n═══ DÉLIBÉRATIONS ET SANCTIONS CNIL ═══\n` +
    `Décisions de l'autorité de contrôle en matière de protection des données. ` +
    `Elles fixent la doctrine applicable et le niveau des sanctions encourues.\n` +
    `⚠️ Ce sont des décisions administratives : ne les comptabilise dans AUCUN ` +
    `taux jurisprudentiel et ne les inscris pas au tableau de preuve.\n\n` +
    lines.join("\n\n") +
    `\n══════════════════════════════════════════════════════════════════════\n`
  );
}
