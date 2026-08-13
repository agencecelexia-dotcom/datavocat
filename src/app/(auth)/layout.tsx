import Link from "next/link";
import { Shield, Gavel, Search, BarChart3, Target, FileText, Database } from "lucide-react";
import { LogoMark, LogoWordmark } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Left panel — branding + marketing (style dark éditorial) */}
      <div
        className="relative hidden w-[520px] shrink-0 overflow-y-auto lg:flex lg:flex-col xl:w-[580px]"
        style={{ background: "#0b1220" }}
      >
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} tone="dark" />
            <div>
              <div
                className="font-serif text-[18px] font-medium leading-none text-white"
                style={{ letterSpacing: "-0.01em" }}
              >
                Datavocat
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] mt-1 text-white/50">
                Jurisprudence
              </div>
            </div>
          </div>

          {/* Slogan + value prop */}
          <div className="space-y-8">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] mb-4 text-[#c9a96e]">
                § Jurisprudence · Judilibre &amp; Légifrance
              </div>
              <h2 className="font-serif text-[44px] leading-[1.05] font-medium text-white">
                Plaidez avec la{" "}
                <span
                  className="italic"
                  style={{
                    fontFamily: "var(--font-display), 'Instrument Serif', Georgia, serif",
                    color: "#c9a96e",
                    fontWeight: 400,
                  }}
                >
                  force des données.
                </span>
              </h2>
              <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-white/60">
                Analysez la jurisprudence en quelques secondes. Statistiques, tendances et points d&apos;attention stratégiques pour chaque dossier.
              </p>
            </div>

            {/* 4 étapes — éditorial, filets au lieu de cards */}
            <div className="space-y-3">
              {[
                { icon: Search, label: "Recherche intelligente", detail: "Judilibre, Légifrance & data.gouv.fr" },
                { icon: BarChart3, label: "Statistiques vérifiables", detail: "Calculées sur le corpus, jamais estimées" },
                { icon: Target, label: "Points d'attention stratégiques", detail: "Fondés sur la jurisprudence réelle" },
                { icon: FileText, label: "Export multi-format", detail: "PDF, DOCX, Excel" },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2"
                    style={{
                      borderBottom:
                        i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[#c9a96e]" />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-white/90">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-white/50 mt-0.5">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-3 text-[10.5px] font-mono uppercase tracking-[0.15em] text-white/40">
            <span className="flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              Judilibre + data.gouv.fr
            </span>
            <span className="h-3 w-px bg-white/20" />
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" />
              Conforme RGPD
            </span>
            <span className="h-3 w-px bg-white/20" />
            <span className="flex items-center gap-1.5">
              <Gavel className="h-3 w-3" />
              Hébergé en France
            </span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        {/* Mobile logo */}
        <div className="px-6 pt-6 lg:hidden">
          <LogoWordmark tone="light" />
          <p
            className="mt-3 text-[13px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            L&apos;intelligence jurisprudentielle au service de votre stratégie.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>

        {/* Footer */}
        <div
          className="flex flex-wrap items-center justify-center gap-4 px-6 py-4 text-[11px] font-mono uppercase tracking-[0.12em] sm:gap-6"
          style={{
            borderTop: "1px solid var(--line)",
            color: "var(--muted-foreground)",
          }}
        >
          <span>Datavocat © 2026</span>
          <span className="hidden h-3 w-px sm:block" style={{ background: "var(--line)" }} />
          <Link
            href="/cgu"
            className="transition-colors hover:text-[color:var(--ink)]"
          >
            CGU
          </Link>
          <span className="hidden h-3 w-px sm:block" style={{ background: "var(--line)" }} />
          <Link
            href="/confidentialite"
            className="transition-colors hover:text-[color:var(--ink)]"
          >
            Confidentialité
          </Link>
        </div>
      </div>
    </div>
  );
}
