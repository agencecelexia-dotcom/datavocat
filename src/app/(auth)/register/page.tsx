"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Loader2, User, Building2, Mail, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cabinetName, setCabinetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          cabinet_name: cabinetName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setLoading(false);
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="animate-fade-in-up text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Inscription envoyée
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Un email de confirmation a été envoyé à <strong className="text-foreground">{email}</strong>. Vérifiez votre boîte de réception pour activer votre compte.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1e3a5f] transition-colors hover:text-[#c9a96e] cursor-pointer"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          Retour à la connexion
        </Link>
      </div>
    );
  }

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
          Creer un compte
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Commencez à analyser la jurisprudence en quelques minutes
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Nom complet
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                id="fullName"
                type="text"
                placeholder="Me Jean Dupont"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11 pl-10 transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/15"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cabinetName" className="text-sm font-medium">
              Cabinet
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                id="cabinetName"
                type="text"
                placeholder="Dupont & Associés"
                value={cabinetName}
                onChange={(e) => setCabinetName(e.target.value)}
                required
                className="h-11 pl-10 transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/15"
              />
            </div>
          </div>
        </div>

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
              className="h-11 pl-10 transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/15"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Mot de passe
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              id="password"
              type="password"
              placeholder="Minimum 6 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="h-11 pl-10 transition-all duration-200 focus:ring-2 focus:ring-[#1e3a5f]/15"
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
              Créer mon compte
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          En créant un compte, vous acceptez nos{" "}
          <Link href="/cgu" className="underline underline-offset-2 hover:text-foreground transition-colors">conditions d&apos;utilisation</Link>{" "}
          et notre{" "}
          <Link href="/confidentialite" className="underline underline-offset-2 hover:text-foreground transition-colors">politique de confidentialité</Link>.
        </p>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#1e3a5f] underline-offset-4 transition-colors hover:text-[#c9a96e] hover:underline cursor-pointer"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
