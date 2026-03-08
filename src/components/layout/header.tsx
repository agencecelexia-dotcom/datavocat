"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Scale } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./mobile-nav";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  userEmail?: string;
  userName?: string;
}

export function Header({ userName }: HeaderProps) {
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "DM";

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
        <Badge
          variant="secondary"
          className="border-gold/30 bg-gold/10 text-gold"
        >
          Mode Demo
        </Badge>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 border border-border/60">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm md:inline">{userName}</span>
        </div>
      </div>
    </header>
  );
}
