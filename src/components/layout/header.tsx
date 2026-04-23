"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, ChevronDown, Settings, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./mobile-nav";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/brand/logo";

interface HeaderProps {
  userEmail?: string | null;
  userName?: string | null;
  isAdmin?: boolean;
}

function pathToBreadcrumb(pathname: string): { section: string; current: string } {
  if (pathname.startsWith("/historique")) {
    return { section: "Espace de travail", current: "Historique" };
  }
  if (pathname.startsWith("/parametres")) {
    return { section: "Compte", current: "Paramètres" };
  }
  if (pathname.startsWith("/rapport")) {
    return { section: "Rapports", current: "Rapport" };
  }
  return { section: "Espace de travail", current: "Nouvelle analyse" };
}

export function Header({ userEmail, userName, isAdmin }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (dropdownOpen && !dropdownRef.current?.contains(target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const isDemo = !userEmail;
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "DM";

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const { section, current } = pathToBreadcrumb(pathname);

  return (
    <header
      className="h-14 flex items-center justify-between px-5 lg:px-8"
      style={{
        borderBottom: "1px solid var(--line)",
        background: "var(--bg)",
      }}
    >
      {/* Left: mobile menu + logo OR breadcrumb on desktop */}
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden cursor-pointer h-9 w-9 transition-all duration-200 hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[260px] p-0 sm:w-[280px]"
            style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)" }}
          >
            <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
              <LogoMark size={26} tone="light" />
              <div>
                <div
                  className="font-serif text-[15px] font-medium leading-none"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  Datavocat
                </div>
                <div
                  className="font-mono text-[9px] uppercase tracking-[0.22em] mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Jurimétrie
                </div>
              </div>
            </div>
            <MobileNav />
          </SheetContent>
        </Sheet>

        {/* Mobile: logo inline */}
        <div className="lg:hidden flex items-center gap-2">
          <LogoMark size={26} tone="light" />
          <div
            className="font-serif text-[15px] font-medium"
            style={{ letterSpacing: "-0.01em" }}
          >
            Datavocat
          </div>
        </div>

        {/* Desktop: breadcrumb */}
        <div
          className="hidden lg:flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span>§ 1</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span>{section}</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: "var(--ink)" }}>{current}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isDemo && (
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{
              border: "1px solid color-mix(in srgb, var(--gold) 30%, transparent)",
              background: "color-mix(in srgb, var(--gold) 10%, transparent)",
              color: "var(--gold)",
            }}
          >
            Démo
          </span>
        )}

        {/* User pill */}
        <div className="relative" ref={dropdownRef} data-tour="user-menu">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="hidden md:flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors hover:bg-[color:var(--paper)]"
            style={{ border: "1px solid var(--line)" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-bold text-white"
              style={{ background: "var(--navy)" }}
            >
              {initials}
            </div>
            <span
              className="text-[12px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              {userName || userEmail?.split("@")[0] || "Me. Dupuis"}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              style={{ color: "var(--muted-foreground)" }}
            />
          </button>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-[color:var(--paper)]"
            style={{ border: "1px solid var(--line)" }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-bold text-white"
              style={{ background: "var(--navy)" }}
            >
              {initials}
            </div>
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md"
              style={{
                background: "var(--card)",
                border: "1px solid var(--line)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
              }}
            >
              {userEmail && (
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {userName || userEmail.split("@")[0]}
                  </p>
                  <p
                    className="text-xs font-mono truncate"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {userEmail}
                  </p>
                </div>
              )}
              <div className="p-1.5">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      router.push("/admin");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] cursor-pointer transition-colors hover:bg-[color:var(--paper)]"
                    style={{ color: "var(--gold)", fontWeight: 600 }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Administration</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    router.push("/parametres");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] cursor-pointer transition-colors hover:bg-[color:var(--paper)]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Paramètres</span>
                </button>
                {userEmail && (
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] cursor-pointer transition-colors"
                    style={{ color: "var(--bordeaux)" }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Déconnexion</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
