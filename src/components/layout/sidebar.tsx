"use client";

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

  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
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
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
