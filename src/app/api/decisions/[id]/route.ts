import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/supabase/auth-helper";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("decisions")
    .select("*")
    .eq("id", id);

  // Scope to user's cabinet or user
  if (auth.cabinetId) {
    query = query.eq("cabinet_id", auth.cabinetId);
  } else {
    query = query.eq("uploaded_by", auth.userId);
  }

  const { data, error } = await query.single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();

  if (body.status === "validated") {
    body.validated_by = auth.userId;
    body.validated_at = new Date().toISOString();
  }

  let query = supabase
    .from("decisions")
    .update(body)
    .eq("id", id);

  if (auth.cabinetId) {
    query = query.eq("cabinet_id", auth.cabinetId);
  } else {
    query = query.eq("uploaded_by", auth.userId);
  }

  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("decisions")
    .delete()
    .eq("id", id);

  if (auth.cabinetId) {
    query = query.eq("cabinet_id", auth.cabinetId);
  } else {
    query = query.eq("uploaded_by", auth.userId);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
