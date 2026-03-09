"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ParsedAnalysis } from "@/lib/parse-analysis";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Scale,
  BookOpen,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Banknote,
  Gavel,
  Lightbulb,
  FileText,
  CheckCircle2,
} from "lucide-react";

// ── Palette ──────────────────────────────────────────────────────────
const NAVY = "#1e3a5f";
const GOLD = "#c9a96e";
const EMERALD = "#2d6a4f";
const BORDEAUX = "#9b2226";
const AMBER = "#ca6702";
const NAVY_LIGHT = "#2a4f7f";
const GOLD_LIGHT = "#d4ba8a";

// ── Helpers ──────────────────────────────────────────────────────────
const fmtEur = (v: number | null) =>
  v !== null
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v)
    : "—";

const fmtPct = (v: number | null) => (v !== null ? `${v}%` : "—");

function pctColor(pct: number): string {
  if (pct >= 60) return EMERALD;
  if (pct >= 40) return AMBER;
  return BORDEAUX;
}

function fiabiliteColor(score: number): string {
  if (score >= 80) return EMERALD;
  if (score >= 60) return NAVY;
  if (score >= 40) return AMBER;
  return BORDEAUX;
}

function confianceLabel(c: string | null): string {
  if (c === "élevé") return "Elevee";
  if (c === "moyen") return "Moyenne";
  if (c === "faible") return "Faible";
  return "—";
}

function confianceColor(c: string | null): string {
  if (c === "élevé") return EMERALD;
  if (c === "moyen") return AMBER;
  return BORDEAUX;
}

// ── CSS Keyframes ────────────────────────────────────────────────────
const STYLE_ID = "dv-dashboard-v2";

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes dv-fade-up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes dv-scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes dv-gauge-fill {
      from { stroke-dashoffset: var(--gauge-circumference); }
      to   { stroke-dashoffset: var(--gauge-offset); }
    }
    @keyframes dv-counter {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes dv-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .dv-fade-up {
      opacity: 0;
      animation: dv-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .dv-scale-in {
      opacity: 0;
      animation: dv-scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .dv-d1 { animation-delay: 0.05s; }
    .dv-d2 { animation-delay: 0.1s; }
    .dv-d3 { animation-delay: 0.15s; }
    .dv-d4 { animation-delay: 0.2s; }
    .dv-d5 { animation-delay: 0.25s; }
    .dv-d6 { animation-delay: 0.3s; }
    .dv-d7 { animation-delay: 0.35s; }
    .dv-d8 { animation-delay: 0.4s; }
    .dv-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #e8e5e0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02);
      transition: box-shadow 0.2s ease, transform 0.2s ease;
    }
    .dv-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04);
      transform: translateY(-1px);
    }
    .dv-gauge-track {
      stroke: #f0ede8;
      fill: none;
    }
    .dv-gauge-fill {
      fill: none;
      stroke-linecap: round;
      animation: dv-gauge-fill 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .dv-tooltip-custom {
      background: white !important;
      border: 1px solid #e8e5e0 !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
      padding: 10px 14px !important;
    }
    .dv-range-bar {
      position: relative;
      height: 12px;
      border-radius: 6px;
      background: linear-gradient(90deg, ${BORDEAUX}20, ${AMBER}30, ${EMERALD}20);
    }
    .dv-range-marker {
      position: absolute;
      top: -6px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      transform: translateX(-50%);
    }
    .dv-instance-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${GOLD};
    }
  `;
  document.head.appendChild(style);
}

// ── Animated Counter Hook ────────────────────────────────────────────
function useCounter(target: number | null, duration = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === null || target === 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ── SVG Gauge Component ──────────────────────────────────────────────
function GaugeSVG({
  value,
  size = 220,
  strokeWidth = 14,
  color,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="drop-shadow-sm"
      style={
        {
          "--gauge-circumference": circumference,
          "--gauge-offset": offset,
        } as React.CSSProperties
      }
    >
      {/* Track */}
      <circle
        className="dv-gauge-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      {/* Fill */}
      <circle
        className="dv-gauge-fill"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ── KPI Card Component ───────────────────────────────────────────────
function KPICard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  delay,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
  delay: string;
}) {
  return (
    <div className={`dv-card dv-fade-up ${delay} p-3 sm:p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: color + "12" }}
        >
          <span style={{ color }}><Icon size={20} /></span>
        </div>
      </div>
      <p className="font-mono text-lg font-bold tracking-tight sm:text-2xl" style={{ color }}>
        {value}
      </p>
      <p className="text-xs text-stone-500 mt-1 font-sans sm:text-sm">{label}</p>
      {sublabel && (
        <p className="text-[10px] text-stone-400 mt-0.5 font-sans sm:text-xs">{sublabel}</p>
      )}
    </div>
  );
}

// ── Section Header ───────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  tooltip,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4" title={tooltip}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: NAVY + "10" }}
      >
        <span style={{ color: NAVY }}><Icon size={16} /></span>
      </div>
      <h3 className="font-serif text-lg font-semibold" style={{ color: NAVY }}>
        {title}
      </h3>
    </div>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="dv-tooltip-custom">
      <p className="text-xs font-medium text-stone-600 mb-0.5">{label}</p>
      <p className="text-sm font-mono font-bold" style={{ color: NAVY }}>
        {payload[0].value}%
      </p>
    </div>
  );
}

// ── Horizontal Bar (Custom) ──────────────────────────────────────────
function HorizontalBarRow({
  label,
  value,
  maxValue = 100,
  color,
  delay,
}: {
  label: string;
  value: number;
  maxValue?: number;
  color: string;
  delay: number;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth((value / maxValue) * 100);
    }, 100 + delay * 80);
    return () => clearTimeout(timer);
  }, [value, maxValue, delay]);

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm text-stone-700 font-sans truncate mr-3 max-w-[70%]">
          {label}
        </span>
        <span className="text-sm font-mono font-semibold shrink-0" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
          }}
        />
      </div>
    </div>
  );
}

// ── Extract Article 700 from sections fallback ───────────────────────
function extractArticle700Fallback(data: ParsedAnalysis) {
  if (data.article700) return data.article700;

  // Try to find in sections
  const section = data.sections.find(
    (s) =>
      s.title.toLowerCase().includes("article 700") ||
      s.content.toLowerCase().includes("article 700")
  );
  if (!section) return null;

  const text = section.content;
  const tauxMatch = text.match(
    /(\d{1,3}(?:[.,]\d+)?)\s*%/
  );
  const amounts = [...text.matchAll(/(\d[\d\s.,]*)\s*€/g)].map((m) =>
    parseFloat(m[1].replace(/\s/g, "").replace(",", "."))
  ).filter((v) => !isNaN(v));

  return {
    tauxCondamnation: tauxMatch ? parseFloat(tauxMatch[1].replace(",", ".")) : null,
    montantMoyen: amounts[0] ?? null,
    montantMedian: amounts[1] ?? null,
  };
}

// ── Extract recommendations as bullet points ─────────────────────────
function extractRecommendations(reco: string): string[] {
  if (!reco) return [];
  const lines = reco
    .split(/\n/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 10);
  return lines.slice(0, 4);
}

// ══════════════════════════════════════════════════════════════════════
// ██  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════

export function AnalysisDashboard({ data }: { data: ParsedAnalysis }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectStyles();
  }, []);

  const taux = data.tauxSuccesGlobal ?? 0;
  const animatedTaux = useCounter(data.tauxSuccesGlobal, 1500);
  const animatedSources = useCounter(data.sourceCount, 1000);
  const animatedSample = useCounter(data.echantillon, 1000);
  const animatedFiab = useCounter(data.fiabilite.score, 1200);

  const heroColor = pctColor(taux);
  const args = [...data.arguments].sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0));
  const juris = [...data.juridictions].sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0));
  const art700 = extractArticle700Fallback(data);
  const recommendations = extractRecommendations(data.recommandation);

  // Montant range positions (percentage along bar)
  const montMax = data.montants.max ?? 1;
  const montMinPos = data.montants.min != null ? (data.montants.min / montMax) * 100 : 0;
  const montMedPos = data.montants.median != null ? (data.montants.median / montMax) * 100 : 50;

  return (
    <div ref={containerRef} className="space-y-6 pb-8">
      {/* ── ROW 1: Hero Gauge + KPIs ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Hero Gauge */}
        <div className="dv-card dv-scale-in dv-d1 p-4 flex flex-col items-center justify-center sm:p-8 lg:col-span-1">
          <p className="text-sm font-sans text-stone-400 uppercase tracking-widest mb-4">
            Taux de succes
          </p>
          <div className="relative">
            <GaugeSVG value={taux} size={160} strokeWidth={12} color={heroColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-mono text-3xl font-extrabold tracking-tight sm:text-5xl"
                style={{ color: heroColor }}
              >
                {animatedTaux}
              </span>
              <span
                className="text-base font-mono font-bold -mt-1 sm:text-xl"
                style={{ color: heroColor + "99" }}
              >
                %
              </span>
            </div>
          </div>
          {data.echantillon && (
            <p className="text-sm text-stone-400 font-sans mt-4">
              Sur un echantillon de{" "}
              <span className="font-semibold text-stone-600">
                {data.echantillon}
              </span>{" "}
              decisions
            </p>
          )}
        </div>

        {/* KPI Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-2 sm:gap-4">
          <KPICard
            icon={FileText}
            label="Sources citees"
            value={String(animatedSources)}
            sublabel="References verifiables"
            color={NAVY}
            delay="dv-d2"
          />
          <KPICard
            icon={BookOpen}
            label="Echantillon"
            value={
              data.echantillon != null ? `${animatedSample}` : "—"
            }
            sublabel="Decisions analysees"
            color={GOLD}
            delay="dv-d3"
          />
          <KPICard
            icon={ShieldCheck}
            label="Fiabilite"
            value={`${animatedFiab}/100`}
            sublabel={data.fiabilite.label}
            color={fiabiliteColor(data.fiabilite.score)}
            delay="dv-d4"
          />
          <KPICard
            icon={TrendingUp}
            label="Confiance"
            value={confianceLabel(data.confiance)}
            sublabel="Niveau de confiance"
            color={confianceColor(data.confiance)}
            delay="dv-d5"
          />
        </div>
      </div>

      {/* ── ROW 2: Charts ───────────────────────────────────────── */}
      {(args.length > 0 || juris.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
          {/* Arguments Bar Chart */}
          {args.length > 0 && (
            <div
              className={`dv-card dv-fade-up dv-d4 p-6 ${
                juris.length > 0 ? "lg:col-span-3" : "lg:col-span-5"
              }`}
            >
              <SectionHeader icon={Scale} title="Arguments — Taux de succes" tooltip="Taux de succes par moyen juridique invoque, base sur les decisions analysees. Un taux eleve indique que cet argument est regulierement retenu par les juridictions." />
              <div className="mt-2">
                {args.map((arg, i) => (
                  <HorizontalBarRow
                    key={arg.name}
                    label={arg.name}
                    value={arg.taux ?? 0}
                    color={pctColor(arg.taux ?? 0)}
                    delay={i}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Jurisdictions */}
          {juris.length > 0 && (
            <div
              className={`dv-card dv-fade-up dv-d5 p-6 ${
                args.length > 0 ? "lg:col-span-2" : "lg:col-span-5"
              }`}
            >
              <SectionHeader icon={Gavel} title="Juridictions" />
              <div className="mt-2">
                {juris.map((j, i) => (
                  <HorizontalBarRow
                    key={j.name}
                    label={j.name}
                    value={j.taux ?? 0}
                    color={NAVY_LIGHT}
                    delay={i}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROW 3: Financial + Article 700 + Instances ──────────── */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Montants Range */}
        {(data.montants.min != null ||
          data.montants.median != null ||
          data.montants.max != null) && (
          <div className="dv-card dv-fade-up dv-d5 p-6">
            <SectionHeader icon={Banknote} title="Montants accordes" tooltip="Fourchette des condamnations pecuniaires constatees dans les decisions similaires (minimum, mediane, maximum). A titre indicatif." />
            <div className="space-y-6 mt-4">
              {/* Range visualization */}
              <div className="px-2">
                <div className="dv-range-bar">
                  {data.montants.min != null && (
                    <div
                      className="dv-range-marker"
                      style={{
                        left: `${montMinPos}%`,
                        backgroundColor: BORDEAUX,
                      }}
                    />
                  )}
                  {data.montants.median != null && (
                    <div
                      className="dv-range-marker"
                      style={{
                        left: `${montMedPos}%`,
                        backgroundColor: AMBER,
                      }}
                    />
                  )}
                  {data.montants.max != null && (
                    <div
                      className="dv-range-marker"
                      style={{
                        left: "97%",
                        backgroundColor: EMERALD,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Labels */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-sans">
                    Minimum
                  </p>
                  <p
                    className="font-mono text-sm font-bold mt-1 sm:text-lg"
                    style={{ color: BORDEAUX }}
                  >
                    {fmtEur(data.montants.min)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-sans">
                    Median
                  </p>
                  <p
                    className="font-mono text-sm font-bold mt-1 sm:text-lg"
                    style={{ color: AMBER }}
                  >
                    {fmtEur(data.montants.median)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-sans">
                    Maximum
                  </p>
                  <p
                    className="font-mono text-sm font-bold mt-1 sm:text-lg"
                    style={{ color: EMERALD }}
                  >
                    {fmtEur(data.montants.max)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Article 700 CPC */}
        {art700 && (
          <div className="dv-card dv-fade-up dv-d6 p-6">
            <SectionHeader icon={Gavel} title="Article 700 CPC" tooltip="Statistiques relatives aux frais irrepetibles (article 700 du Code de procedure civile) : taux de condamnation et montants constates dans les affaires similaires." />
            <div className="space-y-5 mt-4">
              {art700.tauxCondamnation != null && (
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-sm text-stone-500 font-sans">
                      Taux de condamnation
                    </span>
                    <span
                      className="font-mono text-base font-bold sm:text-xl"
                      style={{ color: pctColor(art700.tauxCondamnation) }}
                    >
                      {art700.tauxCondamnation}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${art700.tauxCondamnation}%`,
                        backgroundColor: pctColor(art700.tauxCondamnation),
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {art700.montantMoyen != null && (
                  <div className="text-center p-3 rounded-xl bg-stone-50">
                    <p className="text-xs text-stone-400 uppercase tracking-wider font-sans">
                      Montant moyen
                    </p>
                    <p
                      className="font-mono text-sm font-bold mt-1 sm:text-lg"
                      style={{ color: NAVY }}
                    >
                      {fmtEur(art700.montantMoyen)}
                    </p>
                  </div>
                )}
                {art700.montantMedian != null && (
                  <div className="text-center p-3 rounded-xl bg-stone-50">
                    <p className="text-xs text-stone-400 uppercase tracking-wider font-sans">
                      Montant median
                    </p>
                    <p
                      className="font-mono text-sm font-bold mt-1 sm:text-lg"
                      style={{ color: NAVY }}
                    >
                      {fmtEur(art700.montantMedian)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instance Pipeline */}
        {data.instances.length > 0 && (
          <div className="dv-card dv-fade-up dv-d7 p-6">
            <SectionHeader icon={TrendingUp} title="Par instance" tooltip="Taux de decisions favorables ventile par degre de juridiction. Permet d'evaluer les chances de succes selon le stade procedural." />
            <p className="text-xs text-stone-400 font-sans -mt-2 mb-4 italic leading-relaxed">
              Les pourcentages indiquent le taux de decisions favorables a la partie demanderesse sur l&apos;ensemble des decisions analysees pour cette instance.
            </p>
            <div className="flex flex-col gap-3">
              {data.instances.map((inst, i) => {
                const total = inst.total;
                const gagnees = inst.gagnees ?? (total != null && inst.taux != null ? Math.round(total * inst.taux / 100) : null);
                const insuffisant = total != null && total < 10;
                return (
                  <div key={inst.name}>
                    <div
                      className="p-4 rounded-xl"
                      style={{ backgroundColor: NAVY + "08" }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-stone-700 font-sans">
                          {inst.name}
                        </p>
                        <span
                          className="font-mono text-base font-bold sm:text-xl"
                          style={{ color: insuffisant ? AMBER : pctColor(inst.taux ?? 0) }}
                        >
                          {insuffisant ? "—" : inst.taux != null ? `${inst.taux}%` : "—"}
                        </span>
                      </div>
                      {insuffisant ? (
                        <p className="text-xs text-amber-600 font-sans mt-1.5 italic">
                          Donnees insuffisantes pour cette instance
                        </p>
                      ) : inst.taux != null ? (
                        <div className="mt-1.5">
                          <p className="text-xs text-stone-500 font-sans leading-relaxed">
                            {inst.taux}% de succes
                            {total != null && (
                              <span>
                                {" "}— Sur {total} decisions analysees, {inst.taux}% ont ete favorables au demandeur
                                {gagnees != null && (
                                  <span className="text-stone-400"> (soit {gagnees} decisions sur {total})</span>
                                )}
                              </span>
                            )}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {i < data.instances.length - 1 && (
                      <div className="dv-instance-arrow py-1">
                        <ArrowRight size={18} className="rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── ROW 4: Recommendations ──────────────────────────────── */}
      {recommendations.length > 0 && (
        <div className="dv-card dv-fade-up dv-d8 p-6">
          <SectionHeader icon={Lightbulb} title="Recommandations strategiques" tooltip="Preconisations fondees sur l'analyse jurimetrique. Ces recommandations constituent une aide a la reflexion strategique et ne sauraient se substituer au conseil de l'avocat." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ backgroundColor: EMERALD + "08" }}
              >
                <CheckCircle2
                  size={18}
                  className="shrink-0 mt-0.5"
                  style={{ color: EMERALD }}
                />
                <p className="text-sm text-stone-700 font-sans leading-relaxed">
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fiabilite Footer ────────────────────────────────────── */}
      <div className="dv-fade-up dv-d8 flex items-center justify-center gap-2 text-xs text-stone-400 font-sans pt-2">
        <ShieldCheck size={14} />
        <span>
          Indice de fiabilite : {data.fiabilite.score}/100 — {data.fiabilite.details}
        </span>
      </div>
    </div>
  );
}
