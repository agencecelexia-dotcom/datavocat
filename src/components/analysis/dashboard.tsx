"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ParsedAnalysis } from "@/lib/parse-analysis";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Scale,
  Users,
  Landmark,
  Banknote,
  ShieldCheck,
  AlertTriangle,
  Clock,
  BarChart3,
  Target,
} from "lucide-react";

// ── Palette ──────────────────────────────────────────────────────────
const NAVY = "#1e3a5f";
const GOLD = "#c9a96e";
const EMERALD = "#2d6a4f";
const VIOLET = "#7c3aed";
const AMBER = "#ca6702";
const BORDEAUX = "#9b2226";

const PIE_COLORS = [NAVY, GOLD, EMERALD, VIOLET, AMBER, BORDEAUX, "#5b8ec9"];

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (v: number | null) =>
  v !== null
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v)
    : "\—";

function pctColor(pct: number): string {
  if (pct >= 60) return EMERALD;
  if (pct >= 40) return AMBER;
  return BORDEAUX;
}

// ── CSS Keyframes (injected once) ────────────────────────────────────
const STYLE_ID = "datavocat-dashboard-styles";

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes dv-fade-in-up {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes dv-scale-in {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes dv-bar-grow {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }
    @keyframes dv-pulse-ring {
      0%   { transform: scale(0.9); opacity: 0.6; }
      50%  { transform: scale(1.1); opacity: 0.2; }
      100% { transform: scale(0.9); opacity: 0.6; }
    }
    @keyframes dv-gradient-shift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes dv-count-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .dv-animate-section {
      opacity: 0;
      animation: dv-fade-in-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .dv-animate-scale {
      opacity: 0;
      animation: dv-scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .dv-stagger-1 { animation-delay: 0.05s; }
    .dv-stagger-2 { animation-delay: 0.1s; }
    .dv-stagger-3 { animation-delay: 0.15s; }
    .dv-stagger-4 { animation-delay: 0.2s; }
    .dv-stagger-5 { animation-delay: 0.25s; }
    .dv-stagger-6 { animation-delay: 0.3s; }
  `;
  document.head.appendChild(style);
}

// ── Intersection Observer hook ───────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// ── Animated counter hook ────────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 1800, active = true) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start = 0;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setValue(current);
      if (progress < 1) {
        start = requestAnimationFrame(tick);
      }
    }

    start = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(start);
  }, [target, duration, active]);

  return value;
}

// ── Section wrapper with intersection animation ──────────────────────
function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ── Confidence badge ─────────────────────────────────────────────────
function ConfidenceBadge({
  confiance,
}: {
  confiance: ParsedAnalysis["confiance"];
}) {
  if (!confiance) return null;
  const map = {
    "élevé": {
      bg: "rgba(45,106,79,0.1)",
      color: EMERALD,
      border: "rgba(45,106,79,0.25)",
      icon: ShieldCheck,
      label: "Confiance élevée",
    },
    moyen: {
      bg: "rgba(202,103,2,0.1)",
      color: AMBER,
      border: "rgba(202,103,2,0.25)",
      icon: AlertTriangle,
      label: "Confiance moyenne",
    },
    faible: {
      bg: "rgba(155,34,38,0.1)",
      color: BORDEAUX,
      border: "rgba(155,34,38,0.25)",
      icon: AlertTriangle,
      label: "Confiance faible",
    },
  };
  const c = map[confiance];
  const Icon = c.icon;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: c.color,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon style={{ width: 14, height: 14 }} />
      {c.label}
    </span>
  );
}

// ── Hero Section ─────────────────────────────────────────────────────
function HeroSection({
  value,
  echantillon,
  confiance,
  fiabilite,
}: {
  value: number;
  echantillon: number | null;
  confiance: ParsedAnalysis["confiance"];
  fiabilite: ParsedAnalysis["fiabilite"];
}) {
  const { ref, inView } = useInView(0.2);
  const counter = useAnimatedCounter(value, 2000, inView);
  const fiabCounter = useAnimatedCounter(fiabilite.score, 2200, inView);

  const verdict =
    value >= 60
      ? "Perspective favorable"
      : value >= 40
        ? "Issue incertaine"
        : "Perspective défavorable";

  const mainColor = pctColor(value);

  // Radial gradient: dark navy center blending out
  const bgGradient = `radial-gradient(ellipse at 50% 40%, ${NAVY}08 0%, transparent 70%)`;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        border: "1px solid rgba(30,58,95,0.08)",
        background: `linear-gradient(135deg, #faf9f7 0%, #f5f3ef 50%, #f0ede7 100%)`,
        padding: "48px 32px 40px",
      }}
    >
      {/* Subtle radial bg */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: bgGradient,
          pointerEvents: "none",
        }}
      />

      {/* Animated accent ring */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 280,
          height: 280,
          transform: "translate(-50%, -55%)",
          borderRadius: "50%",
          border: `2px solid ${mainColor}15`,
          animation: "dv-pulse-ring 4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", textAlign: "center" }}>
        {/* Title */}
        <p
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: NAVY,
            opacity: 0.5,
            marginBottom: 8,
          }}
        >
          Probabilité de succès
        </p>

        {/* Giant counter */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 4,
            animation: inView
              ? "dv-count-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards"
              : "none",
          }}
        >
          <span
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 112,
              fontWeight: 700,
              lineHeight: 1,
              color: mainColor,
              fontVariantNumeric: "tabular-nums",
              textShadow: `0 2px 40px ${mainColor}20`,
            }}
          >
            {counter}
          </span>
          <span
            style={{
              fontSize: 40,
              fontWeight: 500,
              color: mainColor,
              opacity: 0.6,
              marginLeft: 2,
            }}
          >
            %
          </span>
        </div>

        {/* Verdict */}
        <p
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 16,
            fontWeight: 500,
            color: NAVY,
            opacity: 0.7,
            marginTop: 8,
            letterSpacing: "0.01em",
          }}
        >
          {verdict}
        </p>

        {/* Divider line */}
        <div
          style={{
            width: 48,
            height: 2,
            background: `linear-gradient(90deg, ${GOLD}, ${mainColor})`,
            borderRadius: 1,
            margin: "20px auto 20px",
          }}
        />

        {/* Meta strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {echantillon !== null && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: NAVY,
                opacity: 0.6,
              }}
            >
              <BarChart3 style={{ width: 14, height: 14 }} />
              {echantillon} décisions analysées
            </span>
          )}
          <ConfidenceBadge confiance={confiance} />
          {fiabilite.score > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.02em",
                color: NAVY,
                backgroundColor: `${NAVY}0a`,
                border: `1px solid ${NAVY}18`,
              }}
            >
              <Target style={{ width: 14, height: 14 }} />
              Fiabilité : {fiabCounter}/100
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  suffix,
  icon: Icon,
  accentColor,
  delay = 0,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  accentColor: string;
  delay?: number;
}) {
  return (
    <AnimatedSection delay={delay}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid rgba(30,58,95,0.06)",
          backgroundColor: "#fff",
          padding: "22px 22px 20px",
          boxShadow:
            "0 1px 3px rgba(30,58,95,0.04), 0 6px 24px rgba(30,58,95,0.03)",
          transition: "box-shadow 0.3s ease, transform 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow =
            "0 4px 12px rgba(30,58,95,0.06), 0 12px 40px rgba(30,58,95,0.06)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow =
            "0 1px 3px rgba(30,58,95,0.04), 0 6px 24px rgba(30,58,95,0.03)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`,
            borderRadius: "16px 16px 0 0",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#94a3b8",
                margin: 0,
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 30,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.1,
                margin: "8px 0 0",
                color: "#1a1a2e",
              }}
            >
              {value}
              {suffix && (
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 400,
                    color: "#94a3b8",
                    marginLeft: 4,
                  }}
                >
                  {suffix}
                </span>
              )}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: `${accentColor}12`,
              flexShrink: 0,
            }}
          >
            <Icon
              style={{ width: 20, height: 20, color: accentColor }}
            />
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

// ── Section heading ──────────────────────────────────────────────────
function SectionHeading({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 20,
      }}
    >
      {Icon && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: `${NAVY}0a`,
          }}
        >
          <Icon style={{ width: 16, height: 16, color: NAVY }} />
        </div>
      )}
      <h3
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 17,
          fontWeight: 700,
          color: "#1a1a2e",
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </h3>
    </div>
  );
}

// ── Card wrapper ─────────────────────────────────────────────────────
function DashCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(30,58,95,0.06)",
        backgroundColor: "#fff",
        padding: 28,
        boxShadow:
          "0 1px 3px rgba(30,58,95,0.04), 0 6px 24px rgba(30,58,95,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Arguments horizontal bar chart ───────────────────────────────────
function ArgumentsChart({
  args,
}: {
  args: ParsedAnalysis["arguments"];
}) {
  const { ref, inView } = useInView();
  if (args.length === 0) return null;

  const sorted = [...args].sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0));
  const data = sorted.map((a) => ({
    name: a.name.length > 48 ? a.name.slice(0, 46) + "\…" : a.name,
    taux: a.taux ?? 0,
  }));

  return (
    <AnimatedSection>
      <DashCard>
        <SectionHeading icon={BarChart3}>
          Taux de succès par argument
        </SectionHeading>

        <div ref={ref} style={{ height: Math.max(240, args.length * 56) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 8, right: 56, top: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="dvBarGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={NAVY} />
                  <stop offset="100%" stopColor={GOLD} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#f1efe9"
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                fontSize={11}
                stroke="#cbd5e1"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={210}
                fontSize={12}
                tick={{ fill: "#475569" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [`${v} %`, "Taux de succès"]}
                contentStyle={{
                  borderRadius: 12,
                  border: "none",
                  boxShadow: "0 8px 32px rgba(30,58,95,0.12)",
                  fontSize: 13,
                  padding: "10px 16px",
                }}
                cursor={{ fill: "rgba(30,58,95,0.03)" }}
              />
              <Bar
                dataKey="taux"
                fill="url(#dvBarGrad)"
                radius={[0, 10, 10, 0]}
                barSize={30}
                isAnimationActive={inView}
                animationDuration={1200}
                animationEasing="ease-out"
                label={{
                  position: "right",
                  formatter: (v: unknown) => `${v}%`,
                  fontSize: 12,
                  fontWeight: 700,
                  fill: NAVY,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DashCard>
    </AnimatedSection>
  );
}

// ── Jurisdictions grid ───────────────────────────────────────────────
function JurisdictionsGrid({
  jurisdictions,
}: {
  jurisdictions: ParsedAnalysis["juridictions"];
}) {
  if (jurisdictions.length === 0) return null;

  return (
    <AnimatedSection>
      <DashCard>
        <SectionHeading icon={Landmark}>
          Analyse par juridiction
        </SectionHeading>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {jurisdictions.map((j, i) => {
            const taux = j.taux ?? 0;
            const color = pctColor(taux);
            return (
              <AnimatedSection key={j.name} delay={0.05 * i}>
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(30,58,95,0.06)",
                    backgroundColor: "#faf9f7",
                    padding: "18px 20px",
                    transition: "box-shadow 0.25s ease, transform 0.25s ease",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 16px rgba(30,58,95,0.06)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1a1a2e",
                        margin: 0,
                      }}
                    >
                      {j.name}
                    </p>
                    <span
                      style={{
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        fontSize: 20,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color,
                      }}
                    >
                      {taux}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      marginTop: 12,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: "#e8e5de",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 3,
                        width: `${taux}%`,
                        backgroundColor: color,
                        transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                  </div>

                  {j.delai && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 10,
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        color: NAVY,
                        opacity: 0.6,
                        backgroundColor: `${NAVY}08`,
                      }}
                    >
                      <Clock style={{ width: 11, height: 11 }} />
                      {j.delai}
                    </div>
                  )}
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </DashCard>
    </AnimatedSection>
  );
}

// ── Custom pie center label ──────────────────────────────────────────
function PieCenterLabel({
  cx,
  cy,
  total,
}: {
  cx: number;
  cy: number;
  total: number;
}) {
  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fill: "#1a1a2e",
        }}
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        instances
      </text>
    </g>
  );
}

// ── Instances donut ──────────────────────────────────────────────────
function InstancesDonut({
  instances,
}: {
  instances: ParsedAnalysis["instances"];
}) {
  if (instances.length === 0) return null;

  const data = instances.map((inst, i) => ({
    name: inst.name,
    value: inst.taux ?? 0,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const total = instances.length;

  return (
    <AnimatedSection>
      <DashCard>
        <SectionHeading icon={Target}>
          Répartition par instance
        </SectionHeading>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 240, height: 240, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                  animationDuration={1400}
                  animationEasing="ease-out"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${v} %`]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 8px 32px rgba(30,58,95,0.12)",
                    fontSize: 13,
                    padding: "10px 16px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label overlay */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#1a1a2e",
                  lineHeight: 1,
                }}
              >
                {total}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#94a3b8",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                instances
              </div>
            </div>
          </div>

          {/* Custom legend */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px 20px",
              marginTop: 20,
            }}
          >
            {data.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: entry.fill,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "#475569" }}>{entry.name}</span>
                <span
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: "#1a1a2e",
                  }}
                >
                  {entry.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </DashCard>
    </AnimatedSection>
  );
}

// ── Montants visual scale ────────────────────────────────────────────
function MontantsScale({
  montants,
}: {
  montants: ParsedAnalysis["montants"];
}) {
  if (
    montants.min === null &&
    montants.median === null &&
    montants.max === null
  )
    return null;

  const min = montants.min ?? 0;
  const max = montants.max ?? 0;
  const median = montants.median ?? 0;
  const range = max - min || 1;
  const medianPct = Math.min(92, Math.max(8, ((median - min) / range) * 100));

  return (
    <AnimatedSection>
      <DashCard>
        <SectionHeading icon={Banknote}>
          Fourchette des montants alloués
        </SectionHeading>

        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: "12px 8px 0",
          }}
        >
          {/* Three value markers */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            {/* Min */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#94a3b8",
                  marginBottom: 4,
                }}
              >
                Minimum
              </div>
              <div
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: EMERALD,
                }}
              >
                {fmt(montants.min)}
              </div>
            </div>

            {/* Median */}
            {montants.median !== null && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#94a3b8",
                    marginBottom: 4,
                  }}
                >
                  Médian
                </div>
                <div
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: 24,
                    fontWeight: 700,
                    color: NAVY,
                  }}
                >
                  {fmt(montants.median)}
                </div>
              </div>
            )}

            {/* Max */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#94a3b8",
                  marginBottom: 4,
                }}
              >
                Maximum
              </div>
              <div
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 18,
                  fontWeight: 700,
                  color: BORDEAUX,
                }}
              >
                {fmt(montants.max)}
              </div>
            </div>
          </div>

          {/* Gradient bar */}
          <div style={{ position: "relative", padding: "0 4px" }}>
            <div
              style={{
                height: 10,
                borderRadius: 5,
                background: `linear-gradient(90deg, ${EMERALD}, ${GOLD} 50%, ${BORDEAUX})`,
                position: "relative",
                boxShadow: `inset 0 1px 2px rgba(0,0,0,0.08)`,
              }}
            >
              {/* Min marker */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  border: `3px solid ${EMERALD}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
              />

              {/* Median marker */}
              {montants.median !== null && (
                <div
                  style={{
                    position: "absolute",
                    left: `${medianPct}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    border: `3px solid ${NAVY}`,
                    boxShadow: "0 2px 12px rgba(30,58,95,0.2)",
                    zIndex: 2,
                  }}
                />
              )}

              {/* Max marker */}
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translate(50%, -50%)",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  border: `3px solid ${BORDEAUX}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
              />
            </div>
          </div>
        </div>
      </DashCard>
    </AnimatedSection>
  );
}

// ── Fiabilite bar ────────────────────────────────────────────────────
function FiabiliteBar({
  fiabilite,
}: {
  fiabilite: ParsedAnalysis["fiabilite"];
}) {
  const { ref, inView } = useInView();
  const counter = useAnimatedCounter(fiabilite.score, 1600, inView);

  const barColor =
    fiabilite.score >= 80
      ? EMERALD
      : fiabilite.score >= 60
        ? NAVY
        : fiabilite.score >= 40
          ? AMBER
          : BORDEAUX;

  return (
    <AnimatedSection>
      <DashCard>
        <SectionHeading icon={ShieldCheck}>
          Indice de fiabilité
        </SectionHeading>

        <div ref={ref}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 40,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: barColor,
                lineHeight: 1,
              }}
            >
              {counter}
            </span>
            <span style={{ fontSize: 18, fontWeight: 500, color: "#94a3b8" }}>
              / 100
            </span>
            <span
              style={{
                marginLeft: 8,
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: barColor,
                backgroundColor: `${barColor}12`,
              }}
            >
              {fiabilite.label}
            </span>
          </div>

          {/* Bar */}
          <div
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#e8e5de",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 4,
                width: inView ? `${fiabilite.score}%` : "0%",
                background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                transition: "width 1.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>

          {fiabilite.details && (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              {fiabilite.details}
            </p>
          )}
        </div>
      </DashCard>
    </AnimatedSection>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────
export function AnalysisDashboard({ data }: { data: ParsedAnalysis }) {
  useEffect(() => {
    injectStyles();
  }, []);

  const hasStats =
    data.tauxSuccesGlobal !== null ||
    data.arguments.length > 0 ||
    data.juridictions.length > 0 ||
    data.instances.length > 0 ||
    data.montants.min !== null ||
    data.montants.max !== null;

  if (!hasStats) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* ── Dashboard header ──────────────────────────────── */}
      <AnimatedSection>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${NAVY}14, ${GOLD}14)`,
            }}
          >
            <Scale style={{ width: 22, height: 22, color: NAVY }} />
          </div>
          <div>
            <h2
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#1a1a2e",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Tableau de bord analytique
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "#94a3b8",
                margin: "2px 0 0",
              }}
            >
              Synthèse jurimétrique
              {data.sourceCount > 0 && ` \• ${data.sourceCount} sources`}
            </p>
          </div>
        </div>
      </AnimatedSection>

      {/* ── Hero section ──────────────────────────────────── */}
      {data.tauxSuccesGlobal !== null && (
        <HeroSection
          value={data.tauxSuccesGlobal}
          echantillon={data.echantillon}
          confiance={data.confiance}
          fiabilite={data.fiabilite}
        />
      )}

      {/* ── KPI strip ─────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {data.tauxSuccesGlobal !== null && (
          <KpiCard
            label="Taux de succès"
            value={`${data.tauxSuccesGlobal}`}
            suffix="%"
            icon={TrendingUp}
            accentColor={pctColor(data.tauxSuccesGlobal)}
            delay={0}
          />
        )}
        {data.echantillon !== null && (
          <KpiCard
            label="Décisions analysées"
            value={data.echantillon}
            icon={Users}
            accentColor={NAVY}
            delay={0.05}
          />
        )}
        {data.juridictions.length > 0 && (
          <KpiCard
            label="Juridictions"
            value={data.juridictions.length}
            icon={Landmark}
            accentColor={GOLD}
            delay={0.1}
          />
        )}
        {data.montants.median !== null && (
          <KpiCard
            label="Montant médian"
            value={new Intl.NumberFormat("fr-FR", {
              maximumFractionDigits: 0,
            }).format(data.montants.median)}
            suffix="\€"
            icon={Banknote}
            accentColor={EMERALD}
            delay={0.15}
          />
        )}
      </div>

      {/* ── Arguments chart ───────────────────────────────── */}
      <ArgumentsChart args={data.arguments} />

      {/* ── Jurisdictions + Instances row ──────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 24,
        }}
      >
        <JurisdictionsGrid jurisdictions={data.juridictions} />
        <InstancesDonut instances={data.instances} />
      </div>

      {/* ── Montants scale ────────────────────────────────── */}
      <MontantsScale montants={data.montants} />

      {/* ── Fiabilite ─────────────────────────────────────── */}
      {data.fiabilite.score > 0 && (
        <FiabiliteBar fiabilite={data.fiabilite} />
      )}
    </div>
  );
}
