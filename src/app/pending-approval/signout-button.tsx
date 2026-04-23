"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };
  return (
    <button
      onClick={handleSignOut}
      className="font-mono text-[10.5px] uppercase tracking-[0.15em] cursor-pointer"
      style={{ color: "var(--muted-foreground)" }}
    >
      Se déconnecter
    </button>
  );
}
