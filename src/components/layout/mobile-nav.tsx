"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Scale, History, FileText, Briefcase, BarChart3, GitCompareArrows, ScrollText, Eye } from "lucide-react";

const navItems = [
  { label: "Nouvelle analyse", href: "/", icon: Scale },
  { label: "Historique", href: "/historique", icon: History },
  { label: "Decisions", href: "/decisions", icon: FileText },
  { label: "Mon Affaire", href: "/mon-affaire", icon: Briefcase },
  { label: "Statistiques", href: "/statistiques", icon: BarChart3 },
  { label: "Comparateur", href: "/comparateur", icon: GitCompareArrows },
  { label: "Conclusions", href: "/conclusions", icon: ScrollText },
  { label: "Veille juridique", href: "/veille", icon: Eye },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
