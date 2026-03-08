"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Scale, LogOut } from "lucide-react";
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
    <header className="flex h-16 items-center justify-between border-b border-border/60 bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-16 items-center gap-3 border-b border-border/60 px-6">
              <Scale className="h-6 w-6 text-gold" />
              <span className="font-serif text-xl">Datavocat</span>
            </div>
            <MobileNav />
          </SheetContent>
        </Sheet>
        <h1 className="font-serif text-lg lg:hidden">Datavocat</h1>
      </div>

      <div className="flex items-center gap-3">
        {isDemo && (
          <Badge
            variant="secondary"
            className="border-gold/30 bg-gold/10 text-gold"
          >
            Mode Demo
          </Badge>
        )}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted"
          >
            <Avatar className="h-8 w-8 border border-border/60">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm md:inline">
              {userName || userEmail || "Demo"}
            </span>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-card py-1 shadow-lg">
                {userEmail && (
                  <div className="border-b border-border px-4 py-2">
                    <p className="text-sm font-medium">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
