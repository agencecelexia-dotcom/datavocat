import Link from "next/link";
import {
  Scale,
  Shield,
  Gavel,
  Search,
  BarChart3,
  Target,
  FileText,
  Database,
} from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding + marketing */}
      <div className="relative hidden w-[520px] shrink-0 overflow-y-auto lg:flex lg:flex-col xl:w-[580px]">
        {/* Deep navy gradient background */}
        <div className="absolute inset-0 gradient-navy" />
        <div className="noise absolute inset-0" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#c9a96e]/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#1e3a5f]/30 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col justify-between p-8 xl:p-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a96e]/15 backdrop-blur-sm">
              <Scale className="h-5 w-5 text-[#c9a96e]" />
            </div>
            <span className="font-serif text-2xl tracking-tight text-white">
              Datavocat
            </span>
          </div>

          {/* Slogan + value prop */}
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-3xl leading-tight text-white xl:text-[2.5rem] xl:leading-[1.15]">
                Plaidez avec
                <span className="block text-[#c9a96e]">
                  la force des donnees.
                </span>
              </h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400">
                Analysez 500 000+ decisions de justice en quelques secondes.
                Obtenez statistiques, tendances et recommandations strategiques
                pour chaque dossier.
              </p>
            </div>

            {/* 4 etapes — compact */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Search, label: "Recherche intelligente" },
                { icon: BarChart3, label: "Statistiques en temps reel" },
                { icon: Target, label: "Recommandations IA" },
                { icon: FileText, label: "Export PDF & DOCX" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg bg-white/[0.05] px-3.5 py-2.5 backdrop-blur-sm"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-[#c9a96e]" />
                  <span className="text-[13px] font-medium text-slate-300">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              Judilibre + data.gouv.fr
            </span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              Conforme RGPD
            </span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="flex items-center gap-1.5">
              <Gavel className="h-3 w-3" />
              Heberge en France
            </span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        {/* Mobile logo + mini marketing */}
        <div className="px-6 pt-6 lg:hidden">
          <div className="flex items-center gap-2.5">
            <Scale className="h-6 w-6 text-[#1e3a5f]" />
            <span className="font-serif text-xl text-[#1e3a5f]">
              Datavocat
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            L&apos;intelligence jurimetrique au service de votre strategie.
            Analysez 500 000+ decisions en quelques secondes.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-border/40 px-6 py-4 text-xs text-muted-foreground sm:gap-6">
          <span>Datavocat &copy; 2026</span>
          <span className="hidden h-3 w-px bg-border sm:block" />
          <Link
            href="/cgu"
            className="transition-colors hover:text-foreground"
          >
            Conditions d&apos;utilisation
          </Link>
          <span className="hidden h-3 w-px bg-border sm:block" />
          <Link
            href="/confidentialite"
            className="transition-colors hover:text-foreground"
          >
            Politique de confidentialite
          </Link>
        </div>
      </div>
    </div>
  );
}
