#!/usr/bin/env node
// Test d'envoi email Resend avec tous les templates Datavocat.
//
// Usage :
//   node scripts/test-email.mjs <email-destinataire> [--template=all|signup|approved|revoked|feedback-user|feedback-admin|new-signup]
//
// Exemples :
//   node scripts/test-email.mjs contact@datavocat.fr
//   node scripts/test-email.mjs moi@gmail.com --template=approved
//
// Charge les env vars depuis .env.local si présent.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const email = process.argv[2];
const templateArg = process.argv.find((a) => a.startsWith("--template="))?.split("=")[1] || "all";

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/test-email.mjs <email> [--template=all|signup|approved|revoked|feedback-user|feedback-admin|new-signup]");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error("❌ RESEND_API_KEY manquant dans .env.local");
  process.exit(1);
}

const from = process.env.EMAIL_FROM || "Datavocat <no-reply@datavocat.fr>";
console.log(`\n━━━ Test emails Datavocat ━━━`);
console.log(`From  : ${from}`);
console.log(`To    : ${email}`);
console.log(`Template : ${templateArg}\n`);

// Import des templates (on fait au runtime après avoir loadé les env)
// Via tsx ça serait direct, mais on est en .mjs donc on doit importer
// le fichier compilé. Plus simple : réimplémenter les appels directement ici.

// Alternative : rebuild mental des données de test qui alimentent les templates.
// Comme on veut juste valider Resend, on envoie des emails synthétiques.

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datavocat.fr";
const adminApprovalsUrl = `${appUrl}/admin/approvals`;

const TEMPLATES = {
  signup: {
    subject: "[TEST] Votre demande d'accès à Datavocat a bien été reçue",
    html: buildSimpleTemplate({
      eyebrow: "Demande reçue",
      title: "Nous avons bien reçu votre demande",
      body: `<p>Test user,</p><p>Votre demande d'accès à <strong>Datavocat</strong> a bien été enregistrée le ${new Date().toLocaleString("fr-FR")}.</p><p>Un administrateur va examiner votre demande manuellement. Vous recevrez un email dès que votre compte sera validé.</p>`,
      preheader: "Votre demande d'accès à Datavocat a bien été reçue",
      footer: "Une question ? Répondez simplement à cet email.",
    }),
  },
  approved: {
    subject: "[TEST] Votre accès à Datavocat est validé",
    html: buildSimpleTemplate({
      eyebrow: "Accès validé",
      title: "Bienvenue sur Datavocat",
      body: `<p>Test user,</p><p>Votre compte vient d'être validé. Vous avez désormais accès à l'intégralité de la plateforme.</p>`,
      preheader: "Votre accès à Datavocat est validé",
      cta: { label: "Accéder à Datavocat", href: `${appUrl}/login` },
      footer: `Une question ? Écrivez-nous à contact@datavocat.fr.`,
    }),
  },
  revoked: {
    subject: "[TEST] Votre accès à Datavocat a été révoqué",
    html: buildSimpleTemplate({
      eyebrow: "Accès révoqué",
      title: "Votre accès a été suspendu",
      body: `<p>Test user,</p><p>Nous vous informons que votre accès à Datavocat a été révoqué.</p>`,
      preheader: "Votre accès à Datavocat a été révoqué",
      footer: "Pour toute question, répondez directement à cet email.",
    }),
  },
  "feedback-user": {
    subject: "[TEST] Nous avons bien reçu votre message",
    html: buildSimpleTemplate({
      eyebrow: "Message reçu · Suggestion",
      title: "Merci pour votre retour",
      body: `<p>Test user,</p><p>Nous avons bien reçu votre message et l'équipe Datavocat va le lire attentivement.</p>`,
      preheader: "Nous avons bien reçu votre suggestion",
      footer: "Datavocat évolue grâce à ses utilisateurs.",
    }),
  },
  "feedback-admin": {
    subject: "[TEST] [Datavocat] Feedback — Suggestion (Test User)",
    html: buildSimpleTemplate({
      eyebrow: "Feedback · Suggestion",
      title: "Message de Test User",
      body: `<p>De : <strong>Test User</strong> (test@example.com)</p><p style="border-left:2px solid #b88a3e;padding-left:14px;margin:20px 0;">Ce serait génial d'ajouter un export Excel pour le tableau de preuve.</p>`,
      preheader: "Suggestion — Ce serait génial d'ajouter un export Excel...",
      footer: "Répondez directement à cet email pour joindre l'utilisateur.",
    }),
  },
  "new-signup": {
    subject: "[TEST] [Datavocat] Nouvelle demande — Test User",
    html: buildSimpleTemplate({
      eyebrow: "Nouvelle demande",
      title: "Test User demande l'accès",
      body: `<p><strong>Test User</strong> vient de demander l'accès à Datavocat.</p><p>Cabinet : Cabinet Test<br>Email : test@example.com<br>Demande : ${new Date().toLocaleString("fr-FR")}</p>`,
      preheader: "Test User demande l'accès à Datavocat",
      cta: { label: "Ouvrir le tableau d'administration", href: adminApprovalsUrl },
      footer: "Tant que vous n'avez pas validé, l'utilisateur voit une page d'attente.",
    }),
  },
};

// ────────────────────────────────────────────────────────────────────────
// Builder HTML simple (reproduit le style Greffe sans import TS)
// ────────────────────────────────────────────────────────────────────────
function buildSimpleTemplate({ preheader, eyebrow, title, body, cta, footer }) {
  const ctaHtml = cta
    ? `<table cellpadding="0" cellspacing="0" style="margin:28px 0 0 0;"><tr><td style="border-radius:6px;background:#0b1220;"><a href="${cta.href}" style="display:inline-block;padding:13px 24px;color:#fff;text-decoration:none;font-family:Inter,Arial,sans-serif;font-size:13.5px;font-weight:600;">${cta.label}&nbsp;→</a></td></tr></table>`
    : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:Inter,Arial,sans-serif;color:#0b1220;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef;"><tr><td align="center" style="padding:36px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="padding:4px 0 20px 0;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:10px;">
<svg width="32" height="32" viewBox="0 0 32 32" style="display:block;"><rect width="32" height="32" rx="6" fill="#f6f4ef"/><path d="M9 8.5h7.2c4.6 0 7.8 3.1 7.8 7.5s-3.2 7.5-7.8 7.5H9V8.5z" stroke="#0b1220" stroke-width="1.5" fill="none"/><path d="M7 8.5h4M7 23.5h4" stroke="#0b1220" stroke-width="1.5"/><path d="M12.5 16h11" stroke="#c9a96e" stroke-width="1.25"/><circle cx="14" cy="16" r="0.9" fill="#c9a96e"/><circle cx="22" cy="16" r="0.9" fill="#c9a96e"/></svg>
</td><td style="vertical-align:middle;">
<div style="font-family:Georgia,serif;font-size:17px;font-weight:500;color:#0b1220;line-height:1;">Datavocat</div>
<div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:#6b6658;margin-top:3px;">Jurimétrie</div>
</td></tr></table></td></tr>
<tr><td style="background:#fff;border:1px solid #e5e2d9;border-radius:10px;padding:40px 44px;">
<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#b88a3e;margin-bottom:14px;">§ ${eyebrow}</div>
<h1 style="margin:0 0 18px 0;font-family:Georgia,serif;font-size:28px;font-weight:500;line-height:1.1;letter-spacing:-0.015em;color:#0b1220;">${title}</h1>
<div style="font-size:14.5px;line-height:1.65;color:#0b1220;">${body}</div>
${ctaHtml}
${footer ? `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #ecebe3;font-size:12.5px;line-height:1.6;color:#6b6658;">${footer}</div>` : ""}
</td></tr>
<tr><td style="padding:20px 16px 4px 16px;text-align:center;">
<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#6b6658;">
Datavocat · © 2026 · <a href="mailto:contact@datavocat.fr" style="color:#6b6658;text-decoration:none;">contact@datavocat.fr</a>
</div></td></tr>
</table></td></tr></table>
</body></html>`;
}

// ────────────────────────────────────────────────────────────────────────
// Envoi
// ────────────────────────────────────────────────────────────────────────
async function sendOne(templateKey) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) {
    console.error(`❌ Template inconnu : ${templateKey}`);
    return;
  }
  console.log(`→ ${templateKey.padEnd(18)} ${tpl.subject.slice(0, 60)}...`);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: tpl.subject,
      html: tpl.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`  ❌ ${res.status} — ${body}`);
    return false;
  }
  const data = await res.json();
  console.log(`  ✓ ${data.id}`);
  return true;
}

const toSend = templateArg === "all" ? Object.keys(TEMPLATES) : [templateArg];
let ok = 0;
for (const key of toSend) {
  if (await sendOne(key)) ok++;
  await new Promise((r) => setTimeout(r, 300)); // petite pause anti rate-limit
}

console.log(`\n${ok === toSend.length ? "✅" : "⚠️"}  ${ok}/${toSend.length} emails envoyés.\n`);
