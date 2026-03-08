import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DEMO_USER } from "@/lib/demo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={DEMO_USER.email}
          userName={DEMO_USER.full_name}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
