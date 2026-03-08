import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/supabase/auth-helper";

function getQStashClient() {
  const { Client } = require("@upstash/qstash") as typeof import("@upstash/qstash");
  return new Client({ token: process.env.QSTASH_TOKEN! });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const body = await request.json();
  const { decision_id, pdf_path } = body;

  if (!decision_id || !pdf_path) {
    return NextResponse.json(
      { error: "decision_id et pdf_path requis" },
      { status: 400 }
    );
  }

  // Verify decision exists and belongs to user's cabinet
  let decisionQuery = supabase
    .from("decisions")
    .select("id, status, cabinet_id")
    .eq("id", decision_id);

  if (auth.cabinetId) {
    decisionQuery = decisionQuery.eq("cabinet_id", auth.cabinetId);
  } else {
    decisionQuery = decisionQuery.eq("uploaded_by", auth.userId);
  }

  const { data: decision, error: fetchError } = await decisionQuery.single();

  if (fetchError || !decision) {
    return NextResponse.json(
      { error: "Décision non trouvée" },
      { status: 404 }
    );
  }

  if (decision.status !== "pending") {
    return NextResponse.json(
      { error: "Cette décision est déjà en cours de traitement" },
      { status: 409 }
    );
  }

  // Enqueue extraction via QStash (or call directly in dev)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (process.env.QSTASH_TOKEN) {
    const qstash = getQStashClient();
    await qstash.publishJSON({
    url: `${appUrl}/api/extract/process`,
    body: {
      decision_id,
      pdf_path,
    },
      retries: 2,
    });
  } else {
    // In dev without QStash, call the process endpoint directly
    fetch(`${appUrl}/api/extract/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision_id, pdf_path }),
    }).catch(console.error);
  }

  // Update status to show it's queued
  await supabase
    .from("decisions")
    .update({ status: "extracting" })
    .eq("id", decision_id);

  return NextResponse.json({
    status: "queued",
    decision_id,
  });
}
