"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { scheduleTour } from "@/hooks/use-product-tour";
import { Loader2, User, Building2, Mail, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cabinetName, setCabinetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          approved: false,
        },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Notifie l'admin (best-effort — on bloque pas la redirection si l'email échoue)
    try {
      await fetch("/api/admin/notify-signup", { method: "POST" });
    } catch {
      // silent
    }
    // Active le tour pour quand le user sera validé
    scheduleTour();
    // Redirige vers la page d'attente (le middleware la laisse passer)
    router.push("/pending-approval");
    router.refresh();
  };

  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--line)",
    background: "var(--card)",
    color: "var(--ink)",
  };

  return (
    <div className="animate-fade-in-up">
      {/* Eyebrow */}
      <div
        className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
        style={{ color: "var(--gold)" }}
      >
        § Inscription
      </div>

      <h1 className="font-serif text-[40px] font-medium tracking-tight leading-[1.05]">
        Créer un <span className="dv-italic">compte.</span>
      </h1>
      <p
        className="mt-3 text-[14px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        L&apos;accès est soumis à validation manuelle. Vous recevrez un email
        dès que votre compte sera activé.
      </p>

      <form onSubmit={handleRegister} className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="fullName"
              className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2 block"
              style={{ color: "var(--muted-foreground)" }}
            >
              Nom complet
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
              />
              <input
                id="fullName"
                type="text"
                placeholder="Me Jean Dupont"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full h-11 pl-9 pr-3 text-[13px] rounded-md outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="cabinetName"
              className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2 block"
              style={{ color: "var(--muted-foreground)" }}
            >
              Cabinet
            </label>
            <div className="relative">
              <Building2
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
              />
              <input
                id="cabinetName"
                type="text"
                placeholder="Dupont & Associés"
                value={cabinetName}
                onChange={(e) => setCabinetName(e.target.value)}
                required
                className="w-full h-11 pl-9 pr-3 text-[13px] rounded-md outline-none"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2 block"
            style={{ color: "var(--muted-foreground)" }}
          >
            Email professionnel
          </label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              id="email"
              type="email"
              placeholder="avocat@cabinet.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-11 pl-9 pr-3 text-[13px] rounded-md outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2 block"
            style={{ color: "var(--muted-foreground)" }}
          >
            Mot de passe
          </label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              id="password"
              type="password"
              placeholder="Minimum 6 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full h-11 pl-9 pr-3 text-[13px] rounded-md outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div
            className="rounded-md px-4 py-3 text-[13px]"
            style={{
              border: "1px solid color-mix(in srgb, var(--bordeaux, #9b2226) 30%, transparent)",
              background: "color-mix(in srgb, var(--bordeaux, #9b2226) 8%, transparent)",
              color: "var(--bordeaux, #9b2226)",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white rounded-md cursor-pointer disabled:opacity-40"
          style={{ background: "var(--ink)" }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Créer mon compte
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>

        <p
          className="text-center text-[11.5px] leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          En créant un compte, vous acceptez nos{" "}
          <Link
            href="/cgu"
            className="underline underline-offset-2 transition-colors"
            style={{ color: "var(--ink)", textDecorationColor: "var(--gold)" }}
          >
            conditions d&apos;utilisation
          </Link>{" "}
          et notre{" "}
          <Link
            href="/confidentialite"
            className="underline underline-offset-2 transition-colors"
            style={{ color: "var(--ink)", textDecorationColor: "var(--gold)" }}
          >
            politique de confidentialité
          </Link>
          .
        </p>
      </form>

      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1" style={{ background: "var(--line)" }} />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          ou
        </span>
        <div className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      <p
        className="text-center text-[13px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-semibold underline underline-offset-4 transition-colors cursor-pointer"
          style={{
            color: "var(--ink)",
            textDecorationColor: "var(--gold)",
          }}
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
