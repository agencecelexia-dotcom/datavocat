/**
 * Templates d'emails transactionnels Datavocat.
 *
 * Charte : style Greffe éditorial, rendu inline-style (pas de CSS externe
 * pour compatibilité Gmail/Outlook/Apple Mail), logo monogram SVG inline,
 * preheader text, couleurs des tokens du site (--ink, --gold, --paper).
 *
 * Chaque fonction retourne `{ subject, html, text }` et, le cas échéant,
 * un `replyTo`. L'appel effectif à Resend est fait par `sendEmail()` dans
 * `src/lib/email/send.ts`.
 */

const CONTACT_EMAIL = "contact@datavocat.fr";
const INK = "#0b1220";
const NAVY = "#1e3a5f";
const GOLD = "#b88a3e";
const GOLD_WARM = "#c9a96e";
const PAPER = "#f6f4ef";
const LINE = "#e5e2d9";
const LINE_SOFT = "#ecebe3";
const MUTED = "#6b6658";
const CARD = "#ffffff";
const BORDEAUX = "#9b2226";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Formate une date ISO en français */
function fmtDateFr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}

/**
 * Logo monogram Datavocat SVG inline (D sérif noir + balance gold).
 * Encodé en base64 pour compatibilité maximale (certains clients mail
 * bloquent les SVG externes).
 */
function logoSvg(): string {
  return `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
  <rect width="32" height="32" rx="6" fill="${PAPER}"/>
  <path d="M9 8.5h7.2c4.6 0 7.8 3.1 7.8 7.5s-3.2 7.5-7.8 7.5H9V8.5z" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
  <path d="M7 8.5h4M7 23.5h4" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M12.5 16h11" stroke="${GOLD_WARM}" stroke-width="1.25" stroke-linecap="round"/>
  <circle cx="14" cy="16" r="0.9" fill="${GOLD_WARM}"/>
  <circle cx="22" cy="16" r="0.9" fill="${GOLD_WARM}"/>
</svg>`.trim();
}

/**
 * Skeleton d'email Greffe, commun à tous les templates.
 * Retourne le HTML complet, avec preheader (aperçu inbox) caché.
 */
export function layout(args: {
  preheader: string; // texte affiché dans l'aperçu de la boîte de réception
  eyebrow: string; // "§ NOUVELLE DEMANDE"
  title: string;
  body: string; // HTML
  ctaLabel?: string;
  ctaHref?: string;
  ctaVariant?: "ink" | "gold";
  footerNote?: string; // petit texte en fin, au-dessus du footer brand
}): string {
  const { preheader, eyebrow, title, body, ctaLabel, ctaHref, ctaVariant = "ink", footerNote } = args;
  const ctaBg = ctaVariant === "gold" ? GOLD : INK;

  const cta = ctaLabel && ctaHref
    ? `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0 0;">
    <tr><td style="border-radius:6px;background:${ctaBg};">
      <a href="${ctaHref}" target="_blank"
         style="display:inline-block;padding:13px 24px;border-radius:6px;background:${ctaBg};color:#ffffff;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:13.5px;font-weight:600;letter-spacing:0.01em;">
        ${escapeHtml(ctaLabel)}&nbsp;→
      </a>
    </td></tr>
  </table>`
    : "";

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Preheader (caché visuellement, visible dans l'inbox) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header brand -->
          <tr><td style="padding:4px 0 20px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px;">${logoSvg()}</td>
                <td style="vertical-align:middle;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:500;color:${INK};line-height:1;letter-spacing:-0.01em;">Datavocat</div>
                  <div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:${MUTED};margin-top:3px;">Jurimétrie</div>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Card -->
          <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:10px;padding:40px 44px;">
            <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${GOLD};margin-bottom:14px;">§ ${escapeHtml(eyebrow)}</div>
            <h1 style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:500;line-height:1.1;letter-spacing:-0.015em;color:${INK};">${escapeHtml(title)}</h1>
            <div style="font-size:14.5px;line-height:1.65;color:${INK};">${body}</div>
            ${cta}
            ${footerNote ? `<div style="margin-top:28px;padding-top:20px;border-top:1px solid ${LINE_SOFT};font-size:12.5px;line-height:1.6;color:${MUTED};">${footerNote}</div>` : ""}
          </td></tr>

          <!-- Footer brand -->
          <tr><td style="padding:20px 16px 4px 16px;text-align:center;">
            <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:${MUTED};line-height:1.5;">
              Datavocat · Analyse jurimétrique · © 2026<br>
              <a href="mailto:${CONTACT_EMAIL}" style="color:${MUTED};text-decoration:none;">${CONTACT_EMAIL}</a>
              &nbsp;·&nbsp;
              <a href="https://datavocat.fr" style="color:${MUTED};text-decoration:none;">datavocat.fr</a>
            </div>
          </td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Bloc metadata key/value propre (utilisé pour rendre "Nom : X · Cabinet : Y").
 */
function metaTable(rows: Array<{ label: string; value: string; mono?: boolean }>): string {
  const items = rows
    .map(
      (r, i) => `
    <tr ${i > 0 ? `style="border-top:1px solid ${LINE_SOFT};"` : ""}>
      <td style="padding:9px 12px 9px 0;width:120px;vertical-align:top;color:${MUTED};font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;letter-spacing:0.15em;">${escapeHtml(r.label)}</td>
      <td style="padding:9px 0;color:${INK};${r.mono ? "font-family:'Courier New',monospace;" : ""}font-size:13.5px;line-height:1.5;">${escapeHtml(r.value)}</td>
    </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px 0;border-top:1px solid ${LINE_SOFT};">${items}</table>`;
}

/**
 * Bloc quote avec filet gold (pour messages, citations).
 */
function quoteBlock(label: string, content: string): string {
  return `
<div style="margin:20px 0 8px 0;padding:4px 0 4px 14px;border-left:2px solid ${GOLD};">
  <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD};margin-bottom:8px;">${escapeHtml(label)}</div>
  <div style="font-size:14px;line-height:1.65;color:${INK};white-space:pre-wrap;">${escapeHtml(content)}</div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

export interface UserSignupReceivedTpl {
  userFullName: string;
  userEmail: string;
  createdAt: string | Date;
}

/** Email au user : "Votre demande d'inscription a bien été reçue". */
export function userSignupReceived(args: UserSignupReceivedTpl) {
  const greeting = args.userFullName ? escapeHtml(args.userFullName) : "Bonjour";
  const dateStr = fmtDateFr(args.createdAt);

  const html = layout({
    preheader: `Votre demande d'accès à Datavocat a bien été reçue, réponse sous 24 à 48 h ouvrées.`,
    eyebrow: "Demande reçue",
    title: "Nous avons bien reçu votre demande",
    body: `
      <p style="margin:0 0 12px 0;">${greeting}${args.userFullName ? "," : ""}</p>
      <p style="margin:0 0 12px 0;">Votre demande d'accès à <strong style="color:${INK};">Datavocat</strong> a bien été enregistrée le <span style="color:${INK};">${escapeHtml(dateStr)}</span>.</p>
      <p style="margin:0 0 12px 0;">Datavocat est actuellement réservé à une liste fermée de cabinets partenaires. Un administrateur va examiner votre demande manuellement.</p>
      <p style="margin:0;">Vous recevrez un email sur <strong style="color:${INK};">${escapeHtml(args.userEmail)}</strong> dès que votre compte sera validé — généralement sous <strong>24 à 48 h ouvrées</strong>.</p>
    `,
    footerNote: `Une question ? Répondez simplement à cet email, nous vous lirons.`,
  });

  const text = [
    `${greeting}${args.userFullName ? "," : ""}`,
    "",
    `Votre demande d'accès à Datavocat a bien été enregistrée le ${dateStr}.`,
    "",
    "Datavocat est réservé à une liste fermée de cabinets partenaires. Un administrateur va examiner votre demande manuellement.",
    `Vous recevrez un email dès que votre compte sera validé — généralement sous 24 à 48 h ouvrées.`,
    "",
    `Une question ? Écrivez-nous à ${CONTACT_EMAIL}.`,
    "",
    "— L'équipe Datavocat",
  ].join("\n");

  return {
    subject: "Votre demande d'accès à Datavocat a bien été reçue",
    html,
    text,
  };
}

// ───────────────────────────────────────────────────────────────────────────

export interface UserApprovedTpl {
  userFullName: string;
  appUrl: string;
}

/** Email au user : "Votre accès a été validé". */
export function userApproved(args: UserApprovedTpl) {
  const greeting = args.userFullName ? escapeHtml(args.userFullName) : "Bonjour";

  const html = layout({
    preheader: `Votre accès à Datavocat est validé. Connectez-vous et lancez votre première analyse.`,
    eyebrow: "Accès validé",
    title: "Bienvenue sur Datavocat",
    body: `
      <p style="margin:0 0 12px 0;">${greeting}${args.userFullName ? "," : ""}</p>
      <p style="margin:0 0 12px 0;">Votre compte vient d'être validé. Vous avez désormais accès à l'intégralité de la plateforme.</p>
      <p style="margin:0 0 12px 0;">Datavocat croise <strong style="color:${INK};">plus de 562 000 décisions</strong> de Judilibre et data.gouv.fr pour produire, en moins d'une minute, des statistiques, des analyses et des sources vérifiables sur chacun de vos dossiers.</p>
      <div style="margin:18px 0;padding:14px 18px;background:${PAPER};border-radius:6px;border-left:3px solid ${GOLD};">
        <div style="font-family:'Courier News',monospace;font-size:9.5px;letter-spacing:0.2em;text-transform:uppercase;color:${GOLD};margin-bottom:6px;">Pour commencer</div>
        <div style="font-size:13.5px;line-height:1.6;color:${INK};">Connectez-vous, décrivez une affaire dans l'éditeur et laissez l'IA faire la recherche pour vous.</div>
      </div>
    `,
    ctaLabel: "Accéder à Datavocat",
    ctaHref: `${args.appUrl}/login`,
    ctaVariant: "ink",
    footerNote: `Si vous avez la moindre question ou remarque, écrivez-nous à <a href="mailto:${CONTACT_EMAIL}" style="color:${INK};text-decoration:underline;text-decoration-color:${GOLD};">${CONTACT_EMAIL}</a>. Nous lisons chaque message.`,
  });

  const text = [
    `${greeting}${args.userFullName ? "," : ""}`,
    "",
    "Votre compte Datavocat vient d'être validé.",
    `Connectez-vous dès maintenant : ${args.appUrl}/login`,
    "",
    `Une question ? Écrivez-nous à ${CONTACT_EMAIL}.`,
    "",
    "— L'équipe Datavocat",
  ].join("\n");

  return {
    subject: "Votre accès à Datavocat est validé",
    html,
    text,
  };
}

// ───────────────────────────────────────────────────────────────────────────

export interface UserRevokedTpl {
  userFullName: string;
}

/** Email au user : "Votre accès a été révoqué" (ton neutre, pro). */
export function userRevoked(args: UserRevokedTpl) {
  const greeting = args.userFullName ? escapeHtml(args.userFullName) : "Bonjour";

  const html = layout({
    preheader: `Votre accès à Datavocat a été révoqué. Écrivez-nous pour toute question.`,
    eyebrow: "Accès révoqué",
    title: "Votre accès a été suspendu",
    body: `
      <p style="margin:0 0 12px 0;">${greeting}${args.userFullName ? "," : ""}</p>
      <p style="margin:0 0 12px 0;">Nous vous informons que votre accès à Datavocat a été révoqué. Votre compte existe toujours mais n'est plus opérationnel.</p>
      <p style="margin:0 0 12px 0;">Cette décision peut résulter d'une demande explicite de votre part, de l'inactivité prolongée d'un compte d'essai, ou d'un ajustement des cabinets partenaires.</p>
      <p style="margin:0;">Pour toute question ou contestation, répondez directement à cet email ou écrivez à <a href="mailto:${CONTACT_EMAIL}" style="color:${INK};text-decoration:underline;text-decoration-color:${GOLD};">${CONTACT_EMAIL}</a>.</p>
    `,
    footerNote: `Vos données personnelles restent protégées. Pour demander leur suppression définitive, contactez-nous à cette adresse.`,
  });

  const text = [
    `${greeting}${args.userFullName ? "," : ""}`,
    "",
    "Votre accès à Datavocat a été révoqué. Votre compte existe toujours mais n'est plus opérationnel.",
    "",
    `Pour toute question, répondez à cet email ou écrivez à ${CONTACT_EMAIL}.`,
    "",
    "— L'équipe Datavocat",
  ].join("\n");

  return {
    subject: "Votre accès à Datavocat a été révoqué",
    html,
    text,
  };
}

// ───────────────────────────────────────────────────────────────────────────

export interface AdminSignupTpl {
  userFullName: string;
  userEmail: string;
  cabinetName: string;
  createdAt: string | Date;
  adminApprovalsUrl: string;
}

/** Email à l'admin : nouvelle demande d'inscription. */
export function adminNewSignup(args: AdminSignupTpl) {
  const dateStr = fmtDateFr(args.createdAt);

  const html = layout({
    preheader: `${args.userFullName || args.userEmail} demande l'accès à Datavocat — validez ou refusez depuis votre tableau.`,
    eyebrow: "Nouvelle demande",
    title: `${args.userFullName || "Un utilisateur"} demande l'accès`,
    body: `
      <p style="margin:0 0 12px 0;"><strong style="color:${INK};">${escapeHtml(args.userFullName || args.userEmail)}</strong> vient de demander un accès à Datavocat.</p>
      ${metaTable([
        { label: "Nom", value: args.userFullName || "—" },
        { label: "Cabinet", value: args.cabinetName || "—" },
        { label: "Email", value: args.userEmail, mono: true },
        { label: "Demande", value: dateStr },
      ])}
      <p style="margin:14px 0 0 0;color:${MUTED};">Tant que vous n'avez pas validé, l'utilisateur voit une page d'attente et n'accède à aucune fonctionnalité.</p>
    `,
    ctaLabel: "Ouvrir le tableau d'administration",
    ctaHref: args.adminApprovalsUrl,
    ctaVariant: "ink",
    footerNote: `Répondez à cet email pour joindre directement l'utilisateur (le reply-to pointe vers ${escapeHtml(args.userEmail)}).`,
  });

  const text = [
    "Nouvelle demande d'accès Datavocat",
    "",
    `Nom : ${args.userFullName || "—"}`,
    `Cabinet : ${args.cabinetName || "—"}`,
    `Email : ${args.userEmail}`,
    `Date : ${dateStr}`,
    "",
    `Tableau admin : ${args.adminApprovalsUrl}`,
  ].join("\n");

  return {
    subject: `[Datavocat] Nouvelle demande — ${args.userFullName || args.userEmail}`,
    html,
    text,
  };
}

// ───────────────────────────────────────────────────────────────────────────

export interface UserFeedbackReceivedTpl {
  userFullName: string;
  category: string;
  message: string;
}

/** Email au user : accusé de réception après envoi d'un feedback. */
export function userFeedbackReceived(args: UserFeedbackReceivedTpl) {
  const greeting = args.userFullName ? escapeHtml(args.userFullName) : "Bonjour";

  const html = layout({
    preheader: `Nous avons bien reçu votre ${args.category.toLowerCase()} — merci pour votre retour.`,
    eyebrow: `Message reçu · ${args.category}`,
    title: "Merci pour votre retour",
    body: `
      <p style="margin:0 0 12px 0;">${greeting}${args.userFullName ? "," : ""}</p>
      <p style="margin:0 0 12px 0;">Nous avons bien reçu votre message et l'équipe Datavocat va le lire attentivement.</p>
      <p style="margin:0 0 12px 0;">Chaque retour d'utilisateur nous aide à faire évoluer l'outil dans la bonne direction.</p>
      ${quoteBlock(`Votre ${args.category.toLowerCase()}`, args.message)}
      <p style="margin:16px 0 0 0;color:${MUTED};">Si votre message nécessite une réponse de notre part, nous vous recontacterons dans les jours qui viennent.</p>
    `,
    footerNote: `Datavocat évolue grâce à ses utilisateurs. Écrivez-nous à tout moment à <a href="mailto:${CONTACT_EMAIL}" style="color:${INK};text-decoration:underline;text-decoration-color:${GOLD};">${CONTACT_EMAIL}</a>.`,
  });

  const text = [
    `${greeting}${args.userFullName ? "," : ""}`,
    "",
    `Nous avons bien reçu votre ${args.category.toLowerCase()}.`,
    "",
    "Votre message :",
    args.message,
    "",
    "— L'équipe Datavocat",
  ].join("\n");

  return {
    subject: "Nous avons bien reçu votre message",
    html,
    text,
  };
}

// ───────────────────────────────────────────────────────────────────────────

export interface AdminFeedbackTpl {
  userFullName: string;
  userEmail: string;
  cabinetName: string;
  category: string;
  message: string;
  sentAt: string | Date;
}

/** Email à l'admin : feedback d'un utilisateur. */
export function adminFeedback(args: AdminFeedbackTpl) {
  const dateStr = fmtDateFr(args.sentAt);
  const authorLine = args.cabinetName
    ? `${args.userFullName || args.userEmail} · ${args.cabinetName}`
    : args.userFullName || args.userEmail;

  const html = layout({
    preheader: `${args.category} — ${args.message.slice(0, 100)}${args.message.length > 100 ? "…" : ""}`,
    eyebrow: `Feedback · ${args.category}`,
    title: `Message de ${args.userFullName || args.userEmail}`,
    body: `
      ${metaTable([
        { label: "Auteur", value: authorLine },
        { label: "Email", value: args.userEmail, mono: true },
        { label: "Catégorie", value: args.category },
        { label: "Date", value: dateStr },
      ])}
      ${quoteBlock("Message", args.message)}
    `,
    footerNote: `Répondez directement à cet email pour joindre l'utilisateur (reply-to configuré).`,
  });

  const text = [
    `[${args.category}]`,
    `De : ${args.userFullName} <${args.userEmail}>${args.cabinetName ? ` · ${args.cabinetName}` : ""}`,
    `Date : ${dateStr}`,
    "",
    args.message,
  ].join("\n");

  return {
    subject: `[Datavocat] Feedback — ${args.category} (${args.userFullName || args.userEmail})`,
    html,
    text,
  };
}
