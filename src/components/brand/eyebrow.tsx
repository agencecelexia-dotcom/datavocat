/**
 * Eyebrow — label mono uppercase petit avec marqueur § optionnel.
 *
 * Utilisé en tête de hero, de card, de section.
 * Exemples : "§ NOUVELLE ANALYSE", "§ RAPPORT D'ANALYSE", "§ HISTORIQUE"
 */
export function Eyebrow({
  children,
  marker = "§",
  className = "",
  tone = "muted",
}: {
  children: React.ReactNode;
  marker?: string | null;
  className?: string;
  tone?: "muted" | "gold" | "ink";
}) {
  const color =
    tone === "gold"
      ? "var(--gold)"
      : tone === "ink"
        ? "var(--ink)"
        : "var(--muted-foreground)";
  return (
    <div
      className={`font-mono text-[10px] uppercase tracking-[0.22em] inline-flex items-center gap-2 ${className}`}
      style={{ color }}
    >
      {marker && <span style={{ color: "var(--gold)" }}>{marker}</span>}
      <span>{children}</span>
    </div>
  );
}

/**
 * Rule — filet gold suivi d'un label (typique en-tête de section hors-flow).
 * Exemple : "——  § RAPPORT D'ANALYSE  ——"
 */
export function RuleLabel({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${align === "center" ? "justify-center" : ""} ${className}`}
    >
      {align === "center" && <span className="h-px flex-1 bg-[color:var(--line)]" />}
      <Eyebrow tone="gold" marker={null}>
        {children}
      </Eyebrow>
      <span className="h-px flex-1 bg-[color:var(--line)]" />
    </div>
  );
}
