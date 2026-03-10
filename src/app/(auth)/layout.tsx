import Link from "next/link";
import {
  Scale,
  Shield,
  BarChart3,
  Brain,
  Gavel,
  Search,
  Target,
  FileText,
  CheckCircle2,
  Users,
  Building2,
  Briefcase,
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

        <div className="relative z-10 flex flex-col gap-8 p-8 xl:p-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a96e]/15 backdrop-blur-sm">
              <Scale className="h-5 w-5 text-[#c9a96e]" />
            </div>
            <span className="font-serif text-2xl tracking-tight text-white">
              Datavocat
            </span>
          </div>

          {/* Hero */}
          <div>
            <h2 className="font-serif text-3xl leading-tight text-white xl:text-4xl">
              La jurisprudence
              <span className="block text-[#c9a96e]">
                au service de votre strategie
              </span>
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Les avocats passent des heures a rechercher manuellement la
              jurisprudence. Datavocat automatise l&apos;analyse de{" "}
              <span className="font-medium text-slate-300">
                500 000+ decisions
              </span>{" "}
              en quelques secondes, pour donner a chaque avocat un avantage
              strategique base sur la data.
            </p>
          </div>

          {/* Pour qui */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#c9a96e]">
              Pour qui
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Briefcase, label: "Avocats independants" },
                { icon: Building2, label: "Cabinets d'avocats" },
                { icon: Users, label: "Juristes d'entreprise" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-3 text-center backdrop-blur-sm"
                >
                  <item.icon className="h-4 w-4 text-[#c9a96e]" />
                  <span className="text-[11px] leading-tight text-slate-400">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4 etapes */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#c9a96e]">
              Comment ca fonctionne
            </h3>
            <div className="space-y-2">
              {[
                {
                  icon: Search,
                  title: "Requete intelligente",
                  desc: "Datavocat interroge Judilibre (Cass. + CA) et data.gouv.fr automatiquement",
                },
                {
                  icon: BarChart3,
                  title: "Analyse & statistiques",
                  desc: "L'IA analyse les tendances, taux de succes, arguments recurrents",
                },
                {
                  icon: Target,
                  title: "Recommandations strategiques",
                  desc: "Recommandations personnalisees pour renforcer vos arguments",
                },
                {
                  icon: FileText,
                  title: "Rapport exportable",
                  desc: "PDF ou DOCX structure, pret a integrer dans votre dossier",
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#c9a96e]/15 text-xs font-bold text-[#c9a96e]">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Benefices */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#c9a96e]">
              Ce que ca vous apporte
            </h3>
            <div className="space-y-2">
              {[
                {
                  label: "Plus de credibilite",
                  desc: "Appuyez chaque argument sur des donnees jurisprudentielles reelles",
                },
                {
                  label: "Meilleure strategie",
                  desc: "Anticipez les positions des juges grace aux tendances statistiques",
                },
                {
                  label: "Meilleurs resultats",
                  desc: "Augmentez vos chances de succes avec une preparation data-driven",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social proof */}
          <div className="space-y-4">
            <div className="space-y-3">
              <blockquote className="border-l-2 border-[#c9a96e]/40 pl-4">
                <p className="text-sm italic leading-relaxed text-slate-400">
                  &laquo; Datavocat m&apos;a permis de trouver en 30 secondes
                  ce que je cherchais pendant 3 heures. &raquo;
                </p>
                <footer className="mt-1.5 text-xs text-slate-500">
                  Me Damien R. — Avocat en droit social, Paris
                </footer>
              </blockquote>
              <blockquote className="border-l-2 border-[#c9a96e]/40 pl-4">
                <p className="text-sm italic leading-relaxed text-slate-400">
                  &laquo; Les donnees jurimetriques nous permettent de
                  conseiller nos clients avec une precision inegalee. &raquo;
                </p>
                <footer className="mt-1.5 text-xs text-slate-500">
                  Me Sophie L. — Avocate en droit commercial, Lyon
                </footer>
              </blockquote>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Database className="h-3 w-3" />
                Donnees Judilibre + data.gouv.fr
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
