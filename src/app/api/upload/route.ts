import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/supabase/auth-helper";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const path = formData.get("path") as string;

  if (!file || !path) {
    return NextResponse.json({ error: "file et path requis" }, { status: 400 });
  }

  // Prefix path with user id for isolation
  const scopedPath = `${auth.userId}/${path}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("decisions-pdfs")
    .upload(scopedPath, buffer, {
      contentType: "application/pdf",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path: scopedPath });
}
