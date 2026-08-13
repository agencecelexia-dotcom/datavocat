"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkles, History } from "lucide-react";
import { LogoWordmark } from "@/components/brand/logo";

const navItems = [
  { label: "Nouvelle analyse", href: "/", icon: Sparkles },
  { label: "Historique", href: "/historique", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      data-tour="sidebar"
      className="hidden w-[240px] shrink-0 flex-col lg:flex"
      style={{
        background: "var(--sidebar)",
        borderRight: "1px solid var(--sidebar-border)",
        color: "var(--sidebar-foreground)",
      }}
    >
      {/* Logo + wordmark */}
      <div className="px-5 pt-6 pb-5">
        <LogoWordmark tone="light" />
      </div>

      <div className="mx-5 h-px" style={{ background: "var(--line)" }} />

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 pt-3">
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
              {...(it.href === "/historique" ? { "data-tour": "nav-historique" } : {})}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-all"
              )}
              style={{
                background: isActive ? "var(--sidebar-accent)" : "transparent",
                color: isActive
                  ? "var(--sidebar-accent-foreground)"
                  : "var(--muted-foreground)",
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
                style={{
                  color: isActive ? "var(--gold)" : "var(--muted-foreground)",
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 pb-5 space-y-3">
        {/* Jurisprudence counter */}
        <div
          className="px-3 py-3 rounded-md"
          style={{
            border: "1px solid var(--line)",
            background: "var(--card)",
          }}
        >
          <div
            className="font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Sources interrogées
          </div>
          {/* Le compteur « 562 487 » qui figurait ici était une constante
              écrite en dur — l'addition des ordres de grandeur annoncés par
              les API, présentée à l'unité près. Idem pour la pastille
              « synchronisé », qui ne reflétait aucun état réel. Sur un produit
              dont l'argument est de ne rien inventer, ces deux éléments étaient
              indéfendables. On nomme les sources, sans chiffre invérifiable. */}
          <div
            className="mt-1.5 text-[11px] leading-relaxed"
            style={{ color: "var(--ink)" }}
          >
            Judilibre · Légifrance · data.gouv.fr
          </div>
          <div
            className="text-[10px] mt-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            Interrogées en direct à chaque analyse
          </div>
        </div>

        <div
          className="flex items-center justify-between text-[10px] font-mono"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span>v2.0 · 2026</span>
        </div>
      </div>
    </aside>
  );
}
