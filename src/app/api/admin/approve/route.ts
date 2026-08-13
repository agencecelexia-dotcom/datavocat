import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isAdminEmail } from "@/lib/email/send";
import { userApproved, userRevoked } from "@/lib/email/templates";

/**
 * POST /api/admin/approve
 * Body : { userId: string, approved: boolean }
 *
 * Seuls les emails listés dans ADMIN_EMAILS peuvent approuver/révoquer.
 * - approved: true  → email "bienvenue" envoyé au user (si transition false→true)
 * - approved: false → email "révocation" envoyé au user (si transition true→false)
 */
export async function POST(request: NextRequest) {
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

  const body = (await request.json()) as {
    userId?: string;
    approved?: boolean;
  };
  if (!body.userId || typeof body.approved !== "boolean") {
    return new Response(JSON.stringify({ error: "userId + approved requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createAdminClient();

  const { data: targetData, error: fetchErr } = await admin.auth.admin.getUserById(body.userId);
  if (fetchErr || !targetData?.user) {
    return new Response(JSON.stringify({ error: fetchErr?.message || "User introuvable" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const target = targetData.user;
  // On lit les deux emplacements : app_metadata (source de vérité depuis la
  // migration 00020) et user_metadata (comptes historiques).
  const previousApproved =
    target.app_metadata?.approved === true ||
    target.user_metadata?.approved === true;

  // Un admin ne peut pas se révoquer lui-même par cette route.
  if (!body.approved && caller.id === body.userId) {
    return new Response(
      JSON.stringify({ error: "Vous ne pouvez pas révoquer votre propre compte." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // L'approbation est écrite dans `app_metadata` : seul le service_role peut
  // l'y modifier. La stocker dans `user_metadata` la rendait auto-attribuable
  // par l'utilisateur via `supabase.auth.updateUser()`.
  // On nettoie au passage la clé héritée dans `user_metadata` pour qu'il ne
  // subsiste qu'une seule source de vérité.
  const { approved: _legacyApproved, approved_at: _legacyAt, approved_by: _legacyBy, ...cleanUserMetadata } =
    (target.user_metadata || {}) as Record<string, unknown>;
  void _legacyApproved;
  void _legacyAt;
  void _legacyBy;

  const { error: updateErr } = await admin.auth.admin.updateUserById(body.userId, {
    app_metadata: {
      ...(target.app_metadata || {}),
      approved: body.approved,
      approved_at: body.approved ? new Date().toISOString() : null,
      approved_by: body.approved ? caller.email : null,
    },
    user_metadata: cleanUserMetadata,
  });

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Emails transactionnels selon la transition
  const userFullName = (target.user_metadata?.full_name as string | undefined) || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datavocat.fr";

  if (target.email) {
    if (body.approved && !previousApproved) {
      const tpl = userApproved({ userFullName, appUrl });
      await sendEmail({
        to: target.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    } else if (!body.approved && previousApproved) {
      const tpl = userRevoked({ userFullName });
      await sendEmail({
        to: target.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, userId: body.userId, approved: body.approved }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
