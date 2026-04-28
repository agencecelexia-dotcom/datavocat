"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ParsedAnalysis, EvidenceTable as EvidenceTableData } from "@/lib/parse-analysis";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Scale,
  Target,
  BarChart3,
  Landmark,
  Banknote,
  Shield,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  TrendingUp,
  ArrowRight,
  Clock,
  FileText,
  Gavel,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Table,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════

const NAVY = "#1e3a5f";
const NAVY_LIGHT = "#2a4f7a";
const GOLD = "#c9a96e";
const GOLD_LIGHT = "#d4b87e";
const EMERALD = "#2d6a4f";
const BORDEAUX = "#9b2226";
const AMBER = "#ca6702";

const GRADIENT_PAIRS: Array<[string, string]> = [
  [NAVY, NAVY_LIGHT],
  [GOLD, GOLD_LIGHT],
  [EMERALD, "#3d8a6a"],
  ["#5b8ec9", "#7ba8dd"],
  [AMBER, "#e07d18"],
  ["#7c3aed", "#9b5fff"],
  [BORDEAUX, "#c53030"],
];

// ════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════

interface SlideProps {
  children: React.ReactNode;
  className?: string;
}

interface Article700Data {
  tauxCondamnation: number | null;
  montantMoyen: number | null;
  montantMedian: number | null;
}

// ════════════════════════════════════════════
// ANIMATED COUNTER
// ════════════════════════════════════════════

function AnimatedCounter({
  target,
  duration = 2000,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  target: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setCount(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [target, duration, decimals]);

  return (
    <span>
      {prefix}
      {decimals > 0 ? count.toFixed(decimals) : count.toLocaleString("fr-FR")}
      {suffix}
    </span>
  );
}

// ════════════════════════════════════════════
// SLIDE CONTAINER — Full-bleed per slide
// ════════════════════════════════════════════

function Slide({ children, className = "" }: SlideProps) {
  return (
    <div className={`flex h-full w-full flex-col overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function rateColor(taux: number | null): string {
  if (taux === null) return NAVY;
  if (taux >= 60) return EMERALD;
  if (taux >= 40) return AMBER;
  return BORDEAUX;
}

function rateLabel(taux: number | null): string {
  if (taux === null) return "";
  if (taux >= 70) return "Favorable";
  if (taux >= 50) return "Equilibre";
  if (taux >= 30) return "Defavorable";
  return "Tres defavorable";
}

function formatCurrency(v: number | null): string {
  if (v === null) return "\u2014";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

function cleanMarkdownLine(line: string): string {
  return line
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
}

/** Parse Article 700 data from sections or raw text */
function parseArticle700(data: ParsedAnalysis): Article700Data {
  const result: Article700Data = {
    tauxCondamnation: null,
    montantMoyen: null,
    montantMedian: null,
  };

  // Look in sections first
  const art700Section = data.sections.find(
    (s) => s.title.toLowerCase().includes("article 700") || s.title.includes("700")
  );

  const textToSearch = art700Section
    ? art700Section.content
    : [data.recommandation, data.limites, data.situation, data.decisionsClés]
        .filter(Boolean)
        .join("\n");

  if (!textToSearch) return result;

  // Taux de condamnation
  const tauxMatch = textToSearch.match(
    /(?:taux\s+(?:de\s+)?condamnation|condamn[ée]s?\s+dans)\s*[:\-—]?\s*(?:environ\s+)?(\d{1,3}(?:[.,]\d+)?)\s*%/i
  ) || textToSearch.match(
    /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:des?\s+)?(?:d[ée]cisions?\s+)?(?:condamn|accord|allou)/i
  );
  if (tauxMatch) {
    result.tauxCondamnation = parseFloat(tauxMatch[1].replace(",", "."));
  }

  // Montant moyen
  const moyenMatch = textToSearch.match(
    /(?:montant\s+moyen|moyenne)\s*[:\-—]?\s*(?:environ\s+)?(\d[\d\s.,]*)\s*(?:euros?|€)/i
  );
  if (moyenMatch) {
    result.montantMoyen = parseFloat(moyenMatch[1].replace(/\s/g, "").replace(",", "."));
  }

  // Montant median
  const medianMatch = textToSearch.match(
    /(?:montant\s+m[ée]dian|m[ée]diane)\s*[:\-—]?\s*(?:environ\s+)?(\d[\d\s.,]*)\s*(?:euros?|€)/i
  );
  if (medianMatch) {
    result.montantMedian = parseFloat(medianMatch[1].replace(/\s/g, "").replace(",", "."));
  }

  return result;
}

// ════════════════════════════════════════════
// CUSTOM CHART TOOLTIP
// ════════════════════════════════════════════

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload?: { fullName?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const displayLabel = payload[0]?.payload?.fullName || label;
  return (
    <div
      className="rounded-xl border px-4 py-3 shadow-2xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.98)",
        borderColor: `${NAVY}15`,
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="mb-1 font-serif text-xs font-bold" style={{ color: NAVY }}>
        {displayLabel}
      </p>
      <p className="text-2xl font-extrabold" style={{ color: GOLD }}>
        {payload[0].value}%
      </p>
    </div>
  );
}

// ════════════════════════════════════════════
// CSS KEYFRAMES
// ════════════════════════════════════════════

const KEYFRAMES_CSS = `
@keyframes slideUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes drawCircle {
  from { stroke-dashoffset: 440; }
  to { stroke-dashoffset: var(--target-offset); }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(201, 169, 110, 0.1); }
  50% { box-shadow: 0 0 40px rgba(201, 169, 110, 0.25); }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes countPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}
`;

// ════════════════════════════════════════════
// SLIDE 1 — TITLE / HERO
// ════════════════════════════════════════════

function SlideTitleHero({
  query,
  data,
}: {
  query: string;
  data: ParsedAnalysis;
}) {
  const fiabiliteColor = rateColor(data.fiabilite.score);

  return (
    <Slide>
      {/* Navy → dark gradient background */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center px-8 py-12"
        style={{
          background: `linear-gradient(160deg, ${NAVY} 0%, #0f1f35 60%, #0a1628 100%)`,
        }}
      >
        {/* Subtle geometric pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Hero icon with glow */}
        <div
          className="relative mb-8"
          style={{ animation: "scaleIn 0.8s ease-out" }}
        >
          <div
            className="flex h-24 w-24 items-center justify-center rounded-3xl"
            style={{
              background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}10)`,
              border: `1px solid ${GOLD}40`,
              boxShadow: `0 0 60px ${GOLD}20, 0 0 120px ${GOLD}10`,
            }}
          >
            <Scale className="h-12 w-12" style={{ color: GOLD }} />
          </div>
          <div
            className="absolute -inset-6 -z-10 rounded-full blur-3xl"
            style={{ backgroundColor: `${GOLD}15` }}
          />
        </div>

        {/* Title */}
        <h1
          className="mb-3 text-center font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl"
          style={{ animation: "slideUp 0.6s ease-out 0.2s both" }}
        >
          Analyse Jurisprudentielle
        </h1>

        {/* Gold divider */}
        <div
          className="mb-6 flex items-center gap-4"
          style={{ animation: "fadeIn 0.8s ease-out 0.4s both" }}
        >
          <div className="h-px w-16" style={{ backgroundColor: `${GOLD}40` }} />
          <div
            className="h-2 w-2 rotate-45"
            style={{ backgroundColor: GOLD }}
          />
          <div className="h-px w-16" style={{ backgroundColor: `${GOLD}40` }} />
        </div>

        {/* Query summary */}
        <p
          className="mb-8 max-w-lg text-center text-base leading-relaxed"
          style={{
            color: "rgba(255,255,255,0.6)",
            animation: "slideUp 0.6s ease-out 0.5s both",
          }}
        >
          {truncate(query, 120)}
        </p>

        {/* Badges row */}
        <div
          className="flex flex-wrap items-center justify-center gap-3"
          style={{ animation: "slideUp 0.6s ease-out 0.7s both" }}
        >
          {/* Fiabilite badge */}
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              backgroundColor: `${fiabiliteColor}20`,
              border: `1px solid ${fiabiliteColor}40`,
            }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: fiabiliteColor }}
            />
            <span className="text-xs font-semibold" style={{ color: fiabiliteColor }}>
              Fiabilite : {data.fiabilite.label}
            </span>
          </div>

          {/* Source count badge */}
          {data.sourceCount > 0 && (
            <div
              className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <BookOpen className="h-3.5 w-3.5" style={{ color: GOLD }} />
              <span className="text-xs font-semibold text-white/70">
                {data.sourceCount} source{data.sourceCount > 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Echantillon badge */}
          {data.echantillon !== null && (
            <div
              className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} />
              <span className="text-xs font-semibold text-white/70">
                {data.echantillon} decisions
              </span>
            </div>
          )}
        </div>

        {/* Footer branding */}
        <div
          className="absolute bottom-6 flex items-center gap-2"
          style={{ animation: "fadeIn 1s ease-out 1s both" }}
        >
          <Scale className="h-3 w-3" style={{ color: `${GOLD}60` }} />
          <span
            className="font-serif text-[11px] tracking-wider"
            style={{ color: `${GOLD}50` }}
          >
            Datavocat
          </span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>&middot;</span>
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.25)" }}>
            Analyse Jurisprudentielle
          </span>
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 2 — HERO STAT
// ════════════════════════════════════════════

function SlideHeroStat({ data }: { data: ParsedAnalysis }) {
  const taux = data.tauxSuccesGlobal ?? 0;
  const color = rateColor(data.tauxSuccesGlobal);
  const label = rateLabel(data.tauxSuccesGlobal);

  return (
    <Slide>
      <div
        className="relative flex flex-1 flex-col items-center justify-center px-8"
        style={{ backgroundColor: "#fafaf9" }}
      >
        {/* Subtle radial glow behind the number */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`,
          }}
        />

        {/* The giant number */}
        <div
          className="relative mb-4 text-center"
          style={{ animation: "scaleIn 0.8s ease-out" }}
        >
          <span
            className="block font-sans text-[120px] font-black leading-none tracking-tighter sm:text-[160px]"
            style={{
              color,
              textShadow: `0 4px 40px ${color}20`,
            }}
          >
            <AnimatedCounter target={taux} duration={2500} />
          </span>
          <span
            className="absolute -right-8 top-4 text-5xl font-bold sm:-right-12 sm:top-6 sm:text-6xl"
            style={{ color: `${color}60` }}
          >
            %
          </span>
        </div>

        {/* Label */}
        <p
          className="mb-2 text-center font-serif text-xl font-bold tracking-tight sm:text-2xl"
          style={{ color: NAVY, animation: "slideUp 0.5s ease-out 0.4s both" }}
        >
          Taux de succes estime
        </p>

        {/* Confidence pill */}
        <div
          className="flex items-center gap-3"
          style={{ animation: "slideUp 0.5s ease-out 0.6s both" }}
        >
          <div
            className="flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{
              backgroundColor: `${color}10`,
              border: `1px solid ${color}25`,
            }}
          >
            {taux >= 50 ? (
              <ArrowUpRight className="h-3.5 w-3.5" style={{ color }} />
            ) : taux >= 30 ? (
              <Minus className="h-3.5 w-3.5" style={{ color }} />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" style={{ color }} />
            )}
            <span className="text-sm font-semibold" style={{ color }}>
              {label}
            </span>
          </div>

          {data.confiance && (
            <span className="text-xs text-gray-400">
              Confiance : <span className="font-semibold" style={{ color: NAVY }}>{data.confiance}</span>
            </span>
          )}
        </div>

        {/* Echantillon */}
        {data.echantillon !== null && (
          <p
            className="mt-6 text-xs text-gray-400"
            style={{ animation: "fadeIn 0.8s ease-out 0.8s both" }}
          >
            Base sur un echantillon de{" "}
            <span className="font-bold" style={{ color: NAVY }}>
              {data.echantillon}
            </span>{" "}
            decisions
          </p>
        )}
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 3 — SITUATION
// ════════════════════════════════════════════

function SlideSituation({ data }: { data: ParsedAnalysis }) {
  const lines = data.situation
    .split("\n")
    .filter((l) => l.trim())
    .map(cleanMarkdownLine)
    .filter(Boolean);

  // Extract key fact pills from the first lines
  const pills: string[] = [];
  const bodyLines: string[] = [];

  for (const line of lines) {
    // Short lines that look like labels become pills
    if (line.length < 60 && (line.includes(":") || pills.length < 3) && pills.length < 5) {
      pills.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  // If no natural pills, just show everything as body
  if (bodyLines.length === 0 && pills.length > 0) {
    bodyLines.push(...pills.splice(1));
  }

  return (
    <Slide>
      <div className="flex flex-1 flex-col px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        {/* Header */}
        <div className="mb-8" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Contexte juridique
          </p>
          <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: NAVY }}>
            Resume de la situation de votre client
          </h2>
        </div>

        <div className="flex flex-1 gap-8">
          {/* Navy left accent border */}
          <div
            className="w-1 shrink-0 rounded-full"
            style={{
              background: `linear-gradient(to bottom, ${NAVY}, ${NAVY}20)`,
            }}
          />

          <div className="flex-1">
            {/* Fact pills */}
            {pills.length > 0 && (
              <div
                className="mb-6 flex flex-wrap gap-2"
                style={{ animation: "slideUp 0.5s ease-out 0.2s both" }}
              >
                {pills.map((pill, i) => (
                  <span
                    key={i}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: `${NAVY}08`,
                      color: NAVY,
                      border: `1px solid ${NAVY}15`,
                    }}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            )}

            {/* Body text */}
            <div className="space-y-3">
              {bodyLines.map((line, i) => (
                <p
                  key={i}
                  className="text-sm leading-relaxed text-gray-600"
                  style={{
                    animation: `slideUp 0.4s ease-out ${0.3 + i * 0.08}s both`,
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 4 — ARGUMENTS (horizontal bar chart)
// ════════════════════════════════════════════

function SlideArguments({ data }: { data: ParsedAnalysis }) {
  const sorted = [...data.arguments]
    .filter((a) => a.taux !== null)
    .sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0));

  const chartData = sorted.map((a, i) => ({
    name: truncate(a.name, 30),
    fullName: a.name,
    taux: a.taux ?? 0,
    fill: GRADIENT_PAIRS[i % GRADIENT_PAIRS.length],
  }));

  const bestArg = sorted[0];

  return (
    <Slide>
      <div className="flex flex-1 flex-col px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        {/* Header — takeaway title */}
        <div className="mb-6" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Analyse des moyens
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            {bestArg && bestArg.taux !== null
              ? `${bestArg.name} : ${bestArg.taux}% de succes`
              : "Arguments & taux de succes"}
          </h2>
        </div>

        {/* Chart */}
        <div
          className="flex-1 overflow-hidden rounded-2xl border bg-white/80 p-4"
          style={{
            borderColor: `${NAVY}10`,
            animation: "scaleIn 0.6s ease-out 0.2s both",
          }}
        >
          <div style={{ height: Math.max(200, sorted.length * 56) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 10, right: 70, top: 8, bottom: 8 }}
              >
                <defs>
                  {GRADIENT_PAIRS.map(([start, end], i) => (
                    <linearGradient
                      key={i}
                      id={`argGrad${i}`}
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop offset="0%" stopColor={start} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={end} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: NAVY, fontWeight: 500 }}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: `${NAVY}06` }}
                />
                <Bar dataKey="taux" radius={[0, 8, 8, 0]} barSize={32}>
                  {chartData.map((_entry, i) => (
                    <Cell
                      key={i}
                      fill={`url(#argGrad${i % GRADIENT_PAIRS.length})`}
                      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Annotation for top argument */}
        {bestArg && (
          <div
            className="mt-4 flex items-center gap-2"
            style={{ animation: "slideUp 0.4s ease-out 0.6s both" }}
          >
            <TrendingUp className="h-4 w-4" style={{ color: EMERALD }} />
            <span className="text-xs font-semibold" style={{ color: EMERALD }}>
              Argument le plus fort
            </span>
            <span className="text-xs text-gray-400">
              — {bestArg.name} ({bestArg.taux}%)
            </span>
          </div>
        )}
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 5 — JURIDICTIONS
// ════════════════════════════════════════════

function SlideJuridictions({ data }: { data: ParsedAnalysis }) {
  return (
    <Slide>
      <div className="flex flex-1 flex-col px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        <div className="mb-8" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Repartition geographique
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Analyse par juridiction
          </h2>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          {data.juridictions.map((j, i) => {
            const taux = j.taux ?? 0;
            const color = rateColor(j.taux);
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-xl border bg-white/90 px-6 py-4"
                style={{
                  borderColor: `${color}20`,
                  animation: `slideInRight 0.4s ease-out ${i * 0.1}s both`,
                }}
              >
                {/* Left color accent */}
                <div
                  className="absolute bottom-0 left-0 top-0 w-1"
                  style={{ backgroundColor: color }}
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${color}10` }}
                    >
                      <Landmark className="h-5 w-5" style={{ color }} />
                    </div>
                    <div>
                      <p className="font-serif text-sm font-bold" style={{ color: NAVY }}>
                        {j.name}
                      </p>
                      {j.delai && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          Delai : {j.delai}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className="text-3xl font-extrabold tabular-nums"
                    style={{ color }}
                  >
                    {j.taux !== null ? `${j.taux}%` : "\u2014"}
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  className="mt-3 h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: `${color}08` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${taux}%`,
                      background: `linear-gradient(to right, ${color}, ${color}80)`,
                      boxShadow: `0 0 12px ${color}25`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 6 — INSTANCES (pipeline view)
// ════════════════════════════════════════════

function SlideInstances({ data }: { data: ParsedAnalysis }) {
  const instances = data.instances;

  return (
    <Slide>
      <div className="flex flex-1 flex-col items-center justify-center px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        <div className="mb-10 text-center" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Parcours judiciaire
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Succes par instance
          </h2>
          <p
            className="mt-3 max-w-lg text-xs leading-relaxed text-gray-400 italic"
            style={{ animation: "fadeIn 0.5s ease-out 0.2s both" }}
          >
            Les pourcentages indiquent le taux de decisions favorables a la partie demanderesse
            sur l&apos;ensemble des decisions analysees pour cette instance.
          </p>
        </div>

        {/* Pipeline */}
        <div className="flex w-full max-w-3xl items-center justify-center gap-0">
          {instances.map((inst, i) => {
            const taux = inst.taux ?? 0;
            const color = rateColor(inst.taux);
            const isLast = i === instances.length - 1;

            return (
              <div
                key={i}
                className="flex items-center"
                style={{ animation: `scaleIn 0.5s ease-out ${i * 0.2}s both` }}
              >
                {/* Instance card */}
                <div
                  className="relative flex h-40 w-40 flex-col items-center justify-center rounded-2xl border-2 sm:h-44 sm:w-44"
                  style={{
                    borderColor: color,
                    backgroundColor: `${color}06`,
                    boxShadow: `0 0 30px ${color}10`,
                  }}
                >
                  {/* Percentage */}
                  <span
                    className="text-4xl font-black tabular-nums sm:text-5xl"
                    style={{ color }}
                  >
                    {inst.taux !== null ? (
                      <AnimatedCounter target={taux} duration={2000 + i * 500} suffix="%" />
                    ) : (
                      "\u2014"
                    )}
                  </span>

                  {/* Instance name */}
                  <p
                    className="mt-2 text-center text-xs font-semibold"
                    style={{ color: NAVY }}
                  >
                    {inst.name}
                  </p>

                  {/* Status indicator dot */}
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {taux >= 60 ? "+" : taux >= 40 ? "=" : "-"}
                  </div>
                </div>

                {/* Arrow connector */}
                {!isLast && (
                  <div
                    className="flex items-center px-3"
                    style={{ animation: `fadeIn 0.5s ease-out ${0.3 + i * 0.2}s both` }}
                  >
                    <div className="h-0.5 w-6 sm:w-10" style={{ backgroundColor: `${NAVY}20` }} />
                    <ArrowRight className="h-5 w-5 -ml-1" style={{ color: `${NAVY}30` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 7 — MONTANTS
// ════════════════════════════════════════════

function SlideMontants({ data }: { data: ParsedAnalysis }) {
  const cards = [
    {
      label: "Minimum",
      value: data.montants.min,
      color: EMERALD,
      featured: false,
    },
    {
      label: "Mediane",
      value: data.montants.median,
      color: GOLD,
      featured: true,
    },
    {
      label: "Maximum",
      value: data.montants.max,
      color: BORDEAUX,
      featured: false,
    },
  ].filter((c) => c.value !== null);

  return (
    <Slide>
      <div
        className="flex flex-1 flex-col items-center justify-center px-10 py-10"
        style={{ backgroundColor: "#fafaf9" }}
      >
        <div className="mb-10 text-center" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Fourchette estimee
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Montants & indemnites
          </h2>
        </div>

        {/* KPI cards */}
        <div className="flex w-full max-w-3xl items-end justify-center gap-6">
          {cards.map((card, i) => (
            <div
              key={i}
              className={`relative flex-1 overflow-hidden rounded-2xl border text-center ${
                card.featured ? "py-10 shadow-xl" : "py-8 shadow-md"
              }`}
              style={{
                borderColor: card.featured ? `${card.color}50` : `${card.color}20`,
                backgroundColor: "white",
                animation: `scaleIn 0.5s ease-out ${i * 0.15}s both`,
                ...(card.featured
                  ? { boxShadow: `0 8px 40px ${card.color}15, 0 0 0 2px ${card.color}20` }
                  : {}),
              }}
            >
              {/* Top accent */}
              <div
                className="absolute left-0 right-0 top-0 h-1"
                style={{ backgroundColor: card.color }}
              />

              <p
                className="text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: `${card.color}80` }}
              >
                {card.label}
              </p>
              <p
                className={`mt-4 font-extrabold ${card.featured ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}
                style={{ color: card.color }}
              >
                {formatCurrency(card.value)}
              </p>

              {card.featured && (
                <div
                  className="mx-auto mt-4 flex w-fit items-center gap-1 rounded-full px-3 py-1"
                  style={{
                    backgroundColor: `${card.color}10`,
                    border: `1px solid ${card.color}20`,
                  }}
                >
                  <Target className="h-3 w-3" style={{ color: card.color }} />
                  <span className="text-[10px] font-semibold" style={{ color: card.color }}>
                    Valeur de reference
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Range bar */}
        {data.montants.min !== null && data.montants.max !== null && (
          <div
            className="mt-8 flex flex-col items-center gap-2"
            style={{ animation: "slideUp 0.4s ease-out 0.6s both" }}
          >
            <div
              className="h-2 w-72 overflow-hidden rounded-full sm:w-96"
              style={{ backgroundColor: `${NAVY}08` }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(to right, ${EMERALD}, ${GOLD}, ${BORDEAUX})`,
                }}
              />
            </div>
            <div className="flex w-72 justify-between text-[10px] text-gray-400 sm:w-96">
              <span>{formatCurrency(data.montants.min)}</span>
              {data.montants.median !== null && (
                <span className="font-bold" style={{ color: GOLD }}>
                  {formatCurrency(data.montants.median)}
                </span>
              )}
              <span>{formatCurrency(data.montants.max)}</span>
            </div>
          </div>
        )}
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 8 — ARTICLE 700 CPC
// ════════════════════════════════════════════

function SlideArticle700({ art700 }: { art700: Article700Data }) {
  const cards = [
    {
      label: "Taux de condamnation",
      value: art700.tauxCondamnation,
      suffix: "%",
      format: (v: number) => `${v}%`,
      color: NAVY,
      icon: <Gavel className="h-5 w-5" style={{ color: NAVY }} />,
    },
    {
      label: "Montant moyen",
      value: art700.montantMoyen,
      suffix: "",
      format: (v: number) => formatCurrency(v),
      color: GOLD,
      icon: <Banknote className="h-5 w-5" style={{ color: GOLD }} />,
    },
    {
      label: "Montant median",
      value: art700.montantMedian,
      suffix: "",
      format: (v: number) => formatCurrency(v),
      color: EMERALD,
      icon: <Target className="h-5 w-5" style={{ color: EMERALD }} />,
    },
  ].filter((c) => c.value !== null);

  return (
    <Slide>
      <div className="flex flex-1 flex-col items-center justify-center px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        <div className="mb-10 text-center" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Frais irrepetibles
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Article 700 du CPC
          </h2>
        </div>

        <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {cards.map((card, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-2xl border bg-white p-8 text-center shadow-md"
              style={{
                borderColor: `${card.color}20`,
                animation: `scaleIn 0.5s ease-out ${i * 0.15}s both`,
              }}
            >
              {/* Top accent */}
              <div
                className="absolute left-0 right-0 top-0 h-1"
                style={{ backgroundColor: card.color }}
              />

              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${card.color}10` }}
              >
                {card.icon}
              </div>

              <p
                className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: `${card.color}70` }}
              >
                {card.label}
              </p>

              <p
                className="text-3xl font-extrabold sm:text-4xl"
                style={{ color: card.color }}
              >
                {card.format(card.value!)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 9 — DECISIONS CLES
// ════════════════════════════════════════════

function SlideDecisionsCles({ data }: { data: ParsedAnalysis }) {
  const sources = data.sources.slice(0, 5);

  // If we have structured sources, show them; otherwise parse text
  const hasStructuredSources = sources.length > 0;

  return (
    <Slide>
      <div className="flex flex-1 flex-col px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        <div className="mb-6" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Jurisprudence de reference
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Decisions cles
          </h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {hasStructuredSources ? (
            sources.map((src, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-xl border bg-white/90 p-5 transition-all duration-200 hover:shadow-md"
                style={{
                  borderColor: `${NAVY}12`,
                  animation: `slideInRight 0.4s ease-out ${i * 0.1}s both`,
                }}
              >
                {/* Left gold accent */}
                <div
                  className="absolute bottom-0 left-0 top-0 w-1"
                  style={{
                    background: `linear-gradient(to bottom, ${GOLD}, ${GOLD}30)`,
                  }}
                />

                <div className="flex items-start justify-between gap-4 pl-3">
                  <div className="flex-1">
                    <p
                      className="font-mono text-sm font-bold leading-tight"
                      style={{ color: NAVY }}
                    >
                      {src.reference}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {src.date && (
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${NAVY}08`,
                            color: `${NAVY}90`,
                          }}
                        >
                          {src.date}
                        </span>
                      )}
                      {src.chamber && (
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${GOLD}12`,
                            color: `${GOLD}`,
                          }}
                        >
                          {src.chamber}
                        </span>
                      )}
                      {src.solution && (
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${EMERALD}10`,
                            color: EMERALD,
                          }}
                        >
                          {src.solution}
                        </span>
                      )}
                    </div>
                  </div>

                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110"
                      style={{
                        backgroundColor: `${GOLD}10`,
                        border: `1px solid ${GOLD}20`,
                      }}
                    >
                      <ExternalLink className="h-4 w-4" style={{ color: GOLD }} />
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            // Fallback: parse decisionsClés text
            data.decisionsClés
              .split("\n")
              .filter((l) => l.trim())
              .slice(0, 5)
              .map((line, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-xl border bg-white/90 p-4"
                  style={{
                    borderColor: `${NAVY}10`,
                    animation: `slideInRight 0.4s ease-out ${i * 0.1}s both`,
                  }}
                >
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                    style={{ backgroundColor: NAVY }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700">
                    {cleanMarkdownLine(line)}
                  </p>
                </div>
              ))
          )}
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 10 — RECOMMANDATIONS STRATEGIQUES
// ════════════════════════════════════════════

function SlideRecommandation({ data }: { data: ParsedAnalysis }) {
  const icons = [
    <Target key="t" className="h-5 w-5" style={{ color: NAVY }} />,
    <Shield key="s" className="h-5 w-5" style={{ color: EMERALD }} />,
    <Clock key="c" className="h-5 w-5" style={{ color: AMBER }} />,
    <Banknote key="b" className="h-5 w-5" style={{ color: GOLD }} />,
    <BarChart3 key="bc" className="h-5 w-5" style={{ color: NAVY_LIGHT }} />,
    <CheckCircle2 key="ch" className="h-5 w-5" style={{ color: EMERALD }} />,
  ];

  const lines = data.recommandation
    .split("\n")
    .filter((l) => l.trim())
    .map(cleanMarkdownLine)
    .filter(Boolean)
    .slice(0, 6);

  return (
    <Slide>
      <div className="flex flex-1 flex-col px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        <div className="mb-8" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: EMERALD }}
          >
            Plan d&apos;action
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Points d&apos;attention stratégiques
          </h2>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {lines.map((line, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-xl border bg-white/90 p-5 transition-all duration-200 hover:shadow-md"
              style={{
                borderColor: `${NAVY}10`,
                animation: `slideInRight 0.4s ease-out ${i * 0.1}s both`,
              }}
            >
              <div className="flex gap-4">
                {/* Numbered icon */}
                <div className="relative shrink-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${NAVY}06` }}
                  >
                    {icons[i % icons.length]}
                  </div>
                  <span
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                    }}
                  >
                    {i + 1}
                  </span>
                </div>

                <p className="flex-1 text-sm leading-relaxed text-gray-700">
                  {line}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE 11 — LIMITES & FIABILITE
// ════════════════════════════════════════════

function SlideFiabilite({ data }: { data: ParsedAnalysis }) {
  const score = data.fiabilite.score;
  const color = rateColor(score);
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference - (score / 100) * circumference;

  const limitLines = data.limites
    ? data.limites
        .split("\n")
        .filter((l) => l.trim())
        .map(cleanMarkdownLine)
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return (
    <Slide>
      <div className="flex flex-1 flex-col items-center justify-center px-10 py-10" style={{ backgroundColor: "#fafaf9" }}>
        <div className="mb-8 text-center" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Qualite de l&apos;analyse
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: NAVY }}>
            Indice de fiabilite
          </h2>
        </div>

        <div className="flex w-full max-w-3xl flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-12">
          {/* Circular gauge */}
          <div
            className="relative flex h-48 w-48 shrink-0 items-center justify-center"
            style={{ animation: "scaleIn 0.6s ease-out 0.2s both" }}
          >
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 192 192">
              {/* Background circle */}
              <circle
                cx="96"
                cy="96"
                r="70"
                fill="none"
                stroke={`${color}12`}
                strokeWidth="12"
              />
              {/* Score arc */}
              <circle
                cx="96"
                cy="96"
                r="70"
                fill="none"
                stroke={color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={dashOffset}
                style={{
                  transition: "stroke-dashoffset 2s ease-out",
                  filter: `drop-shadow(0 0 8px ${color}40)`,
                }}
              />
            </svg>
            <div className="text-center">
              <p className="text-5xl font-black" style={{ color }}>
                <AnimatedCounter target={score} />
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                / 100
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1">
            <p
              className="mb-1 font-serif text-lg font-bold"
              style={{ color: NAVY }}
            >
              {data.fiabilite.label}
            </p>
            {data.fiabilite.details && (
              <p className="mb-6 text-sm text-gray-500">{data.fiabilite.details}</p>
            )}

            {/* Limit points */}
            {limitLines.length > 0 && (
              <div className="space-y-3">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: AMBER }}
                >
                  Points d&apos;attention
                </p>
                {limitLines.map((line, i) => (
                  <div
                    key={i}
                    className="flex gap-3"
                    style={{ animation: `slideInRight 0.3s ease-out ${0.4 + i * 0.1}s both` }}
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: AMBER }}
                    />
                    <p className="text-sm leading-relaxed text-gray-600">{line}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <p
          className="mt-8 max-w-lg text-center text-[10px] leading-relaxed text-gray-400"
          style={{ animation: "fadeIn 0.8s ease-out 1s both" }}
        >
          L&apos;indice de fiabilite est calcule automatiquement en fonction du nombre de sources,
          de la taille de l&apos;echantillon et de la qualite des donnees disponibles.
          L&apos;analyse jurisprudentielle ne remplace pas le conseil juridique de l&apos;avocat.
        </p>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// ════════════════════════════════════════════
// SLIDE — TABLEAU DE PREUVE
// ════════════════════════════════════════════

function SlideEvidenceTable({ table }: { table: EvidenceTableData }) {
  // Show max 8 rows in the slide for readability
  const displayRows = table.rows.slice(0, 8);
  const hasMore = table.rows.length > 8;

  // Show max 7 columns for space
  const displayHeaders = table.headers.slice(0, 7);

  // Compute pertinence stats
  const pertCol = table.headers.find((h) => h.toLowerCase().includes("pertinence"));
  let favorable = 0;
  let defavorable = 0;
  if (pertCol) {
    for (const row of table.rows) {
      const v = (row[pertCol] || "").toLowerCase();
      if (v.includes("favorable") && !v.includes("defavorable") && !v.includes("défavorable")) favorable++;
      else if (v.includes("defavorable") || v.includes("défavorable")) defavorable++;
    }
  }

  return (
    <Slide>
      <div className="flex flex-1 flex-col px-8 py-8" style={{ backgroundColor: "#fafaf9" }}>
        {/* Header */}
        <div className="mb-4" style={{ animation: "slideUp 0.5s ease-out" }}>
          <p
            className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: GOLD }}
          >
            Preuve statistique
          </p>
          <h2 className="font-serif text-2xl font-bold tracking-tight" style={{ color: NAVY }}>
            Tableau des decisions analysees
          </h2>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
            <span><span className="font-bold" style={{ color: NAVY }}>{table.rows.length}</span> decisions</span>
            {pertCol && (
              <>
                <span><span className="font-bold" style={{ color: EMERALD }}>{favorable}</span> favorables</span>
                <span><span className="font-bold" style={{ color: BORDEAUX }}>{defavorable}</span> defavorables</span>
              </>
            )}
          </div>
        </div>

        {/* Mini table */}
        <div
          className="flex-1 overflow-hidden rounded-xl border"
          style={{ borderColor: `${NAVY}15`, animation: "fadeIn 0.6s ease-out 0.2s both" }}
        >
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ backgroundColor: `${NAVY}06` }}>
                {displayHeaders.map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: `${NAVY}80` }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t"
                  style={{ borderColor: `${NAVY}08` }}
                >
                  {displayHeaders.map((h) => {
                    const val = row[h] || "";
                    const isPert = h.toLowerCase().includes("pertinence");
                    const pertColor = isPert
                      ? val.toLowerCase().includes("favorable") && !val.toLowerCase().includes("defavorable")
                        ? EMERALD
                        : val.toLowerCase().includes("defavorable") || val.toLowerCase().includes("défavorable")
                          ? BORDEAUX
                          : AMBER
                      : undefined;

                    return (
                      <td key={h} className="whitespace-nowrap px-3 py-1.5 text-gray-600">
                        {isPert ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ color: pertColor, backgroundColor: `${pertColor}10` }}
                          >
                            {val}
                          </span>
                        ) : (
                          <span className="truncate max-w-[150px] inline-block">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <p className="mt-2 text-center text-[10px] text-gray-400">
            ... et {table.rows.length - 8} decisions supplementaires (voir onglet Tableau pour le detail complet)
          </p>
        )}

        {/* Synthesis */}
        {table.synthese && (
          <div
            className="mt-3 rounded-xl p-3"
            style={{
              backgroundColor: `${GOLD}06`,
              border: `1px solid ${GOLD}20`,
              animation: "slideUp 0.4s ease-out 0.5s both",
            }}
          >
            <p className="text-[10px] font-semibold" style={{ color: GOLD }}>
              Ce que cela signifie pour votre dossier
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              {table.interpretation || table.synthese}
            </p>
          </div>
        )}
      </div>
    </Slide>
  );
}

// SLIDE 12 — SYNTHESE & CTA
// ════════════════════════════════════════════

function SlideSynthese({ data }: { data: ParsedAnalysis }) {
  const takeaways: Array<{ label: string; value: string; color: string }> = [];

  if (data.tauxSuccesGlobal !== null) {
    takeaways.push({
      label: "Taux de succes",
      value: `${data.tauxSuccesGlobal}%`,
      color: rateColor(data.tauxSuccesGlobal),
    });
  }

  const bestArg = data.arguments.length > 0
    ? data.arguments.reduce((best, a) => ((a.taux ?? 0) > (best.taux ?? 0) ? a : best))
    : null;
  if (bestArg && bestArg.taux !== null) {
    takeaways.push({
      label: bestArg.name,
      value: `${bestArg.taux}%`,
      color: EMERALD,
    });
  }

  if (data.montants.median !== null) {
    takeaways.push({
      label: "Montant median",
      value: formatCurrency(data.montants.median),
      color: GOLD,
    });
  }

  if (data.sourceCount > 0) {
    takeaways.push({
      label: "Sources citees",
      value: `${data.sourceCount}`,
      color: NAVY,
    });
  }

  // Extract key next steps from recommandation
  const nextSteps = data.recommandation
    ? data.recommandation
        .split("\n")
        .filter((l) => l.trim())
        .map(cleanMarkdownLine)
        .filter(Boolean)
        .slice(0, 3)
    : [];

  return (
    <Slide>
      <div
        className="relative flex flex-1 flex-col items-center justify-center px-10 py-10"
        style={{
          background: `linear-gradient(160deg, ${NAVY} 0%, #0f1f35 60%, #0a1628 100%)`,
        }}
      >
        {/* Pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${GOLD} 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 w-full max-w-3xl">
          {/* Header */}
          <div className="mb-10 text-center" style={{ animation: "slideUp 0.5s ease-out" }}>
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ color: GOLD }}
            >
              Conclusion
            </p>
            <h2 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Synthese de l&apos;analyse
            </h2>
          </div>

          {/* Key takeaway pills */}
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {takeaways.map((t, i) => (
              <div
                key={i}
                className="rounded-xl p-5 text-center"
                style={{
                  backgroundColor: `${t.color}15`,
                  border: `1px solid ${t.color}30`,
                  animation: `scaleIn 0.4s ease-out ${i * 0.1}s both`,
                }}
              >
                <p className="text-2xl font-extrabold text-white">{t.value}</p>
                <p
                  className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: `${t.color}` }}
                >
                  {t.label}
                </p>
              </div>
            ))}
          </div>

          {/* Next steps */}
          {nextSteps.length > 0 && (
            <div
              className="mb-10 rounded-2xl p-6"
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                animation: "slideUp 0.5s ease-out 0.5s both",
              }}
            >
              <p
                className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: EMERALD }}
              >
                Prochaines etapes
              </p>
              <div className="space-y-3">
                {nextSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: `${GOLD}25`,
                        color: GOLD,
                      }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-white/70">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence level */}
          {(data.sourceCount > 0 || data.fiabilite.score > 0) && (
            <div
              className="mb-6 text-center"
              style={{ animation: "fadeIn 0.8s ease-out 0.7s both" }}
            >
              <p className="text-xs text-white/50">
                Analyse basee sur{" "}
                <span className="font-semibold text-white/70">{data.sourceCount} decisions</span>
                {" "}&mdash; niveau de confiance :{" "}
                <span className="font-semibold" style={{ color: GOLD }}>
                  {data.fiabilite.label.toLowerCase()}
                </span>
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <p
            className="text-center text-[10px] leading-relaxed text-white/30"
            style={{ animation: "fadeIn 0.8s ease-out 0.8s both" }}
          >
            Ce rapport est genere par intelligence artificielle a titre indicatif.
            Il ne constitue pas un avis juridique et doit etre valide par un professionnel du droit.
            L&apos;analyse jurisprudentielle ne remplace pas le conseil juridique de l&apos;avocat.
          </p>

          {/* Branding footer */}
          <div
            className="mt-6 flex items-center justify-center gap-2"
            style={{ animation: "fadeIn 1s ease-out 1s both" }}
          >
            <Scale className="h-3.5 w-3.5" style={{ color: `${GOLD}60` }} />
            <span className="font-serif text-xs tracking-wider" style={{ color: `${GOLD}50` }}>
              Datavocat
            </span>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>&middot;</span>
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.2)" }}>
              Analyse Jurisprudentielle
            </span>
          </div>
        </div>
      </div>
    </Slide>
  );
}

// ════════════════════════════════════════════
// SLIDE BUILDER — assembles the deck
// ════════════════════════════════════════════

function useSlides(data: ParsedAnalysis, query: string): React.ReactNode[] {
  return useMemo(() => {
    const slides: React.ReactNode[] = [];

    // 1. Title / Hero — always present
    slides.push(<SlideTitleHero key="title" query={query} data={data} />);

    // 2. Hero Stat — if we have a global success rate
    if (data.tauxSuccesGlobal !== null) {
      slides.push(<SlideHeroStat key="hero" data={data} />);
    }

    // 3. Situation — if we have situation text
    if (data.situation) {
      slides.push(<SlideSituation key="situation" data={data} />);
    }

    // 4. Arguments — if we have argument data
    if (data.arguments.length > 0) {
      slides.push(<SlideArguments key="arguments" data={data} />);
    }

    // 5. Juridictions — if we have jurisdiction data
    if (data.juridictions.length > 0) {
      slides.push(<SlideJuridictions key="juridictions" data={data} />);
    }

    // 6. Instances (pipeline) — if we have instance data
    if (data.instances && data.instances.length > 0) {
      slides.push(<SlideInstances key="instances" data={data} />);
    }

    // 7. Montants — if we have amount data
    if (data.montants.min !== null || data.montants.max !== null || data.montants.median !== null) {
      slides.push(<SlideMontants key="montants" data={data} />);
    }

    // 8. Article 700 CPC — if parseable
    const art700 = parseArticle700(data);
    if (art700.tauxCondamnation !== null || art700.montantMoyen !== null || art700.montantMedian !== null) {
      slides.push(<SlideArticle700 key="art700" art700={art700} />);
    }

    // 9. Decisions cles — if we have sources or text
    if (data.sources.length > 0 || data.decisionsClés) {
      slides.push(<SlideDecisionsCles key="decisions" data={data} />);
    }

    // 10. Evidence table — if available
    if (data.evidenceTable && data.evidenceTable.rows.length > 0) {
      slides.push(<SlideEvidenceTable key="evidence" table={data.evidenceTable} />);
    }

    // 11. Recommandation — if we have one
    if (data.recommandation) {
      slides.push(<SlideRecommandation key="recommandation" data={data} />);
    }

    // 12. Fiabilite & Limites
    if (data.fiabilite.score > 0) {
      slides.push(<SlideFiabilite key="fiabilite" data={data} />);
    }

    // 13. Synthese — always present (closing slide)
    slides.push(<SlideSynthese key="synthese" data={data} />);

    return slides;
  }, [data, query]);
}

// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════

export function AnalysisSlides({
  data,
  query,
}: {
  data: ParsedAnalysis;
  query: string;
}) {
  const slides = useSlides(data, query);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [slideKey, setSlideKey] = useState(0);

  const total = slides.length;

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => {
      const next = Math.min(prev + 1, total - 1);
      if (next !== prev) setSlideKey((k) => k + 1);
      return next;
    });
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next !== prev) setSlideKey((k) => k + 1);
      return next;
    });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index !== currentSlide && index >= 0 && index < total) {
        setCurrentSlide(index);
        setSlideKey((k) => k + 1);
      }
    },
    [currentSlide, total]
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "Escape") {
        setFullscreen(false);
      }
      if (e.key === "f" || e.key === "F") {
        setFullscreen((f) => !f);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  if (total === 0) return null;

  const slideContainer = (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        fullscreen ? "h-full w-full" : "h-[520px] sm:h-[580px]"
      }`}
      style={{
        borderColor: `${NAVY}12`,
        boxShadow: fullscreen
          ? `0 25px 80px rgba(0,0,0,0.4), 0 0 0 1px ${NAVY}10`
          : `0 4px 24px ${NAVY}08, 0 1px 4px ${NAVY}06`,
        backgroundColor: "#fafaf9",
      }}
    >
      {/* Current slide with fade transition */}
      <div
        key={slideKey}
        className="h-full w-full"
        style={{
          animation: "fadeIn 0.35s ease-out",
        }}
      >
        {slides[currentSlide]}
      </div>

      {/* Slide footer bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t px-6 py-2.5"
        style={{
          background: "rgba(250,250,249,0.95)",
          backdropFilter: "blur(8px)",
          borderColor: `${NAVY}08`,
        }}
      >
        <div className="flex items-center gap-2">
          <Scale className="h-3 w-3" style={{ color: GOLD }} />
          <span className="font-serif text-[10px] font-semibold tracking-wider" style={{ color: NAVY }}>
            Datavocat
          </span>
          <span className="text-[9px] text-gray-300">&middot;</span>
          <span
            className="text-[9px] uppercase tracking-[0.15em]"
            style={{ color: `${GOLD}70` }}
          >
            Analyse Jurisprudentielle
          </span>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tabular-nums tracking-wider"
          style={{
            backgroundColor: `${NAVY}08`,
            color: `${NAVY}70`,
          }}
        >
          {currentSlide + 1} / {total}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_CSS }} />

      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
              }}
            >
              <Scale className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-serif text-lg font-bold tracking-tight" style={{ color: NAVY }}>
              Presentation
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
            >
              {total} slides
            </span>
          </h2>

          <div className="flex items-center gap-4">
            {/* Pill dot indicators */}
            <div className="hidden items-center gap-1.5 sm:flex">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                  className="rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: i === currentSlide ? 24 : 8,
                    height: 8,
                    backgroundColor: i === currentSlide ? NAVY : `${NAVY}20`,
                    boxShadow: i === currentSlide ? `0 0 8px ${NAVY}30` : "none",
                  }}
                />
              ))}
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 hover:scale-105 hover:shadow-md"
              style={{
                borderColor: `${NAVY}15`,
                backgroundColor: "white",
              }}
              aria-label={fullscreen ? "Quitter le plein ecran" : "Plein ecran"}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" style={{ color: NAVY }} />
              ) : (
                <Maximize2 className="h-4 w-4" style={{ color: NAVY }} />
              )}
            </button>
          </div>
        </div>

        {/* Fullscreen backdrop */}
        {fullscreen && (
          <div
            className="fixed inset-0 z-40"
            style={{
              backgroundColor: "rgba(10, 15, 30, 0.9)",
              backdropFilter: "blur(12px)",
            }}
            onClick={() => setFullscreen(false)}
          />
        )}

        {/* Slide area */}
        <div
          className={
            fullscreen
              ? "fixed inset-4 z-50 flex items-center justify-center sm:inset-8 lg:inset-16"
              : "relative"
          }
          tabIndex={0}
          role="region"
          aria-label="Slide presentation"
          aria-roledescription="carousel"
        >
          {slideContainer}

          {/* Left arrow */}
          <div
            className={`absolute ${
              fullscreen ? "-left-2 sm:-left-6" : "-left-3 sm:-left-5"
            } inset-y-0 flex items-center`}
          >
            <button
              onClick={goPrev}
              disabled={currentSlide === 0}
              className="flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30"
              style={{
                backgroundColor: "rgba(255,255,255,0.95)",
                borderColor: `${NAVY}15`,
                backdropFilter: "blur(8px)",
              }}
              aria-label="Slide precedente"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: NAVY }} />
            </button>
          </div>

          {/* Right arrow */}
          <div
            className={`absolute ${
              fullscreen ? "-right-2 sm:-right-6" : "-right-3 sm:-right-5"
            } inset-y-0 flex items-center`}
          >
            <button
              onClick={goNext}
              disabled={currentSlide === total - 1}
              className="flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30"
              style={{
                backgroundColor: "rgba(255,255,255,0.95)",
                borderColor: `${NAVY}15`,
                backdropFilter: "blur(8px)",
              }}
              aria-label="Slide suivante"
            >
              <ChevronRight className="h-5 w-5" style={{ color: NAVY }} />
            </button>
          </div>
        </div>

        {/* Mobile slide counter */}
        <div className="flex items-center justify-center gap-1.5 sm:hidden">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === currentSlide ? 20 : 6,
                height: 6,
                backgroundColor: i === currentSlide ? NAVY : `${NAVY}20`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
