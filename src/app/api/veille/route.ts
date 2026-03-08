import { NextRequest } from "next/server";
import { searchJudilibre } from "@/lib/judilibre/client";
import { getAuthContext } from "@/lib/supabase/auth-helper";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return Response.json({ error: "Non authentifié" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const query = sp.get("query");
  if (!query) return Response.json({ error: "query requis" }, { status: 400 });

  try {
    const result = await searchJudilibre({
      query,
      chamber: sp.get("chamber") ? [sp.get("chamber")!] : undefined,
      dateStart: sp.get("dateStart") || undefined,
      dateEnd: sp.get("dateEnd") || undefined,
      solution: sp.get("solution") ? [sp.get("solution")!] : undefined,
      sort: (sp.get("sort") as "score" | "date") || "score",
      order: "desc",
      pageSize: 20,
      batch: sp.get("batch") || undefined,
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
