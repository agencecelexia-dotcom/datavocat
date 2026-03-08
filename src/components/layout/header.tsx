"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Scale, LogOut, Moon, Sun } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./mobile-nav";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  userEmail?: string | null;
  userName?: string | null;
}

export function Header({ userEmail, userName }: HeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

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
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger>
            <Button variant="ghost" size="icon" className="lg:hidden cursor-pointer transition-all duration-200 hover:bg-[#1e3a5f]/5">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
              <Scale className="h-6 w-6 text-[#1e3a5f]" />
              <span className="font-serif text-xl text-[#c9a96e]">Datavocat</span>
            </div>
            <MobileNav />
          </SheetContent>
        </Sheet>
        <h1 className="font-serif text-lg lg:hidden text-[#0f172a]">Datavocat</h1>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
          className="text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200 hover:bg-[#1e3a5f]/5"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        {isDemo && (
          <Badge
            variant="secondary"
            className="border-[#c9a96e]/30 bg-[#c9a96e]/10 text-[#c9a96e]"
          >
            Mode Demo
          </Badge>
        )}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer transition-all duration-200 hover:bg-[#1e3a5f]/5"
          >
            <Avatar className="h-8 w-8 border border-gray-200">
              <AvatarFallback className="bg-[#1e3a5f]/10 text-xs text-[#1e3a5f]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm text-[#0f172a] md:inline">
              {userName || userEmail || "Demo"}
            </span>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-gray-200 bg-card py-1 shadow-lg">
                {userEmail && (
                  <div className="border-b border-gray-200 px-4 py-2">
                    <p className="text-sm font-medium text-[#0f172a]">{userName}</p>
                    <p className="text-xs text-[#0f172a]/60">{userEmail}</p>
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#0f172a]/60 cursor-pointer transition-all duration-200 hover:bg-[#1e3a5f]/5 hover:text-[#0f172a]"
                >
                  <LogOut className="h-4 w-4" />
                  Deconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
