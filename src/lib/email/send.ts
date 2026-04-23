/**
 * Helper d'envoi d'email via Resend (resend.com).
 *
 * Fonctionne sans clé API — les appels sont no-op en l'absence de
 * RESEND_API_KEY. Ça permet à l'application de rester fonctionnelle en
 * dev / staging et de ne bloquer aucun flow utilisateur.
 *
 * Env vars nécessaires en prod :
 *   RESEND_API_KEY   — clé API Resend
 *   EMAIL_FROM       — adresse d'envoi (ex. "Datavocat <no-reply@datavocat.fr>")
 *   ADMIN_EMAIL      — destinataire des notifications admin (ex. contact@datavocat.fr)
 */

const CONTACT_EMAIL = "contact@datavocat.fr";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean; // true si RESEND_API_KEY manque (dev/sans config)
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY manquant — email ignoré :", options.subject);
    return { ok: false, skipped: true };
  }

  const from =
    process.env.EMAIL_FROM || `Datavocat <no-reply@datavocat.fr>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend error", res.status, body);
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] Resend fetch failed", msg);
    return { ok: false, error: msg };
  }
}

export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || CONTACT_EMAIL;
}

export function getAdminEmails(): string[] {
  // ADMIN_EMAILS = liste séparée par virgules, utilisée pour la protection des
  // routes /admin et la vérification d'accès page-side.
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return [CONTACT_EMAIL];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

/**
 * Wrapper commun pour un email en style Greffe. Évite de dupliquer le
 * skeleton HTML dans chaque template.
 */
export function wrapEmailLayout(args: {
  eyebrow: string;
  title: string;
  body: string; // HTML
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
}): string {
  const { eyebrow, title, body, ctaLabel, ctaHref, footerNote } = args;
  const cta = ctaLabel && ctaHref
    ? `<p style="margin:28px 0;">
         <a href="${ctaHref}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:600;font-family:Inter,Arial,sans-serif;">${ctaLabel}</a>
       </p>`
    : "";
  return `
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:32px 16px;background:#f6f4ef;font-family:Inter,Arial,sans-serif;color:#0b1220;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e2d9;border-radius:10px;">
    <tr><td style="padding:36px 36px 28px 36px;">
      <div style="font-family:Georgia,serif;font-size:16px;font-weight:500;color:#0b1220;margin-bottom:24px;">Datavocat <span style="color:#b88a3e;">·</span> Jurimétrie</div>
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#b88a3e;margin-bottom:12px;">§ ${escapeHtml(eyebrow)}</div>
      <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:500;line-height:1.1;letter-spacing:-0.015em;color:#0b1220;margin:0 0 16px 0;">${escapeHtml(title)}</h1>
      <div style="font-size:14.5px;line-height:1.65;color:#0b1220;">${body}</div>
      ${cta}
      ${footerNote ? `<p style="font-size:12px;color:#6b6658;margin-top:24px;border-top:1px solid #e5e2d9;padding-top:16px;">${footerNote}</p>` : ""}
    </td></tr>
  </table>
  <p style="text-align:center;font-size:11px;color:#6b6658;margin-top:20px;font-family:'Courier New',monospace;letter-spacing:0.15em;text-transform:uppercase;">Datavocat · © 2026 · ${CONTACT_EMAIL}</p>
</body></html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
