import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/email/send";

/**
 * GET /api/admin/costs
 * Agrégations de api_usage pour le dashboard admin.
 * Accessible uniquement aux emails dans ADMIN_EMAILS.
 *
 * Retourne :
 *   - totalUsd : somme all-time
 *   - monthUsd : somme mois en cours
 *   - prevMonthUsd : somme mois précédent (pour comparaison)
 *   - byOperation : [{ operation, usd, calls }]
 *   - topUsersMonth : [{ userEmail, usd, calls }]
 *   - daily : [{ date, usd, calls }] sur les 30 derniers jours
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller || !isAdminEmail(caller.email)) {
    return new Response(JSON.stringify({ error: "Accès refusé" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createAdminClient();

  // Range dates
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Total all-time + month + prev-month (un seul select, on agrège côté code)
  const { data: allRows, error } = await admin
    .from("api_usage")
    .select("cost_usd, operation, user_email, created_at, input_tokens, output_tokens")
    .order("created_at", { ascending: false });

  if (error) {
    // Table manquante → retourne un état vide plutôt qu'une erreur
    if (error.code === "42P01" || /relation.*does not exist/i.test(error.message)) {
      return new Response(
        JSON.stringify({
          totalUsd: 0,
          monthUsd: 0,
          prevMonthUsd: 0,
          byOperation: [],
          topUsersMonth: [],
          daily: [],
          totalCalls: 0,
          missingTable: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = allRows || [];
  type Row = {
    cost_usd: number;
    operation: string;
    user_email: string | null;
    created_at: string;
    input_tokens: number;
    output_tokens: number;
  };

  let totalUsd = 0;
  let monthUsd = 0;
  let prevMonthUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const byOpMap = new Map<string, { usd: number; calls: number }>();
  const byUserMap = new Map<string, { usd: number; calls: number }>();
  const dailyMap = new Map<string, { usd: number; calls: number }>();

  for (const r of rows as Row[]) {
    const cost = Number(r.cost_usd) || 0;
    const createdAt = new Date(r.created_at);
    totalUsd += cost;
    totalInputTokens += r.input_tokens || 0;
    totalOutputTokens += r.output_tokens || 0;

    if (createdAt >= monthStart) monthUsd += cost;
    if (createdAt >= prevMonthStart && createdAt <= prevMonthEnd) prevMonthUsd += cost;

    // by operation (all-time)
    const op = byOpMap.get(r.operation) || { usd: 0, calls: 0 };
    op.usd += cost;
    op.calls += 1;
    byOpMap.set(r.operation, op);

    // by user (mois en cours seulement)
    if (createdAt >= monthStart) {
      const key = r.user_email || "(anonyme)";
      const u = byUserMap.get(key) || { usd: 0, calls: 0 };
      u.usd += cost;
      u.calls += 1;
      byUserMap.set(key, u);
    }

    // daily (30 derniers jours)
    if (createdAt >= thirtyDaysAgo) {
      const date = r.created_at.slice(0, 10);
      const d = dailyMap.get(date) || { usd: 0, calls: 0 };
      d.usd += cost;
      d.calls += 1;
      dailyMap.set(date, d);
    }
  }

  const byOperation = Array.from(byOpMap.entries())
    .map(([operation, v]) => ({ operation, ...v }))
    .sort((a, b) => b.usd - a.usd);

  const topUsersMonth = Array.from(byUserMap.entries())
    .map(([userEmail, v]) => ({ userEmail, ...v }))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 10);

  // Remplit les jours manquants à 0
  const daily: Array<{ date: string; usd: number; calls: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const entry = dailyMap.get(key) || { usd: 0, calls: 0 };
    daily.push({ date: key, ...entry });
  }

  return new Response(
    JSON.stringify({
      totalUsd,
      monthUsd,
      prevMonthUsd,
      totalCalls: rows.length,
      totalInputTokens,
      totalOutputTokens,
      byOperation,
      topUsersMonth,
      daily,
      missingTable: false,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
