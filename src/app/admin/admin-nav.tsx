"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Accueil", match: (p: string) => p === "/admin" },
  { href: "/admin/approvals", label: "Validations", match: (p: string) => p.startsWith("/admin/approvals") },
  { href: "/admin/costs", label: "Coûts API", match: (p: string) => p.startsWith("/admin/costs") },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto max-w-[1100px] px-6 lg:px-10">
      <div className="flex items-center gap-1" style={{ marginBottom: "-1px" }}>
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="px-3 py-2.5 text-[12.5px] transition-all"
              style={{
                color: active ? "var(--ink)" : "var(--muted-foreground)",
                fontWeight: active ? 500 : 400,
                borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
