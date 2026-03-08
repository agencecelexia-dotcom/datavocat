"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, Scale, LogOut, Moon, Sun, ChevronDown, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./mobile-nav";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  userEmail?: string | null;
  userName?: string | null;
}

export function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("datavocat_theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else if (stored === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("datavocat_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("datavocat_theme", "light");
    }
  }, [isDark]);

  const isDemo = !userEmail;

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "DM";

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger>
            <Button variant="ghost" size="icon" className="lg:hidden cursor-pointer h-9 w-9 transition-all duration-200 hover:bg-accent">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] border-r border-border/40 bg-[#0c1929] p-0">
            <div className="flex h-16 items-center gap-3 px-6">
              <Scale className="h-5 w-5 text-[#c9a96e]" />
              <span className="font-serif text-lg text-white">Datavocat</span>
            </div>
            <MobileNav />
          </SheetContent>
        </Sheet>
        <h1 className="font-serif text-lg lg:hidden text-foreground">Datavocat</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground cursor-pointer transition-all duration-200 hover:bg-accent hover:text-foreground"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {isDemo && (
          <span className="rounded-full border border-[#c9a96e]/20 bg-[#c9a96e]/5 px-2.5 py-1 text-[11px] font-semibold text-[#c9a96e]">
            Demo
          </span>
        )}

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-all duration-200 hover:bg-accent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e3a5f] text-xs font-bold text-white">
              {initials}
            </div>
            <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground md:inline">
              {userName || userEmail || "Demo"}
            </span>
            <ChevronDown className={`hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 md:inline ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl shadow-black/5 animate-fade-in-up" style={{ animationDuration: "0.15s" }}>
                {userEmail && (
                  <div className="border-b border-border/40 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                )}
                <div className="p-1.5">
                  <button
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-pointer transition-all duration-200 hover:bg-accent hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Parametres
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-pointer transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="h-4 w-4" />
                    Deconnexion
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
