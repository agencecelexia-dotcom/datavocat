import Link from "next/link";
import { ShieldCheck, Coins, ArrowRight } from "lucide-react";

const SECTIONS = [
  {
    href: "/admin/approvals",
    icon: ShieldCheck,
    label: "Validation des comptes",
    desc: "Valider ou révoquer l'accès des utilisateurs inscrits.",
    eyebrow: "Utilisateurs",
  },
  {
    href: "/admin/costs",
    icon: Coins,
    label: "Coûts API Claude",
    desc: "Consommation Anthropic mois en cours, top utilisateurs, évolution 30 jours.",
    eyebrow: "Finance",
  },
];

export default function AdminHomePage() {
  return (
    <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
      <div className="flex items-center gap-3 mb-6">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.25em]"
          style={{ color: "var(--gold)" }}
        >
          § Administration
        </span>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      <h1 className="font-serif text-[36px] font-medium tracking-tight mb-3">
        Tableau <span className="dv-italic">d&apos;administration.</span>
      </h1>
      <p className="text-[14px] mb-10" style={{ color: "var(--muted-foreground)" }}>
        Outils de pilotage réservés à l&apos;équipe Datavocat.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group p-6 rounded-md transition-all"
              style={{
                border: "1px solid var(--line)",
                background: "var(--card)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div
                    className="font-mono text-[9.5px] uppercase tracking-[0.22em] mb-2"
                    style={{ color: "var(--gold)" }}
                  >
                    § {s.eyebrow}
                  </div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <Icon className="h-4 w-4" style={{ color: "var(--ink)" }} />
                    <h2
                      className="font-serif text-[19px] font-medium tracking-tight"
                      style={{ color: "var(--ink)" }}
                    >
                      {s.label}
                    </h2>
                  </div>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                    {s.desc}
                  </p>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 mt-1 transition-transform group-hover:translate-x-1"
                  style={{ color: "var(--muted-foreground)" }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
