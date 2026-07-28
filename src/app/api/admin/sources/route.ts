import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/email/send";
import { pingJusticeLibre, isJusticeLibreEnabled } from "@/lib/justicelibre/client";
import { isLegifranceAvailable } from "@/lib/legifrance/oauth";

/**
 * GET /api/admin/sources
 *
 * Diagnostic en direct des sources de données jurisprudentielles.
 * Permet de constater depuis le navigateur, sans terminal, quelles sources
 * répondent réellement en production.
 *
 * Accessible uniquement aux emails listés dans ADMIN_EMAILS.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Etat = "ok" | "ko" | "desactive" | "non_configure";

interface SourceStatus {
  cle: string;
  nom: string;
  couverture: string;
  etat: Etat;
  detail: string;
  /** true si l'analyse reste exploitable sans cette source. */
  optionnelle: boolean;
}

/** Vérifie Judilibre par un appel réel minimal (1 résultat). */
async function checkJudilibre(): Promise<SourceStatus> {
  const base: Omit<SourceStatus, "etat" | "detail"> = {
    cle: "judilibre",
    nom: "Judilibre",
    couverture: "Cour de cassation, cours d'appel, TJ, tribunaux de commerce",
    optionnelle: false,
  };

  if (!process.env.PISTE_KEY_ID) {
    return {
      ...base,
      etat: "non_configure",
      detail: "PISTE_KEY_ID absent — source principale indisponible.",
    };
  }

  try {
    const { searchJudilibre } = await import("@/lib/judilibre/client");
    const res = await searchJudilibre({ query: "licenciement", pageSize: 1 });
    return {
      ...base,
      etat: "ok",
      detail: `Opérationnel — ${res.total.toLocaleString("fr-FR")} décisions sur une requête test.`,
    };
  } catch (err) {
    return {
      ...base,
      etat: "ko",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Vérifie Légifrance par une obtention de token OAuth. */
async function checkLegifrance(): Promise<SourceStatus> {
  const base: Omit<SourceStatus, "etat" | "detail"> = {
    cle: "legifrance",
    nom: "Légifrance",
    couverture: "Conseil d'État, CAA, TA, textes de loi, QPC, conventions collectives",
    optionnelle: true,
  };

  if (!isLegifranceAvailable()) {
    return {
      ...base,
      etat: "non_configure",
      detail:
        "PISTE_CLIENT_ID / PISTE_CLIENT_SECRET absents — le contentieux administratif repose alors sur Justicelibre seul.",
    };
  }

  try {
    const { getPisteToken } = await import("@/lib/legifrance/oauth");
    await getPisteToken();
    return { ...base, etat: "ok", detail: "Authentification OAuth réussie." };
  } catch (err) {
    return {
      ...base,
      etat: "ko",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Vérifie Justicelibre par un appel réel sur la source CEDH. */
async function checkJusticeLibre(): Promise<SourceStatus> {
  const base: Omit<SourceStatus, "etat" | "detail"> = {
    cle: "justicelibre",
    nom: "Justicelibre",
    couverture: "CEDH, CJUE, CNIL (contexte normatif, hors statistiques)",
    optionnelle: true,
  };

  if (!isJusticeLibreEnabled()) {
    return {
      ...base,
      etat: "desactive",
      detail: "Coupé volontairement via JUSTICELIBRE_ENABLED=false.",
    };
  }

  const res = await pingJusticeLibre();
  return {
    ...base,
    etat: res.ok ? "ok" : "ko",
    detail: res.ok
      ? `Opérationnel — ${res.sample} décisions CEDH sur une requête test.`
      : res.detail,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller || !isAdminEmail(caller.email)) {
    return new Response(JSON.stringify({ error: "Accès refusé" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Les trois sondes tournent en parallèle et ne peuvent pas se faire tomber
  // l'une l'autre : une source en échec doit rester lisible dans le tableau.
  const sources = await Promise.all([
    checkJudilibre().catch((err) => ({
      cle: "judilibre",
      nom: "Judilibre",
      couverture: "Cour de cassation, cours d'appel, TJ, tribunaux de commerce",
      etat: "ko" as Etat,
      detail: err instanceof Error ? err.message : String(err),
      optionnelle: false,
    })),
    checkLegifrance().catch((err) => ({
      cle: "legifrance",
      nom: "Légifrance",
      couverture: "Conseil d'État, CAA, TA, textes de loi, QPC",
      etat: "ko" as Etat,
      detail: err instanceof Error ? err.message : String(err),
      optionnelle: true,
    })),
    checkJusticeLibre().catch((err) => ({
      cle: "justicelibre",
      nom: "Justicelibre",
      couverture: "CEDH, CJUE, CNIL",
      etat: "ko" as Etat,
      detail: err instanceof Error ? err.message : String(err),
      optionnelle: true,
    })),
  ]);

  // L'analyse reste exploitable tant que la source principale répond.
  const bloquant = sources.some((s) => !s.optionnelle && s.etat !== "ok");

  return new Response(
    JSON.stringify({
      verifieLe: new Date().toISOString(),
      analyseExploitable: !bloquant,
      sources,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
