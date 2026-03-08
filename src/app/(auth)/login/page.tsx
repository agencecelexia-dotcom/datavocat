"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-6 hidden items-center gap-2.5 lg:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]/5">
            <Scale className="h-4.5 w-4.5 text-[#1e3a5f]" />
          </div>
        </div>
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Bon retour
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous a votre espace d&apos;analyse jurimetrique
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email professionnel
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              id="email"
              type="email"
              placeholder="avocat@cabinet.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 pl-10 transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f]/30"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </Label>
            <button
              type="button"
              className="text-xs font-medium text-[#c9a96e] transition-colors hover:text-[#b8944f] cursor-pointer"
            >
              Mot de passe oublie ?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 pl-10 transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f]/30"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#9b2226]">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="h-11 w-full cursor-pointer gap-2 bg-[#1e3a5f] text-sm font-semibold text-white shadow-lg shadow-[#1e3a5f]/20 transition-all duration-300 hover:bg-[#162d4a] hover:shadow-xl hover:shadow-[#1e3a5f]/25 hover:-translate-y-px"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Se connecter
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-semibold text-[#1e3a5f] underline-offset-4 transition-colors hover:text-[#c9a96e] hover:underline cursor-pointer"
        >
          Creer un compte gratuitement
        </Link>
      </p>
    </div>
  );
}
