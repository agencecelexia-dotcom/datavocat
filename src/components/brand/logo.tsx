/**
 * LogoMark — monogram D-balance (bicolor ink + gold)
 *
 * Référence visuelle : la lettre D en sérif dont le stem fait office de
 * poutre de balance, traversée par une barre dorée (plateaux de la
 * balance à chaque extrémité). C'est la signature jurimétrique de la marque.
 */
export function LogoMark({
  size = 28,
  tone = "light",
}: {
  size?: number;
  tone?: "light" | "dark";
}) {
  const bg = tone === "dark" ? "#0b1220" : "#f6f4ef";
  const ink = tone === "dark" ? "#f2ede3" : "#0b1220";
  const gold = "#c9a96e";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Datavocat"
    >
      <rect width="32" height="32" rx="6" fill={bg} />
      {/* Serif D — stem + bowl */}
      <path
        d="M9 8.5h7.2c4.6 0 7.8 3.1 7.8 7.5s-3.2 7.5-7.8 7.5H9V8.5z"
        stroke={ink}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Serifs */}
      <path d="M7 8.5h4M7 23.5h4" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
      {/* Balance beam (gold) */}
      <path d="M12.5 16h11" stroke={gold} strokeWidth="1.25" strokeLinecap="round" />
      {/* Two tiny scale pans */}
      <circle cx="14" cy="16" r="0.9" fill={gold} />
      <circle cx="22" cy="16" r="0.9" fill={gold} />
    </svg>
  );
}

export function LogoWordmark({
  tone = "light",
  sub = true,
  size = 28,
}: {
  tone?: "light" | "dark";
  sub?: boolean;
  size?: number;
}) {
  const ink = tone === "dark" ? "#ffffff" : "var(--ink)";
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} tone={tone} />
      <div>
        <div
          className="font-serif text-[17px] font-medium leading-none tracking-tight"
          style={{ color: ink, letterSpacing: "-0.01em" }}
        >
          Datavocat
        </div>
        {sub && (
          <div
            className="font-mono text-[9px] uppercase tracking-[0.22em] mt-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            Jurimétrie
          </div>
        )}
      </div>
    </div>
  );
}
