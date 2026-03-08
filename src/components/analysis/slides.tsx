"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ParsedAnalysis } from "@/lib/parse-analysis";
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
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// --- Color palette ---
const NAVY = "#1e3a5f";
const GOLD = "#c9a96e";
const EMERALD = "#2d6a4f";
const NAVY_LIGHT = "#2a4f7a";
const GOLD_LIGHT = "#d4b87e";

const BAR_COLORS = [NAVY, GOLD, EMERALD, "#5b8ec9", "#ca6702", "#7c3aed", "#9b2226"];

// Gradient pairs for bars
const GRADIENT_PAIRS: Array<[string, string]> = [
  [NAVY, NAVY_LIGHT],
  [GOLD, GOLD_LIGHT],
  [EMERALD, "#3d8a6a"],
  ["#5b8ec9", "#7ba8dd"],
  ["#ca6702", "#e07d18"],
  ["#7c3aed", "#9b5fff"],
  ["#9b2226", "#c53030"],
];

// --- Types ---

interface SlideDefinition {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
}

interface SourceEntry {
  type: string;
  reference: string;
  url: string;
  date: string;
  chamber: string;
  solution: string;
}

type AnalysisData = ParsedAnalysis & {
  sources?: SourceEntry[];
  sourceCount?: number;
  fiabilite?: { score: number; label: string; details: string };
};

// --- Animated Counter ---

function AnimatedCounter({
  target,
  duration = 2000,
  suffix = "",
}: {
  target: number;
  duration?: number;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let start = 0;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setCount(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [target, duration]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

// --- Slide Shell ---

function SlideShell({
  slide,
  index,
  total,
  direction,
}: {
  slide: SlideDefinition;
  index: number;
  total: number;
  direction: "left" | "right" | "none";
}) {
  return (
    <div className="flex h-full flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div
        className="relative border-b px-6 py-5 sm:px-10"
        style={{
          background: `linear-gradient(135deg, ${NAVY}0A 0%, ${GOLD}08 100%)`,
          borderColor: `${NAVY}15`,
        }}
      >
        {/* Gold accent stripe */}
        <div
          className="absolute left-0 top-0 h-full w-1"
          style={{
            background: `linear-gradient(to bottom, ${GOLD}, ${GOLD}40)`,
          }}
        />
        <div className="flex items-center gap-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
            }}
          >
            {slide.icon}
          </div>
          <div>
            <h2
              className="text-xl font-bold tracking-tight sm:text-2xl"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: NAVY }}
            >
              {slide.title}
            </h2>
            {slide.subtitle && (
              <p className="mt-0.5 text-xs font-medium tracking-wide text-gray-400">
                {slide.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8"
        style={{
          background: `linear-gradient(180deg, #fafbfd 0%, #f5f6fa 50%, #f0f1f5 100%)`,
        }}
      >
        {slide.content}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between border-t px-6 py-3 sm:px-10"
        style={{
          background: `linear-gradient(135deg, ${NAVY}06 0%, transparent 100%)`,
          borderColor: `${NAVY}10`,
        }}
      >
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5" style={{ color: GOLD }} />
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ fontFamily: "'Georgia', serif", color: NAVY }}
          >
            Datavocat
          </span>
          <span className="text-[10px] tracking-widest text-gray-300">—</span>
          <span
            className="text-[10px] font-medium uppercase tracking-widest"
            style={{ color: `${GOLD}90` }}
          >
            Analyse Jurimetrique
          </span>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider"
          style={{ backgroundColor: `${NAVY}0A`, color: `${NAVY}80` }}
        >
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

// --- Helpers ---

function formatCurrency(v: number | null): string {
  if (v === null) return "\u2014";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

function parseBulletLines(text: string): React.ReactNode[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      const cleaned = line
        .replace(/^[-*]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/\*\*/g, "");

      const isNumbered = /^\d+\./.test(line.trim());
      const numberMatch = line.trim().match(/^(\d+)\./);

      if (isNumbered && numberMatch) {
        return (
          <div
            key={i}
            className="flex gap-4 py-3"
            style={{
              animation: `slideInFromRight 0.5s ease-out ${i * 0.1}s both`,
            }}
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
              }}
            >
              {numberMatch[1]}
            </span>
            <span className="text-sm leading-relaxed text-gray-700">{cleaned}</span>
          </div>
        );
      }

      if (line.trimStart().startsWith("-") || line.trimStart().startsWith("*")) {
        return (
          <div
            key={i}
            className="flex gap-3 py-2"
            style={{
              animation: `slideInFromRight 0.5s ease-out ${i * 0.08}s both`,
            }}
          >
            <span
              className="mt-2 h-2 w-2 shrink-0 rounded-full shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
              }}
            />
            <span className="text-sm leading-relaxed text-gray-700">{cleaned}</span>
          </div>
        );
      }

      return (
        <p key={i} className="mb-3 text-sm leading-relaxed text-gray-600">
          {cleaned}
        </p>
      );
    });
}

// --- Custom Tooltip ---

function CustomTooltip({
  active,
  payload,
  label,
  suffix = "%",
  valueLabel = "Taux",
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  suffix?: string;
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border px-4 py-3 shadow-xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.97)",
        borderColor: `${NAVY}15`,
        backdropFilter: "blur(8px)",
      }}
    >
      <p
        className="mb-1 text-xs font-bold"
        style={{ fontFamily: "'Georgia', serif", color: NAVY }}
      >
        {label}
      </p>
      <p className="text-lg font-bold" style={{ color: GOLD }}>
        {payload[0].value}
        {suffix}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-400">
        {valueLabel}
      </p>
    </div>
  );
}

// --- Build slides ---

function buildSlides(data: AnalysisData, query: string): SlideDefinition[] {
  const slides: SlideDefinition[] = [];

  // =====================
  // 1. TITLE SLIDE
  // =====================
  slides.push({
    icon: <Scale className="h-5 w-5 text-white" />,
    title: "Analyse Jurimetrique",
    subtitle: "RAPPORT CONFIDENTIEL",
    content: (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        {/* Decorative element */}
        <div className="relative">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
            }}
          >
            <Scale className="h-10 w-10 text-white" />
          </div>
          {/* Subtle glow ring */}
          <div
            className="absolute -inset-3 -z-10 rounded-3xl opacity-20 blur-xl"
            style={{ backgroundColor: GOLD }}
          />
        </div>

        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: NAVY }}
        >
          Analyse Jurimetrique
        </h1>

        {/* Gold divider */}
        <div className="flex items-center gap-3">
          <div className="h-px w-12" style={{ backgroundColor: `${GOLD}40` }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
          <div className="h-px w-12" style={{ backgroundColor: `${GOLD}40` }} />
        </div>

        <p className="max-w-lg text-base leading-relaxed text-gray-500">
          {query}
        </p>

        {data.tauxSuccesGlobal !== null && (
          <div
            className="relative mt-4 overflow-hidden rounded-2xl px-12 py-7"
            style={{
              background: `linear-gradient(135deg, ${NAVY}08 0%, ${GOLD}12 100%)`,
              border: `1px solid ${GOLD}30`,
              boxShadow: `0 4px 24px ${GOLD}15, 0 1px 3px ${NAVY}08`,
            }}
          >
            {/* Subtle shimmer effect */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                background: `repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 10px,
                  ${GOLD} 10px,
                  ${GOLD} 11px
                )`,
              }}
            />
            <p
              className="relative text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: `${NAVY}60` }}
            >
              Taux de succes estime
            </p>
            <p className="relative mt-2">
              <span
                className="text-6xl font-extrabold"
                style={{
                  color: NAVY,
                  textShadow: `0 0 40px ${GOLD}20`,
                }}
              >
                <AnimatedCounter target={data.tauxSuccesGlobal} suffix="" />
              </span>
              <span
                className="text-4xl font-bold"
                style={{ color: GOLD }}
              >
                %
              </span>
            </p>
          </div>
        )}

        {(data.sourceCount ?? data.echantillon) !== null && (
          <p className="text-sm text-gray-400">
            Base sur{" "}
            <span className="font-semibold" style={{ color: NAVY }}>
              {data.sourceCount ?? data.echantillon}
            </span>{" "}
            decisions de jurisprudence
          </p>
        )}
      </div>
    ),
  });

  // =====================
  // 2. SITUATION SLIDE
  // =====================
  if (data.situation) {
    slides.push({
      icon: <Target className="h-5 w-5 text-white" />,
      title: "Analyse de la situation",
      subtitle: "CONTEXTE JURIDIQUE",
      content: (
        <div className="mx-auto max-w-2xl">
          <div
            className="mb-6 rounded-xl border-l-4 bg-white/60 px-5 py-4 shadow-sm"
            style={{ borderColor: GOLD }}
          >
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
              Synthese
            </p>
          </div>
          <div className="space-y-1">
            {parseBulletLines(data.situation)}
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 3. ARGUMENTS CHART
  // =====================
  if (data.arguments.length > 0) {
    const chartData = data.arguments.map((a, i) => ({
      name: a.name.length > 35 ? a.name.slice(0, 33) + "\u2026" : a.name,
      fullName: a.name,
      taux: a.taux ?? 0,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    }));

    slides.push({
      icon: <BarChart3 className="h-5 w-5 text-white" />,
      title: "Arguments & Taux de succes",
      subtitle: "ANALYSE STATISTIQUE",
      content: (
        <div className="h-full">
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{
              backgroundColor: `${EMERALD}0A`,
              border: `1px solid ${EMERALD}20`,
            }}
          >
            <TrendingUp className="h-3.5 w-3.5" style={{ color: EMERALD }} />
            <span className="text-xs font-semibold" style={{ color: EMERALD }}>
              {chartData.length} arguments analyses
            </span>
          </div>
          <div
            className="overflow-hidden rounded-xl border bg-white/80 p-4 shadow-sm"
            style={{ borderColor: `${NAVY}10` }}
          >
            <div style={{ height: Math.max(260, data.arguments.length * 52) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 10, right: 60, top: 12, bottom: 12 }}
                >
                  <defs>
                    {GRADIENT_PAIRS.map(([start, end], i) => (
                      <linearGradient
                        key={i}
                        id={`barGrad${i}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor={start} stopOpacity={0.85} />
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
                    width={220}
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: NAVY, fontWeight: 500 }}
                  />
                  <Tooltip
                    content={<CustomTooltip suffix="%" valueLabel="Taux de succes" />}
                    cursor={{ fill: `${NAVY}06` }}
                  />
                  <Bar dataKey="taux" radius={[0, 8, 8, 0]} barSize={28}>
                    {chartData.map((_entry, i) => (
                      <Cell
                        key={i}
                        fill={`url(#barGrad${i % GRADIENT_PAIRS.length})`}
                        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.08))" }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 4. JURISDICTIONS
  // =====================
  if (data.juridictions.length > 0) {
    slides.push({
      icon: <Landmark className="h-5 w-5 text-white" />,
      title: "Analyse par juridiction",
      subtitle: "REPARTITION GEOGRAPHIQUE",
      content: (
        <div className="grid gap-5 sm:grid-cols-2">
          {data.juridictions.map((j, i) => {
            const taux = j.taux ?? 0;
            const color = BAR_COLORS[i % BAR_COLORS.length];
            const gradientPair = GRADIENT_PAIRS[i % GRADIENT_PAIRS.length];
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-xl border bg-white/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: `${color}20` }}
              >
                {/* Top color accent */}
                <div
                  className="absolute left-0 right-0 top-0 h-1"
                  style={{
                    background: `linear-gradient(to right, ${gradientPair[0]}, ${gradientPair[1]})`,
                  }}
                />
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}12` }}
                    >
                      <Landmark className="h-4 w-4" style={{ color }} />
                    </div>
                    <span
                      className="text-sm font-bold"
                      style={{ fontFamily: "'Georgia', serif", color: NAVY }}
                    >
                      {j.name}
                    </span>
                  </div>
                  <span
                    className="text-xl font-extrabold"
                    style={{ color }}
                  >
                    {j.taux !== null ? `${j.taux}%` : "\u2014"}
                  </span>
                </div>
                {/* Progress bar with gradient */}
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: `${color}10` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${taux}%`,
                      background: `linear-gradient(to right, ${gradientPair[0]}, ${gradientPair[1]})`,
                      boxShadow: `0 0 8px ${color}30`,
                    }}
                  />
                </div>
                {j.delai && (
                  <p className="mt-3 text-xs font-medium text-gray-400">
                    Delai moyen :{" "}
                    <span style={{ color: NAVY }}>{j.delai}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ),
    });
  }

  // =====================
  // 5. INSTANCES (Pie chart)
  // =====================
  if (data.instances && data.instances.length > 0) {
    const pieData = data.instances.map((inst, i) => ({
      name: inst.name,
      value: inst.taux ?? 0,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    }));

    slides.push({
      icon: <BarChart3 className="h-5 w-5 text-white" />,
      title: "Repartition par instance",
      subtitle: "PROPORTION DES DECISIONS",
      content: (
        <div className="flex h-full flex-col items-center justify-center gap-6">
          <div
            className="overflow-hidden rounded-xl border bg-white/80 p-6 shadow-sm"
            style={{ borderColor: `${NAVY}10` }}
          >
            <div style={{ width: 320, height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {GRADIENT_PAIRS.map(([start, end], i) => (
                      <linearGradient
                        key={i}
                        id={`pieGrad${i}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={start} />
                        <stop offset="100%" stopColor={end} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((_entry, i) => (
                      <Cell
                        key={i}
                        fill={`url(#pieGrad${i % GRADIENT_PAIRS.length})`}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip suffix="%" valueLabel="Proportion" />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4">
            {pieData.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-xs font-medium text-gray-600">
                  {entry.name}{" "}
                  <span className="font-bold" style={{ color: entry.fill }}>
                    {entry.value}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 6. MONTANTS
  // =====================
  if (data.montants.min !== null || data.montants.max !== null) {
    const montantCards = [
      {
        label: "Minimum",
        value: data.montants.min,
        color: EMERALD,
        gradient: `linear-gradient(135deg, ${EMERALD}08 0%, ${EMERALD}03 100%)`,
        borderColor: `${EMERALD}20`,
      },
      {
        label: "Median",
        value: data.montants.median,
        color: NAVY,
        gradient: `linear-gradient(135deg, ${NAVY}08 0%, ${NAVY}03 100%)`,
        borderColor: `${NAVY}20`,
        featured: true,
      },
      {
        label: "Maximum",
        value: data.montants.max,
        color: GOLD,
        gradient: `linear-gradient(135deg, ${GOLD}12 0%, ${GOLD}05 100%)`,
        borderColor: `${GOLD}30`,
      },
    ];

    slides.push({
      icon: <Banknote className="h-5 w-5 text-white" />,
      title: "Montants & Indemnites",
      subtitle: "FOURCHETTE ESTIMEE",
      content: (
        <div className="flex h-full flex-col items-center justify-center gap-10">
          <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-3">
            {montantCards.map((card, i) => (
              <div
                key={i}
                className={`group relative overflow-hidden rounded-2xl border p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                  card.featured ? "sm:-mt-2 sm:mb-0" : ""
                }`}
                style={{
                  background: card.gradient,
                  borderColor: card.borderColor,
                }}
              >
                {/* Top accent line */}
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
                  className={`mt-4 font-extrabold ${card.featured ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}
                  style={{ color: card.color }}
                >
                  {formatCurrency(card.value)}
                </p>
              </div>
            ))}
          </div>
          {/* Gradient spectrum bar */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-2.5 w-80 rounded-full shadow-inner"
              style={{
                background: `linear-gradient(to right, ${EMERALD}, ${NAVY}, ${GOLD})`,
                boxShadow: `0 0 20px ${NAVY}15`,
              }}
            />
            <div className="flex w-80 justify-between text-[10px] font-medium text-gray-400">
              <span>Min</span>
              <span>Median</span>
              <span>Max</span>
            </div>
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 7. SOURCES
  // =====================
  const sources = (data as AnalysisData).sources;
  if (sources && sources.length > 0) {
    slides.push({
      icon: <BookOpen className="h-5 w-5 text-white" />,
      title: "Sources jurisprudentielles",
      subtitle: `${sources.length} REFERENCE${sources.length > 1 ? "S" : ""} IDENTIFIEE${sources.length > 1 ? "S" : ""}`,
      content: (
        <div className="grid gap-4 sm:grid-cols-2">
          {sources.map((src, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-xl border bg-white/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              style={{
                borderColor: `${NAVY}12`,
              }}
            >
              {/* Left accent */}
              <div
                className="absolute bottom-0 left-0 top-0 w-1 transition-all duration-300 group-hover:w-1.5"
                style={{
                  background: `linear-gradient(to bottom, ${GOLD}, ${GOLD}40)`,
                }}
              />
              <div className="mb-3 flex items-start justify-between gap-3 pl-2">
                <span
                  className="text-sm font-bold leading-tight"
                  style={{ fontFamily: "'Georgia', serif", color: NAVY }}
                >
                  {src.reference}
                </span>
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110"
                    style={{
                      backgroundColor: `${GOLD}10`,
                      border: `1px solid ${GOLD}20`,
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  </a>
                )}
              </div>
              <div className="space-y-1 pl-2">
                {src.date && (
                  <p className="text-xs text-gray-400">{src.date}</p>
                )}
                {src.chamber && (
                  <p className="text-xs font-medium text-gray-500">{src.chamber}</p>
                )}
                {src.solution && (
                  <span
                    className="mt-2 inline-block rounded-md px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${EMERALD}10 0%, ${EMERALD}05 100%)`,
                      color: EMERALD,
                      border: `1px solid ${EMERALD}20`,
                    }}
                  >
                    {src.solution}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ),
    });
  }

  // =====================
  // 8. DÉCISIONS CLÉS
  // =====================
  if (data.decisionsClés) {
    slides.push({
      icon: <BookOpen className="h-5 w-5 text-white" />,
      title: "Décisions clés",
      subtitle: "JURISPRUDENCE DE RÉFÉRENCE",
      content: (
        <div className="mx-auto max-w-2xl">
          <div
            className="mb-6 rounded-xl border-l-4 bg-white/60 px-5 py-4 shadow-sm"
            style={{ borderColor: NAVY }}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" style={{ color: NAVY }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>
                Arrêts de principe identifiés
              </p>
            </div>
          </div>
          <div className="space-y-1">
            {parseBulletLines(data.decisionsClés)}
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 9. RECOMMANDATION
  // =====================
  if (data.recommandation) {
    slides.push({
      icon: <Shield className="h-5 w-5 text-white" />,
      title: "Recommandation strategique",
      subtitle: "PLAN D'ACTION",
      content: (
        <div className="mx-auto max-w-2xl">
          <div
            className="mb-6 rounded-xl border-l-4 bg-white/60 px-5 py-4 shadow-sm"
            style={{
              borderColor: EMERALD,
              background: `linear-gradient(135deg, ${EMERALD}06 0%, transparent 100%)`,
            }}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" style={{ color: EMERALD }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: EMERALD }}>
                Strategie recommandee
              </p>
            </div>
          </div>
          <div className="space-y-1">
            {parseBulletLines(data.recommandation)}
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 9. LIMITES
  // =====================
  if (data.limites) {
    slides.push({
      icon: <AlertTriangle className="h-5 w-5 text-white" />,
      title: "Limites & Reserves",
      subtitle: "POINTS D'ATTENTION",
      content: (
        <div className="mx-auto max-w-2xl">
          <div
            className="overflow-hidden rounded-xl border shadow-sm"
            style={{
              background: `linear-gradient(135deg, #fffbeb 0%, #fef3cd 100%)`,
              borderColor: "#fbbf2430",
            }}
          >
            {/* Top accent */}
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(to right, #f59e0b, #d97706)`,
              }}
            />
            <div className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "#fbbf2420" }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: "#b45309" }} />
                </div>
                <div>
                  <span className="text-sm font-bold" style={{ color: "#92400e" }}>
                    Points d&apos;attention
                  </span>
                  <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "#b4530980" }}>
                    A prendre en compte
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {data.limites
                  .split("\n")
                  .filter((line) => line.trim())
                  .map((line, i) => (
                    <div
                      key={i}
                      className="flex gap-3 rounded-lg px-3 py-2"
                      style={{
                        backgroundColor: "#fbbf2408",
                        animation: `slideInFromRight 0.4s ease-out ${i * 0.1}s both`,
                      }}
                    >
                      <span className="mt-1 text-amber-500">&#x25cf;</span>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "#78350f" }}
                      >
                        {line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "")}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 10. FIABILITE
  // =====================
  const fiabilite = (data as AnalysisData).fiabilite;
  if (fiabilite && fiabilite.score > 0) {
    const scoreColor =
      fiabilite.score >= 60 ? EMERALD : fiabilite.score >= 40 ? GOLD : "#dc2626";

    slides.push({
      icon: <Shield className="h-5 w-5 text-white" />,
      title: "Indice de fiabilite",
      subtitle: "QUALITE DE L'ANALYSE",
      content: (
        <div className="flex h-full flex-col items-center justify-center gap-8">
          {/* Circular score indicator */}
          <div className="relative flex h-40 w-40 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke={`${scoreColor}15`}
                strokeWidth="10"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(fiabilite.score / 100) * 440} 440`}
                style={{
                  filter: `drop-shadow(0 0 6px ${scoreColor}40)`,
                }}
              />
            </svg>
            <div className="text-center">
              <p className="text-4xl font-extrabold" style={{ color: scoreColor }}>
                <AnimatedCounter target={fiabilite.score} />
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                / 100
              </p>
            </div>
          </div>
          <div className="text-center">
            <p
              className="text-lg font-bold"
              style={{ fontFamily: "'Georgia', serif", color: NAVY }}
            >
              {fiabilite.label}
            </p>
            {fiabilite.details && (
              <p className="mt-2 max-w-md text-sm text-gray-500">
                {fiabilite.details}
              </p>
            )}
          </div>
        </div>
      ),
    });
  }

  // =====================
  // 12. SYNTHÈSE CLIENT
  // =====================
  {
    const hasStats = data.tauxSuccesGlobal !== null;
    const hasArgs = data.arguments.length > 0;
    const hasReco = !!data.recommandation;
    const hasMontants = data.montants.min !== null || data.montants.max !== null;

    if (hasStats || hasArgs || hasReco) {
      const bestArg = hasArgs
        ? data.arguments.reduce((best, a) =>
            (a.taux ?? 0) > (best.taux ?? 0) ? a : best
          )
        : null;

      slides.push({
        icon: <Scale className="h-5 w-5 text-white" />,
        title: "Synthèse & Conclusion",
        subtitle: "POINTS CLÉS À RETENIR",
        content: (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            {/* Key metrics row */}
            <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {hasStats && (
                <div
                  className="rounded-xl border p-4 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${NAVY}08, ${NAVY}03)`,
                    borderColor: `${NAVY}20`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${NAVY}60` }}>
                    Taux de succès
                  </p>
                  <p className="mt-1 text-3xl font-extrabold" style={{ color: NAVY }}>
                    {data.tauxSuccesGlobal}%
                  </p>
                </div>
              )}
              {bestArg && bestArg.taux !== null && (
                <div
                  className="rounded-xl border p-4 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${EMERALD}08, ${EMERALD}03)`,
                    borderColor: `${EMERALD}20`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${EMERALD}60` }}>
                    Meilleur argument
                  </p>
                  <p className="mt-1 text-3xl font-extrabold" style={{ color: EMERALD }}>
                    {bestArg.taux}%
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-gray-400">
                    {bestArg.name}
                  </p>
                </div>
              )}
              {hasMontants && data.montants.median !== null && (
                <div
                  className="rounded-xl border p-4 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}10, ${GOLD}03)`,
                    borderColor: `${GOLD}25`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${GOLD}80` }}>
                    Montant médian
                  </p>
                  <p className="mt-1 text-3xl font-extrabold" style={{ color: GOLD }}>
                    {formatCurrency(data.montants.median)}
                  </p>
                </div>
              )}
              {data.sourceCount !== undefined && data.sourceCount > 0 && (
                <div
                  className="rounded-xl border p-4 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${NAVY}05, transparent)`,
                    borderColor: `${NAVY}15`,
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${NAVY}50` }}>
                    Sources citées
                  </p>
                  <p className="mt-1 text-3xl font-extrabold" style={{ color: NAVY }}>
                    {data.sourceCount}
                  </p>
                </div>
              )}
            </div>

            {/* Recommandation summary */}
            {hasReco && (
              <div
                className="w-full max-w-2xl rounded-xl border-l-4 bg-white/70 px-6 py-5 shadow-sm"
                style={{ borderColor: EMERALD }}
              >
                <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: EMERALD }}>
                  Recommandation principale
                </p>
                <p className="text-sm leading-relaxed text-gray-700">
                  {data.recommandation
                    .split("\n")
                    .filter((l) => l.trim())
                    .slice(0, 3)
                    .map((l) => l.replace(/^[-*]\s*/, "").replace(/\*\*/g, ""))
                    .join(" ")}
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <p className="max-w-lg text-center text-[10px] leading-relaxed text-gray-400">
              Ce rapport est généré par intelligence artificielle à titre indicatif.
              Il ne constitue pas un avis juridique et doit être validé par un professionnel du droit.
              Les statistiques sont basées sur la jurisprudence disponible et peuvent varier.
            </p>
          </div>
        ),
      });
    }
  }

  return slides;
}

// --- CSS Keyframes (injected once) ---

const KEYFRAMES_CSS = `
@keyframes slideInFromRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(201, 169, 110, 0.15); }
  50% { box-shadow: 0 0 40px rgba(201, 169, 110, 0.3); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

function SlideAnimations() {
  return <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_CSS }} />;
}

// --- Main component ---

export function AnalysisSlides({
  data,
  query,
}: {
  data: ParsedAnalysis;
  query: string;
}) {
  const slides = buildSlides(data as AnalysisData, query);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | "none">("none");
  const [isAnimating, setIsAnimating] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => {
    if (isAnimating) return;
    setDirection("left");
    setIsAnimating(true);
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
    setTimeout(() => setIsAnimating(false), 500);
  }, [slides.length, isAnimating]);

  const goPrev = useCallback(() => {
    if (isAnimating) return;
    setDirection("right");
    setIsAnimating(true);
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
    setTimeout(() => setIsAnimating(false), 500);
  }, [isAnimating]);

  const goTo = useCallback(
    (index: number) => {
      if (isAnimating || index === currentSlide) return;
      setDirection(index > currentSlide ? "left" : "right");
      setIsAnimating(true);
      setCurrentSlide(index);
      setTimeout(() => setIsAnimating(false), 500);
    },
    [currentSlide, isAnimating]
  );

  // Global keyboard navigation
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
    }

    if (fullscreen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [fullscreen, goNext, goPrev]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      goNext();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
    if (e.key === "Escape") setFullscreen(false);
  };

  if (slides.length === 0) return null;

  return (
    <>
      <SlideAnimations />
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
            <span
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "'Georgia', serif", color: NAVY }}
            >
              Presentation
            </span>
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ backgroundColor: `${GOLD}15`, color: GOLD }}
            >
              {slides.length} slides
            </span>
          </h2>
          <div className="flex items-center gap-4">
            {/* Pill dot indicators */}
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                  className="rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: i === currentSlide ? 28 : 8,
                    height: 8,
                    backgroundColor: i === currentSlide ? NAVY : `${NAVY}20`,
                    boxShadow:
                      i === currentSlide
                        ? `0 0 8px ${NAVY}30`
                        : "none",
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
              backgroundColor: "rgba(15, 23, 42, 0.85)",
              backdropFilter: "blur(8px)",
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
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="region"
          aria-label="Slide presentation"
          aria-roledescription="carousel"
        >
          <div
            className={`w-full overflow-hidden rounded-2xl border shadow-lg ${
              fullscreen ? "h-full" : "h-[520px] sm:h-[560px]"
            }`}
            style={{
              borderColor: `${NAVY}12`,
              boxShadow: fullscreen
                ? `0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px ${NAVY}10`
                : `0 4px 20px ${NAVY}08, 0 1px 3px ${NAVY}05`,
              backgroundColor: "#fafbfd",
            }}
          >
            {/* Slide track with horizontal transition */}
            <div
              ref={trackRef}
              className="flex h-full transition-transform duration-500 ease-out"
              style={{
                width: `${slides.length * 100}%`,
                transform: `translateX(-${(currentSlide * 100) / slides.length}%)`,
              }}
            >
              {slides.map((slide, i) => (
                <div
                  key={i}
                  className="h-full"
                  style={{ width: `${100 / slides.length}%` }}
                >
                  <SlideShell
                    slide={slide}
                    index={i}
                    total={slides.length}
                    direction={direction}
                  />
                </div>
              ))}
            </div>
          </div>

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
              disabled={currentSlide === slides.length - 1}
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
      </div>
    </>
  );
}
