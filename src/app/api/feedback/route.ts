import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, getAdminEmail } from "@/lib/email/send";
import { adminFeedback, userFeedbackReceived } from "@/lib/email/templates";

/**
 * POST /api/feedback
 * Body : { category: string, message: string }
 *
 * Envoie le message à contact@datavocat.fr avec reply-to = email du user.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as {
    category?: string;
    message?: string;
  };
  const category = (body.category || "").trim().slice(0, 40) || "Autre";
  const message = (body.message || "").trim();

  if (!message || message.length < 4) {
    return new Response(JSON.stringify({ error: "Message requis (4 caractères min.)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (message.length > 5000) {
    return new Response(JSON.stringify({ error: "Message trop long (5000 car. max.)" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  const meta = user.user_metadata || {};
  const userFullName = (meta.full_name as string | undefined) || "";
  const cabinetName = (meta.cabinet_name as string | undefined) || "";
  const userEmail = user.email || "";

  // 1. Email admin
  const adminTpl = adminFeedback({
    userFullName,
    userEmail,
    cabinetName,
    category,
    message,
    sentAt: new Date(),
  });

  const adminResult = await sendEmail({
    to: getAdminEmail(),
    subject: adminTpl.subject,
    html: adminTpl.html,
    text: adminTpl.text,
    replyTo: userEmail || undefined,
  });

  // 2. Accusé de réception au user
  if (userEmail) {
    const userTpl = userFeedbackReceived({
      userFullName,
      category,
      message,
    });
    await sendEmail({
      to: userEmail,
      subject: userTpl.subject,
      html: userTpl.html,
      text: userTpl.text,
    });
  }

  return new Response(JSON.stringify(adminResult), {
    status: adminResult.ok || adminResult.skipped ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}
