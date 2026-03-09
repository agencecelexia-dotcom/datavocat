import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/command-palette";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userEmail = user?.email ?? null;
  const userName =
    user?.user_metadata?.full_name ?? user?.email ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <CommandPalette />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userEmail} userName={userName} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-2 sm:p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
