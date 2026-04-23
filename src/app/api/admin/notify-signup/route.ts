import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, getAdminEmail, wrapEmailLayout } from "@/lib/email/send";

/**
 * Route appelée depuis /register juste après signUp réussi.
 * Envoie un email à l'administrateur avec le détail du nouvel inscrit
 * + un lien direct qui le mène à la page d'approbation.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // L'utilisateur doit être authentifié (session venant d'être créée par signUp)
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datavocat.fr";
  const adminApprovalsUrl = `${appUrl}/admin/approvals`;

  const meta = user.user_metadata || {};
  const fullName = (meta.full_name as string | undefined) || "—";
  const cabinetName = (meta.cabinet_name as string | undefined) || "—";
  const email = user.email || "—";
  const signedUpAt = new Date(user.created_at).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const html = wrapEmailLayout({
    eyebrow: "Nouvelle demande",
    title: "Un compte attend votre validation",
    body: `
      <p><strong>${escapeHtml(fullName)}</strong> vient de demander l'accès à Datavocat.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:8px 0;color:#6b6658;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;width:130px;">Nom</td>
          <td style="padding:8px 0;color:#0b1220;">${escapeHtml(fullName)}</td>
        </tr>
        <tr style="border-top:1px solid #ecebe3;">
          <td style="padding:8px 0;color:#6b6658;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;">Cabinet</td>
          <td style="padding:8px 0;color:#0b1220;">${escapeHtml(cabinetName)}</td>
        </tr>
        <tr style="border-top:1px solid #ecebe3;">
          <td style="padding:8px 0;color:#6b6658;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;">Email</td>
          <td style="padding:8px 0;color:#0b1220;font-family:'Courier New',monospace;">${escapeHtml(email)}</td>
        </tr>
        <tr style="border-top:1px solid #ecebe3;">
          <td style="padding:8px 0;color:#6b6658;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;">Demande</td>
          <td style="padding:8px 0;color:#0b1220;">${escapeHtml(signedUpAt)}</td>
        </tr>
      </table>
      <p>Validez ou refusez la demande depuis votre tableau d'administration :</p>
    `,
    ctaLabel: "Ouvrir le tableau d'administration",
    ctaHref: adminApprovalsUrl,
    footerNote: `Tant que vous n'avez pas validé, l'utilisateur voit une page d'attente et n'a accès à aucune fonctionnalité.`,
  });

  const textPart = [
    "Nouvelle demande de compte Datavocat",
    "",
    `Nom : ${fullName}`,
    `Cabinet : ${cabinetName}`,
    `Email : ${email}`,
    `Date : ${signedUpAt}`,
    "",
    `Valider : ${adminApprovalsUrl}`,
  ].join("\n");

  const result = await sendEmail({
    to: getAdminEmail(),
    subject: `[Datavocat] Nouvelle demande — ${fullName}`,
    html,
    text: textPart,
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
