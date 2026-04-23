import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isAdminEmail, wrapEmailLayout } from "@/lib/email/send";

/**
 * POST /api/admin/approve
 * Body : { userId: string, approved: boolean }
 *
 * Seuls les emails listés dans ADMIN_EMAILS peuvent approuver/rejeter.
 * Quand `approved` passe à true, un email de bienvenue est envoyé à l'utilisateur.
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

  // Récupère le user ciblé
  const { data: targetData, error: fetchErr } = await admin.auth.admin.getUserById(body.userId);
  if (fetchErr || !targetData?.user) {
    return new Response(JSON.stringify({ error: fetchErr?.message || "User introuvable" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const target = targetData.user;
  const previousApproved = target.user_metadata?.approved === true;

  // Update metadata
  const { error: updateErr } = await admin.auth.admin.updateUserById(body.userId, {
    user_metadata: {
      ...(target.user_metadata || {}),
      approved: body.approved,
      approved_at: body.approved ? new Date().toISOString() : null,
      approved_by: body.approved ? caller.email : null,
    },
  });

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Si on passe de non-approuvé à approuvé → email de bienvenue
  if (body.approved && !previousApproved && target.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datavocat.fr";
    const fullName = (target.user_metadata?.full_name as string | undefined) || "";
    const html = wrapEmailLayout({
      eyebrow: "Accès validé",
      title: "Bienvenue sur Datavocat",
      body: `
        <p>${fullName ? escapeHtml(fullName) + ", votre" : "Votre"} compte a été validé.</p>
        <p>Vous pouvez désormais vous connecter et lancer votre première analyse jurimétrique.</p>
      `,
      ctaLabel: "Accéder à Datavocat",
      ctaHref: appUrl,
      footerNote: `Si vous avez la moindre question, écrivez-nous à contact@datavocat.fr — nous lisons chaque message.`,
    });
    await sendEmail({
      to: target.email,
      subject: "[Datavocat] Votre accès a été validé",
      html,
      text: `Votre compte Datavocat a été validé. Connectez-vous sur ${appUrl}/login`,
    });
  }

  return new Response(
    JSON.stringify({ ok: true, userId: body.userId, approved: body.approved }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
