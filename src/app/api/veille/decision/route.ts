import { NextRequest } from "next/server";
import { getDecision } from "@/lib/judilibre/client";
import { getAuthContext } from "@/lib/supabase/auth-helper";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return Response.json({ error: "Non authentifié" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id requis" }, { status: 400 });
  }

  try {
    const decision = await getDecision(id);
    return Response.json(decision);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
