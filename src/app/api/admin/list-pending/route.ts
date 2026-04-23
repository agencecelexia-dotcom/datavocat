import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/email/send";

/**
 * GET /api/admin/list-pending
 * Retourne la liste de tous les utilisateurs (pending + approved), tri antichronologique.
 * Accessible uniquement aux emails ADMIN_EMAILS.
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

  // listUsers est paginé ; on agrège jusqu'à 500 pour un tableau admin basique.
  const users: Array<{
    id: string;
    email: string | null;
    fullName: string;
    cabinetName: string;
    createdAt: string;
    lastSignIn: string | null;
    approved: boolean;
    approvedAt: string | null;
    approvedBy: string | null;
  }> = [];

  let page = 1;
  const perPage = 200;
  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!data.users.length) break;
    for (const u of data.users) {
      const m = u.user_metadata || {};
      users.push({
        id: u.id,
        email: u.email || null,
        fullName: (m.full_name as string | undefined) || "",
        cabinetName: (m.cabinet_name as string | undefined) || "",
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at || null,
        approved: m.approved === true,
        approvedAt: (m.approved_at as string | undefined) || null,
        approvedBy: (m.approved_by as string | undefined) || null,
      });
    }
    if (data.users.length < perPage) break;
    page++;
  }

  users.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  return new Response(JSON.stringify({ users }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
