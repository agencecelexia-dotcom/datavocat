import Link from "next/link";
import { Scale, Shield, BarChart3, Brain, Gavel } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding + social proof */}
      <div className="relative hidden w-[480px] shrink-0 overflow-hidden lg:flex lg:flex-col xl:w-[540px]">
        {/* Deep navy gradient background */}
        <div className="absolute inset-0 gradient-navy" />
        {/* Subtle pattern overlay */}
        <div className="noise absolute inset-0" />
        {/* Radial glow accent */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#c9a96e]/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#1e3a5f]/30 blur-3xl" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a96e]/15 backdrop-blur-sm">
              <Scale className="h-5 w-5 text-[#c9a96e]" />
            </div>
            <span className="font-serif text-2xl tracking-tight text-white">
              Datavocat
            </span>
          </div>

          {/* Hero text */}
          <div className="space-y-6">
            <h2 className="font-serif text-3xl leading-tight text-white xl:text-4xl">
              L&apos;intelligence jurimetrique
              <span className="block text-[#c9a96e]">au service du droit</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              Analysez la jurisprudence, anticipez les issues contentieuses et renforcez vos stratégies grâce à l&apos;IA.
            </p>

            {/* Feature pills */}
            <div className="flex flex-col gap-3 pt-2">
              {[
                { icon: Brain, text: "Analyse IA de 500 000+ décisions" },
                { icon: BarChart3, text: "Statistiques jurimétriques temps réel" },
                { icon: Shield, text: "Données chiffrées et sécurisées" },
                { icon: Gavel, text: "Sources Judilibre + data.gouv.fr" },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-4 py-2.5 backdrop-blur-sm"
                >
                  <feature.icon className="h-4 w-4 shrink-0 text-[#c9a96e]" />
                  <span className="text-sm text-slate-300">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Social proof */}
          <div className="space-y-4">
            <blockquote className="border-l-2 border-[#c9a96e]/40 pl-4">
              <p className="text-sm italic leading-relaxed text-slate-400">
                &laquo; Datavocat a transformé notre approche contentieuse. Les données jurimétriques nous permettent de conseiller nos clients avec une précision inégalée. &raquo;
              </p>
              <footer className="mt-2 text-xs text-slate-500">
                Me Sophie Laurent — Avocate en droit social, Paris
              </footer>
            </blockquote>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <span>Conforme RGPD</span>
              <span className="h-3 w-px bg-slate-700" />
              <span>Hébergé en France</span>
              <span className="h-3 w-px bg-slate-700" />
              <span>Données chiffrées</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        {/* Mobile logo */}
        <div className="flex items-center gap-2.5 px-6 pt-6 lg:hidden">
          <Scale className="h-6 w-6 text-[#1e3a5f]" />
          <span className="font-serif text-xl text-[#1e3a5f]">Datavocat</span>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-6 border-t border-border/40 px-6 py-4 text-xs text-muted-foreground">
          <span>Datavocat &copy; 2026</span>
          <span className="h-3 w-px bg-border" />
          <Link href="/cgu" className="hover:text-foreground transition-colors">Conditions d&apos;utilisation</Link>
          <span className="h-3 w-px bg-border" />
          <Link href="/confidentialite" className="hover:text-foreground transition-colors">Politique de confidentialité</Link>
        </div>
      </div>
    </div>
  );
}
