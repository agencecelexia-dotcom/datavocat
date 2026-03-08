"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Scale,
  History,
  FileText,
  Briefcase,
  BarChart3,
  GitCompareArrows,
  ScrollText,
  Eye,
  Users,
  Sparkles,
  Command,
} from "lucide-react";

const navItems = [
  {
    label: "Nouvelle analyse",
    href: "/",
    icon: Scale,
    accent: true,
  },
  {
    label: "Historique",
    href: "/historique",
    icon: History,
  },
  {
    label: "Décisions",
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
  {
    label: "Clients",
    href: "/clients",
    icon: Users,
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

  useEffect(() => {
    if (pathname === "/veille" || pathname.startsWith("/veille/")) {
      setVeilleUnseen(0);
      localStorage.setItem("datavocat_veille_unseen", "0");
    }
  }, [pathname]);

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col bg-[#0c1929] lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c9a96e]/10">
          <Scale className="h-4 w-4 text-[#c9a96e]" />
        </div>
        <span className="font-serif text-lg tracking-tight text-white">
          Datavocat
        </span>
        <span className="ml-auto rounded-md bg-[#c9a96e]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#c9a96e]">
          Pro
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/[0.06]" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item, i) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const showBadge = item.href === "/veille" && veilleUnseen > 0;

          return (
            <div key={item.href}>
              {/* Section divider before Statistiques */}
              {i === 4 && (
                <div className="mx-2 my-3 h-px bg-white/[0.04]" />
              )}
              <Link
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium cursor-pointer transition-all duration-200",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#c9a96e]" />
                )}

                <span className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200",
                  isActive
                    ? "bg-[#c9a96e]/15 text-[#c9a96e]"
                    : "text-slate-500 group-hover:text-slate-300",
                  item.accent && !isActive && "text-[#c9a96e]/70"
                )}>
                  {item.accent && !isActive ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <item.icon className="h-4 w-4" />
                  )}
                </span>

                <span>{item.label}</span>

                {showBadge && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/90 px-1.5 text-[10px] font-bold text-white">
                    {veilleUnseen > 9 ? "9+" : veilleUnseen}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="space-y-3 px-4 pb-5">
        {/* Shortcut hint */}
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2.5">
          <Command className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs text-slate-500">Palette de commandes</span>
          <kbd className="ml-auto rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            Ctrl K
          </kbd>
        </div>

        {/* Branding */}
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600">
          <span>Analyse Jurimétrique</span>
          <span className="h-2.5 w-px bg-slate-700/50" />
          <span>v1.0</span>
        </div>
      </div>
    </aside>
  );
}
