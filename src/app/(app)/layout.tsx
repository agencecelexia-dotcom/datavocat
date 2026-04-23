import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/command-palette";
import { ProductTour } from "@/components/product-tour";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/email/send";

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
  const isAdmin = isAdminEmail(userEmail);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <CommandPalette />
      <ProductTour />
      <FeedbackButton />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userEmail} userName={userName} isAdmin={isAdmin} />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
