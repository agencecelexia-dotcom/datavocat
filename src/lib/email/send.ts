/**
 * Wrapper d'envoi d'email via Resend (resend.com).
 *
 * Fonctionne sans clé API — les appels sont no-op silencieux en l'absence
 * de RESEND_API_KEY. Les templates HTML sont dans `./templates.ts`.
 *
 * Env vars en prod :
 *   RESEND_API_KEY   — clé API Resend
 *   EMAIL_FROM       — adresse d'envoi (ex. "Datavocat <no-reply@datavocat.fr>")
 *   ADMIN_EMAIL      — destinataire des notifications admin
 *   ADMIN_EMAILS     — liste CSV des emails autorisés à accéder à /admin
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
  skipped?: boolean;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY manquant — email ignoré :", options.subject);
    return { ok: false, skipped: true };
  }

  const from = process.env.EMAIL_FROM || `Datavocat <no-reply@datavocat.fr>`;

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
