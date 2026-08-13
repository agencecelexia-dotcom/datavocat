/**
 * Garde d'authentification et d'approbation pour les routes API.
 *
 * Contexte : le middleware exclut tout `/api/` de ses contrôles
 * (`middleware.ts` — `isPublicRoute` inclut `pathname.startsWith("/api/")`).
 * Chaque route API doit donc vérifier l'accès elle-même — il n'y a aucun
 * filet en amont.
 *
 * Deux niveaux :
 *   - `requireUser()`        : utilisateur authentifié.
 *   - `requireApprovedUser()`: authentifié ET approuvé. À utiliser sur toute
 *     route qui consomme du budget (Claude, PISTE, Voyage), sans quoi un
 *     compte créé mais non validé peut dépenser sans limite.
 *
 * L'approbation est lue dans `app_metadata`, jamais dans `user_metadata` :
 * `user_metadata` est modifiable par l'utilisateur lui-même via
 * `supabase.auth.updateUser()`, ce qui rendrait le contrôle auto-attribuable.
 */

import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/email/send";
import type { User } from "@supabase/supabase-js";

export interface AuthOk {
  ok: true;
  user: User;
  userId: string;
  userEmail: string | null;
}

export interface AuthFail {
  ok: false;
  response: Response;
}

export type AuthResult = AuthOk | AuthFail;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Vrai si l'utilisateur est approuvé (ou admin, toujours approuvé d'office).
 *
 * Source de vérité : `app_metadata.approved`, écrit uniquement côté serveur
 * via `admin.auth.admin.updateUserById`. On tolère `user_metadata.approved`
 * en lecture seule pour les comptes créés avant la migration vers
 * `app_metadata` — à retirer une fois le backfill effectué.
 */
export function isUserApproved(user: User): boolean {
  if (isAdminEmail(user.email)) return true;
  if (user.app_metadata?.approved === true) return true;
  // Rétro-compatibilité comptes historiques (lecture seule).
  return user.user_metadata?.approved === true;
}

/** Exige un utilisateur authentifié. */
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: jsonError("Non authentifié", 401) };
  }

  return { ok: true, user, userId: user.id, userEmail: user.email ?? null };
}

/**
 * Exige un utilisateur authentifié ET approuvé.
 * À utiliser sur toute route consommant du budget API.
 */
export async function requireApprovedUser(): Promise<AuthResult> {
  const result = await requireUser();
  if (!result.ok) return result;

  if (!isUserApproved(result.user)) {
    return {
      ok: false,
      response: jsonError(
        "Compte en attente de validation. Vous recevrez un email dès son activation.",
        403
      ),
    };
  }

  return result;
}
