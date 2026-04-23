"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
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
        § Connexion
      </div>

      <h1 className="font-serif text-[40px] font-medium tracking-tight leading-[1.05]">
        Bon <span className="dv-italic">retour.</span>
      </h1>
      <p
        className="mt-3 text-[14px]"
        style={{ color: "var(--muted-foreground)" }}
      >
        Connectez-vous à votre espace d&apos;analyse jurimétrique.
      </p>

      <form onSubmit={handleLogin} className="mt-10 space-y-5">
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
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="password"
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Mot de passe
            </label>
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient();
                const emailValue = (document.getElementById("email") as HTMLInputElement)?.value;
                if (!emailValue) {
                  alert("Veuillez d'abord saisir votre adresse email.");
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(emailValue, {
                  redirectTo: `${window.location.origin}/auth/callback`,
                });
                if (error) alert(error.message);
                else alert("Un email de réinitialisation a été envoyé à " + emailValue);
              }}
              className="text-[11px] underline underline-offset-2 cursor-pointer"
              style={{
                color: "var(--gold)",
                textDecorationColor: "var(--line)",
              }}
            >
              Mot de passe oublié ?
            </button>
          </div>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              Se connecter
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
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
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-semibold underline underline-offset-4 transition-colors cursor-pointer"
          style={{
            color: "var(--ink)",
            textDecorationColor: "var(--gold)",
          }}
        >
          Créer un compte gratuitement
        </Link>
      </p>
    </div>
  );
}
