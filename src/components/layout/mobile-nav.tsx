"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, History } from "lucide-react";

const navItems = [
  { label: "Nouvelle analyse", href: "/", icon: Sparkles },
  { label: "Historique", href: "/historique", icon: History },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="px-3 space-y-0.5 pt-3">
      <div
        className="px-3 pb-2 font-mono text-[9px] uppercase tracking-[0.22em]"
        style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
      >
        § Espace de travail
      </div>
      {navItems.map((it) => {
        const isActive =
          pathname === it.href ||
          (it.href !== "/" && pathname.startsWith(it.href));
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className="group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-all"
            style={{
              background: isActive ? "var(--sidebar-accent)" : "transparent",
              color: isActive ? "var(--ink)" : "var(--muted-foreground)",
            }}
          >
            {isActive && (
              <div
                className="absolute left-0 w-[2px] h-5 rounded-r"
                style={{ background: "var(--gold)" }}
              />
            )}
            <span
              className="flex w-6 h-6 items-center justify-center"
              style={{ color: isActive ? "var(--gold)" : "var(--muted-foreground)" }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="font-medium">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
