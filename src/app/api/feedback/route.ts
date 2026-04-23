import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, getAdminEmail, wrapEmailLayout } from "@/lib/email/send";

/**
 * POST /api/feedback
 * Body : { category: string, message: string }
 *
 * Envoie le message à contact@datavocat.fr avec les infos user pour contexte.
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
  const category = (body.category || "").trim().slice(0, 40);
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
  const fullName = (meta.full_name as string | undefined) || "";
  const cabinetName = (meta.cabinet_name as string | undefined) || "";
  const email = user.email || "";
  const sentAt = new Date().toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const html = wrapEmailLayout({
    eyebrow: `Feedback · ${category || "Suggestion"}`,
    title: `Message de ${fullName || email}`,
    body: `
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;font-size:12px;">
        <tr>
          <td style="padding:6px 0;color:#6b6658;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;width:100px;">Auteur</td>
          <td style="padding:6px 0;color:#0b1220;">${escapeHtml(fullName)} ${cabinetName ? `<span style="color:#6b6658;">· ${escapeHtml(cabinetName)}</span>` : ""}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b6658;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;">Email</td>
          <td style="padding:6px 0;color:#0b1220;font-family:'Courier New',monospace;">${escapeHtml(email)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b6658;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;">Date</td>
          <td style="padding:6px 0;color:#0b1220;">${escapeHtml(sentAt)}</td>
        </tr>
      </table>
      <div style="border-left:2px solid #b88a3e;padding:4px 0 4px 14px;margin:16px 0;">
        <div style="font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.18em;color:#b88a3e;margin-bottom:6px;">Message</div>
        <div style="font-size:14px;line-height:1.65;color:#0b1220;white-space:pre-wrap;">${escapeHtml(message)}</div>
      </div>
    `,
    footerNote: `Répondez directement à cet email pour joindre l'utilisateur.`,
  });

  const result = await sendEmail({
    to: getAdminEmail(),
    subject: `[Datavocat] Feedback — ${category || "Suggestion"} (${fullName || email})`,
    html,
    text: `${category ? `[${category}] ` : ""}De : ${fullName} <${email}>${cabinetName ? ` · ${cabinetName}` : ""}\n\n${message}`,
    replyTo: email,
  });

  return new Response(JSON.stringify(result), {
    status: result.ok || result.skipped ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
