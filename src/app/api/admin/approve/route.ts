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
  const previousApproved = target.user_metadata?.approved === true;

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
