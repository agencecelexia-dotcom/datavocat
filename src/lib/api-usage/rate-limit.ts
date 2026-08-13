/**
 * Limitation de débit par utilisateur pour les routes coûteuses.
 *
 * Contexte : chaque analyse déclenche ~200 requêtes PISTE, un appel Haiku de
 * rerank, des embeddings Voyage et un appel Sonnet — de l'ordre de 0,5 $. Rien
 * ne plafonnait cette consommation : `/admin/costs` permettait de constater la
 * dérive, pas de l'empêcher.
 *
 * Implémentation : fenêtre glissante lue depuis `api_usage`, qui enregistre
 * déjà chaque appel modèle avec son `user_id` et son horodatage. Cela évite
 * d'introduire une dépendance Redis pour un besoin de cette taille.
 *
 * Limite : le compteur repose sur les lignes effectivement écrites, or le
 * tracking est fail-silent. Une rafale simultanée peut donc légèrement
 * dépasser le quota. C'est un garde-fou de coût, pas un mécanisme de sécurité
 * — pour ce dernier usage, un store atomique (Redis/Upstash) serait requis.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitedOperation = "analyze" | "chat" | "clarify" | "rapport";

interface Quota {
  /** Nombre maximum d'appels autorisés dans la fenêtre. */
  max: number;
  /** Durée de la fenêtre glissante, en minutes. */
  windowMinutes: number;
  /** Message affiché à l'utilisateur en cas de dépassement. */
  label: string;
}

const QUOTAS: Record<RateLimitedOperation, Quota> = {
  // ~0,5 $ par analyse : c'est la ressource à protéger en priorité.
  analyze: { max: 20, windowMinutes: 60, label: "analyses" },
  // Appels Haiku, nettement moins coûteux mais illimités jusqu'ici.
  chat: { max: 120, windowMinutes: 60, label: "messages" },
  clarify: { max: 60, windowMinutes: 60, label: "demandes de clarification" },
  rapport: { max: 30, windowMinutes: 60, label: "rapports" },
};

export interface RateLimitOk {
  ok: true;
  remaining: number;
}

export interface RateLimitExceeded {
  ok: false;
  response: Response;
}

export type RateLimitResult = RateLimitOk | RateLimitExceeded;

/**
 * Vérifie le quota de l'utilisateur pour une opération donnée.
 *
 * En cas d'erreur de lecture, on laisse passer : un incident d'infrastructure
 * ne doit pas bloquer le produit. Le risque est borné par le quota lui-même.
 */
export async function checkRateLimit(
  userId: string,
  operation: RateLimitedOperation
): Promise<RateLimitResult> {
  const quota = QUOTAS[operation];
  const since = new Date(
    Date.now() - quota.windowMinutes * 60_000
  ).toISOString();

  try {
    const admin = createAdminClient();
    const client = admin as unknown as {
      from: (table: string) => {
        select: (
          cols: string,
          opts: { count: "exact"; head: true }
        ) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => {
              gte: (
                c: string,
                v: unknown
              ) => Promise<{ count: number | null; error: unknown }>;
            };
          };
        };
      };
    };

    const { count, error } = await client
      .from("api_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("operation", operation)
      .gte("created_at", since);

    if (error || count === null) return { ok: true, remaining: quota.max };

    if (count >= quota.max) {
      const retryAfter = quota.windowMinutes * 60;
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            error:
              `Limite atteinte : ${quota.max} ${quota.label} par heure. ` +
              `Réessayez dans quelques minutes.`,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
            },
          }
        ),
      };
    }

    return { ok: true, remaining: quota.max - count };
  } catch {
    // Panne de lecture : on n'interrompt pas le service.
    return { ok: true, remaining: quota.max };
  }
}
