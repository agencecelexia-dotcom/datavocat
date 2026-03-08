import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/supabase/auth-helper";
import type { Decision } from "@/types/database";

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const juridiction_type = searchParams.get("juridiction_type");
  const resultat = searchParams.get("resultat");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("decisions")
    .select(
      "id, juridiction, juridiction_type, juridiction_ville, date_decision, numero_rg, resultat, demandeur_type, status, extraction_confidence, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Scope to user's cabinet
  if (auth.cabinetId) {
    query = query.eq("cabinet_id", auth.cabinetId);
  } else {
    query = query.eq("uploaded_by", auth.userId);
  }

  if (status) query = query.eq("status", status as Decision["status"]);
  if (juridiction_type) query = query.eq("juridiction_type", juridiction_type);
  if (resultat) query = query.eq("resultat", resultat);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    decisions: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("decisions")
    .insert({
      ...body,
      uploaded_by: auth.userId,
      cabinet_id: auth.cabinetId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
