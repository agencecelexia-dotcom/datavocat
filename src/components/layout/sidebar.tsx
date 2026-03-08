"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Scale, History, FileText, Briefcase, BarChart3, GitCompareArrows, ScrollText, Eye } from "lucide-react";

const navItems = [
  {
    label: "Nouvelle analyse",
    href: "/",
    icon: Scale,
  },
  {
    label: "Historique",
    href: "/historique",
    icon: History,
  },
  {
    label: "Decisions",
    href: "/decisions",
    icon: FileText,
  },
  {
    label: "Mon Affaire",
    href: "/mon-affaire",
    icon: Briefcase,
  },
  {
    label: "Statistiques",
    href: "/statistiques",
    icon: BarChart3,
  },
  {
    label: "Comparateur",
    href: "/comparateur",
    icon: GitCompareArrows,
  },
  {
    label: "Conclusions",
    href: "/conclusions",
    icon: ScrollText,
  },
  {
    label: "Veille juridique",
    href: "/veille",
    icon: Eye,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [veilleUnseen, setVeilleUnseen] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem("datavocat_veille_unseen");
    const count = raw ? parseInt(raw, 10) : 0;
    setVeilleUnseen(isNaN(count) ? 0 : count);
  }, []);

  // Reset counter when navigating to veille page
  useEffect(() => {
    if (pathname === "/veille" || pathname.startsWith("/veille/")) {
      setVeilleUnseen(0);
      localStorage.setItem("datavocat_veille_unseen", "0");
    }
  }, [pathname]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <Scale className="h-6 w-6 text-gold" />
        <span className="font-serif text-xl text-sidebar-foreground">
          Datavocat
        </span>
      </div>
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const showBadge = item.href === "/veille" && veilleUnseen > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-gold"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <span className="relative">
                <item.icon className="h-4 w-4" />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#9b2226] text-[8px] font-bold leading-none text-white">
                    {veilleUnseen > 9 ? "9+" : veilleUnseen}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-sidebar-border px-6 py-3">
        <p className="flex items-center gap-2 text-xs text-sidebar-foreground/40">
          <kbd className="rounded border border-sidebar-foreground/20 bg-sidebar-accent/50 px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
          <span>Palette de commandes</span>
        </p>
      </div>
    </aside>
  );
}
