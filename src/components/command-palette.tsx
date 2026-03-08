"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  History,
  FileText,
  BarChart3,
  GitCompareArrows,
  Users,
  Upload,
  Download,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "navigation" | "actions";
  keywords?: string[];
}

const items: CommandItem[] = [
  // Navigation
  { id: "nav-home", label: "Nouvelle analyse", href: "/", icon: Scale, group: "navigation", keywords: ["accueil", "home", "nouvelle", "analyse"] },
  { id: "nav-historique", label: "Historique", href: "/historique", icon: History, group: "navigation", keywords: ["historique", "history", "analyses"] },
  { id: "nav-decisions", label: "Decisions", href: "/decisions", icon: FileText, group: "navigation", keywords: ["decisions", "jurisprudence", "arrets"] },
  { id: "nav-statistiques", label: "Statistiques", href: "/statistiques", icon: BarChart3, group: "navigation", keywords: ["statistiques", "stats", "graphiques", "charts"] },
  { id: "nav-comparateur", label: "Comparateur", href: "/comparateur", icon: GitCompareArrows, group: "navigation", keywords: ["comparateur", "comparer", "compare"] },
  { id: "nav-clients", label: "Clients", href: "/clients", icon: Users, group: "navigation", keywords: ["clients", "cabinet"] },
  // Quick actions
  { id: "act-upload", label: "Uploader un PDF", href: "/decisions/upload", icon: Upload, group: "actions", keywords: ["upload", "pdf", "fichier", "importer"] },
  { id: "act-import", label: "Importer depuis data.gouv", href: "/decisions/import", icon: Download, group: "actions", keywords: ["import", "datagouv", "data.gouv", "open data"] },
];

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  // Simple substring match first
  if (lowerText.includes(lowerQuery)) return true;
  // Character-by-character fuzzy match
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) => {
      const searchable = [item.label, ...(item.keywords ?? [])].join(" ");
      return fuzzyMatch(searchable, query);
    });
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      // Small delay to ensure the DOM is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) navigate(item.href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (!open) return null;

  const navItems = filtered.filter((i) => i.group === "navigation");
  const actionItems = filtered.filter((i) => i.group === "actions");

  // Build a flat list to track global index across groups
  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-[#1e3a5f]/20 bg-white shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-[#1e3a5f]/40" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une page ou action..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 sm:inline-block">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-500">
              Aucun resultat pour &quot;{query}&quot;
            </p>
          )}

          {navItems.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Navigation
              </p>
              {navItems.map((item) => {
                const idx = globalIndex++;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-selected={idx === selectedIndex}
                    onClick={() => navigate(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      idx === selectedIndex
                        ? "bg-[#1e3a5f] text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        idx === selectedIndex
                          ? "text-[#c9a96e]"
                          : "text-[#c9a96e]/70"
                      )}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {actionItems.length > 0 && (
            <div className={navItems.length > 0 ? "mt-2" : ""}>
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Actions rapides
              </p>
              {actionItems.map((item) => {
                const idx = globalIndex++;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-selected={idx === selectedIndex}
                    onClick={() => navigate(item.href)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      idx === selectedIndex
                        ? "bg-[#1e3a5f] text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        idx === selectedIndex
                          ? "text-[#c9a96e]"
                          : "text-[#c9a96e]/70"
                      )}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-gray-200 px-4 py-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5">
              &uarr;&darr;
            </kbd>
            naviguer
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5">
              &crarr;
            </kbd>
            ouvrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5">
              esc
            </kbd>
            fermer
          </span>
        </div>
      </div>
    </div>
  );
}
