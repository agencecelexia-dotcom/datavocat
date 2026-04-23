import { createClient } from "@/lib/supabase/server";
import { sendEmail, getAdminEmail, type SendEmailResult } from "@/lib/email/send";
import { adminNewSignup, userSignupReceived } from "@/lib/email/templates";

/**
 * Route appelée depuis /register juste après signUp réussi.
 * - Envoie un email à l'administrateur (contact@datavocat.fr) pour validation
 * - Envoie un accusé de réception à l'utilisateur
 *
 * Les deux envois sont indépendants : si l'un échoue, l'autre est tenté.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datavocat.fr";
  const adminApprovalsUrl = `${appUrl}/admin/approvals`;

  const meta = user.user_metadata || {};
  const userFullName = (meta.full_name as string | undefined) || "";
  const cabinetName = (meta.cabinet_name as string | undefined) || "";
  const userEmail = user.email || "";

  // 1. Email admin
  const adminTpl = adminNewSignup({
    userFullName,
    userEmail,
    cabinetName,
    createdAt: user.created_at,
    adminApprovalsUrl,
  });
  const adminResult = await sendEmail({
    to: getAdminEmail(),
    subject: adminTpl.subject,
    html: adminTpl.html,
    text: adminTpl.text,
    replyTo: userEmail || undefined,
  });

  // 2. Email accusé de réception au user
  let userResult: SendEmailResult = { ok: false, skipped: true };
  if (userEmail) {
    const userTpl = userSignupReceived({
      userFullName,
      userEmail,
      createdAt: user.created_at,
    });
    userResult = await sendEmail({
      to: userEmail,
      subject: userTpl.subject,
      html: userTpl.html,
      text: userTpl.text,
    });
  }

  return new Response(
    JSON.stringify({ admin: adminResult, user: userResult }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
