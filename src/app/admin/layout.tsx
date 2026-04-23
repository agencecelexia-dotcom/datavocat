import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/email/send";
import { LogoMark } from "@/components/brand/logo";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark size={24} tone="light" />
              <span
                className="font-serif text-[16px] font-medium"
                style={{ letterSpacing: "-0.01em" }}
              >
                Datavocat
              </span>
            </Link>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.22em] ml-2 px-2 py-0.5 rounded"
              style={{
                border: "1px solid var(--gold)",
                color: "var(--gold)",
              }}
            >
              Admin
            </span>
          </div>
          <Link
            href="/"
            className="font-mono text-[10.5px] uppercase tracking-[0.15em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            ← Retour app
          </Link>
        </div>
        <AdminNav />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
