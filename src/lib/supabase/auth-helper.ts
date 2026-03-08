import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get the authenticated user and their cabinet_id from the current request.
 * Returns null if not authenticated.
 */
export async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get cabinet_id from profile
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("cabinet_id")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    cabinetId: profile?.cabinet_id as string | null,
  };
}
