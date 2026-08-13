/**
 * Cron — santé hebdomadaire de l'API Judilibre / juridiction CPH.
 *
 * Le décret 2024-1252 du 31 décembre 2024 ouvre l'open data des décisions
 * de prud'hommes. La mise à disposition côté Judilibre est progressive
 * et n'est PAS encore effective au 2 mai 2026 (HTTP 400 sur jurisdiction=cph).
 *
 * Ce cron tourne chaque dimanche, ping l'API et envoie un email à Thomas
 * dès qu'au moins une décision CPH est exposée. Une fois la notification
 * reçue, on peut désactiver le cron (supprimer la ligne dans vercel.json)
 * et activer CPH dans `detectTargetJurisdiction()` côté `client.ts`.
 *
 * Cron schedule : "0 9 * * 0" = chaque dimanche à 9h00 UTC (≈ 11h Paris l'été).
 */

import { sendEmail } from "@/lib/email/send";

const NOTIFY_TO = "thomasaubigeon@gmail.com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Sécurité : seul Vercel Cron (avec CRON_SECRET) doit pouvoir déclencher.
  // Fail-safe fermé : sans CRON_SECRET configuré, on refuse. La version
  // précédente (`if (expected && ...)`) sautait tout le contrôle quand la
  // variable était absente, rendant la route publique par défaut.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/check-cph] CRON_SECRET non configuré — requête refusée.");
    return new Response("Unauthorized", { status: 401 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const keyId = process.env.PISTE_KEY_ID;
  if (!keyId) {
    return Response.json({ status: "skipped", reason: "no_piste_key" });
  }

  const url =
    "https://api.piste.gouv.fr/cassation/judilibre/v1.0/search?query=licenciement&jurisdiction%5B%5D=cph&page_size=1";

  let httpStatus: number;
  let total = 0;
  try {
    const res = await fetch(url, {
      headers: { KeyId: keyId, accept: "application/json" },
    });
    httpStatus = res.status;
    if (res.ok) {
      const data = (await res.json()) as { total?: number };
      total = data.total || 0;
    }
  } catch (err) {
    console.error("[check-cph] fetch error:", err);
    return Response.json({ status: "error", error: String(err) });
  }

  // CPH non encore branché : on log et on s'arrête.
  if (httpStatus === 400) {
    console.log("[check-cph] CPH toujours HTTP 400 — pas branché");
    return Response.json({ status: "not_yet", httpStatus });
  }

  // CPH branché ET au moins une décision : on notifie Thomas.
  if (httpStatus === 200 && total > 0) {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0b1220;">
        <div style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: #b88a3e; margin-bottom: 12px;">
          § Datavocat · Alerte source
        </div>
        <h1 style="font-family: Georgia, serif; font-size: 22px; line-height: 1.3; font-weight: 500; margin: 0 0 16px;">
          L'API Judilibre vient d'ouvrir les <em>décisions de prud'hommes</em>.
        </h1>
        <p style="font-size: 14px; line-height: 1.6; color: #1a1a2e; margin: 0 0 16px;">
          Le ping hebdomadaire de ce dimanche a remonté <strong>${total}</strong> décision${total > 1 ? "s" : ""} CPH sur la requête « licenciement ».
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #1a1a2e; margin: 0 0 16px;">
          C'est l'application effective du <strong>décret 2024-1252 du 31 décembre 2024</strong>.
          Tu peux maintenant :
        </p>
        <ol style="font-size: 14px; line-height: 1.7; padding-left: 20px; margin: 0 0 20px;">
          <li>Activer <code style="background: #f6f4ef; padding: 1px 5px; border-radius: 3px;">cph</code> dans <code style="background: #f6f4ef; padding: 1px 5px; border-radius: 3px;">detectTargetJurisdiction()</code> de <code style="background: #f6f4ef; padding: 1px 5px; border-radius: 3px;">src/lib/judilibre/client.ts</code> (matter <em>social</em> et <em>civil</em>).</li>
          <li>Retirer la mention « CPH non branché » du bandeau Hiérarchie dans <code style="background: #f6f4ef; padding: 1px 5px; border-radius: 3px;">dashboard.tsx</code>.</li>
          <li>Désactiver ce cron en supprimant l'entrée <code style="background: #f6f4ef; padding: 1px 5px; border-radius: 3px;">/api/cron/check-cph</code> de <code style="background: #f6f4ef; padding: 1px 5px; border-radius: 3px;">vercel.json</code>.</li>
        </ol>
        <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #d8d4c6;">
          — Datavocat · cron <em>check-cph</em>
        </p>
      </div>
    `.trim();

    const result = await sendEmail({
      to: NOTIFY_TO,
      subject: "Datavocat — L'API CPH (prud'hommes) est ouverte sur Judilibre",
      html,
      text: `L'API Judilibre vient d'ouvrir les décisions de CPH. ${total} décisions remontées sur la requête licenciement. Tu peux activer cph dans detectTargetJurisdiction et désactiver ce cron.`,
    });

    console.log("[check-cph] CPH OUVERT — notif envoyée:", result);
    return Response.json({
      status: "live",
      httpStatus,
      total,
      emailSent: result.ok,
    });
  }

  // CPH branché techniquement mais 0 décision : encore en cours d'alimentation.
  console.log(`[check-cph] HTTP ${httpStatus} total=${total} — branché mais vide`);
  return Response.json({ status: "empty", httpStatus, total });
}
