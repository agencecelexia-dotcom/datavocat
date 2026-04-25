export default function RapportPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[780px] px-4 sm:px-6 lg:px-10 py-12 sm:py-20">
        <div className="flex items-center gap-3 mb-6">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: "var(--gold)" }}
          >
            § Rapport stratégique
          </span>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>
        <h1 className="font-serif text-[28px] sm:text-[36px] lg:text-[40px] font-medium tracking-tight">
          Rapport <span className="dv-italic">stratégique.</span>
        </h1>
        <p
          className="mt-4 text-[14px] leading-relaxed max-w-[520px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Les rapports sont générés depuis la page « Nouvelle analyse ». Une fois l&apos;analyse terminée, le rapport complet apparaîtra ici avec statistiques, observations et sources vérifiables.
        </p>
      </div>
    </div>
  );
}
