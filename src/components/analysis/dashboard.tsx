"use client";

import { ParsedAnalysis } from "@/lib/parse-analysis";
import { Card } from "@/components/ui/card";
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
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  TrendingUp,
  Scale,
  Users,
  Landmark,
  Banknote,
  ShieldCheck,
  AlertTriangle,
  CircleDot,
} from "lucide-react";

// ── Palette ──────────────────────────────────────────────────────────
const NAVY = "#1e3a5f";
const GOLD = "#c9a96e";
const EMERALD = "#2d6a4f";
const VIOLET = "#7c3aed";
const AMBER = "#ca6702";
const LIGHT_NAVY = "#5b8ec9";
const BORDEAUX = "#9b2226";

const PIE_COLORS = [NAVY, GOLD, EMERALD, VIOLET, AMBER, LIGHT_NAVY, BORDEAUX];

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (v: number | null) =>
  v !== null
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v)
    : "—";

function pctColor(pct: number): string {
  if (pct >= 60) return EMERALD;
  if (pct >= 40) return AMBER;
  return BORDEAUX;
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
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: ShieldCheck,
      label: "Confiance élevée",
    },
    moyen: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: AlertTriangle,
      label: "Confiance moyenne",
    },
    faible: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: AlertTriangle,
      label: "Confiance faible",
    },
  };
  const c = map[confiance];
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${c.bg} ${c.text} ${c.border}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}

// ── Hero gauge (semi-circle) ─────────────────────────────────────────
function HeroGauge({
  value,
  echantillon,
  confiance,
}: {
  value: number;
  echantillon: number | null;
  confiance: ParsedAnalysis["confiance"];
}) {
  const gaugeData = [{ name: "score", value, fill: pctColor(value) }];
  const verdict =
    value >= 60
      ? "Perspective favorable"
      : value >= 40
        ? "Issue incertaine"
        : "Perspective défavorable";

  return (
    <Card className="px-6 pb-6 pt-8">
      <div className="flex flex-col items-center">
        <h3 className="font-serif text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Probabilité de succès
        </h3>

        {/* Semi-circle gauge */}
        <div className="relative mx-auto mt-4 h-[160px] w-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="100%"
              innerRadius="65%"
              outerRadius="100%"
              startAngle={180}
              endAngle={0}
              data={gaugeData}
              barSize={20}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: "#e8e5de" }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-x-0 bottom-0 text-center">
            <span
              className="font-serif text-6xl font-bold tabular-nums"
              style={{ color: pctColor(value) }}
            >
              {value}
            </span>
            <span className="ml-1 text-2xl font-medium text-muted-foreground">
              %
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm font-medium text-muted-foreground">
          {verdict}
        </p>

        {/* Meta strip */}
        <div className="mt-4 flex items-center gap-4">
          {echantillon !== null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CircleDot className="h-3 w-3" />
              {echantillon} décisions analysées
            </span>
          )}
          <ConfidenceBadge confiance={confiance} />
        </div>
      </div>
    </Card>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  suffix,
  icon: Icon,
  borderColor,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  borderColor: string;
}) {
  return (
    <Card className="relative overflow-hidden py-5 pl-5 pr-4">
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
        style={{ backgroundColor: borderColor }}
      />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 font-serif text-3xl font-bold tabular-nums leading-none">
            {value}
            {suffix && (
              <span className="ml-1 text-base font-normal text-muted-foreground">
                {suffix}
              </span>
            )}
          </p>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: borderColor + "14" }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color: borderColor }} />
        </div>
      </div>
    </Card>
  );
}

// ── Arguments horizontal bar chart ───────────────────────────────────
function ArgumentsChart({
  args,
}: {
  args: ParsedAnalysis["arguments"];
}) {
  if (args.length === 0) return null;

  const sorted = [...args].sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0));
  const data = sorted.map((a) => ({
    name: a.name.length > 40 ? a.name.slice(0, 38) + "…" : a.name,
    taux: a.taux ?? 0,
  }));

  return (
    <Card className="p-6">
      <h3 className="mb-6 font-serif text-base font-semibold">
        Taux de succès par argument
      </h3>
      <div style={{ height: Math.max(220, args.length * 52) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 50, top: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={NAVY} />
                <stop offset="100%" stopColor={GOLD} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#e5e2db"
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              fontSize={11}
              stroke="#94a3b8"
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={200}
              fontSize={12}
              tick={{ fill: "#334155" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, "Taux de succes"]}
              contentStyle={{
                borderRadius: 10,
                border: "none",
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                fontSize: 13,
              }}
            />
            <Bar
              dataKey="taux"
              fill="url(#barGradient)"
              radius={[0, 8, 8, 0]}
              barSize={28}
              label={{
                position: "right",
                formatter: (v: unknown) => `${v}%`,
                fontSize: 12,
                fontWeight: 600,
                fill: NAVY,
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
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
    <Card className="p-6">
      <h3 className="mb-5 font-serif text-base font-semibold">
        Analyse par juridiction
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jurisdictions.map((j) => {
          const taux = j.taux ?? 0;
          const color = pctColor(taux);
          return (
            <div
              key={j.name}
              className="rounded-xl border border-border/60 bg-muted/30 p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{j.name}</p>
                <span
                  className="font-serif text-lg font-bold tabular-nums"
                  style={{ color }}
                >
                  {taux}%
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${taux}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              {j.delai && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Délai moyen : {j.delai}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
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

  return (
    <Card className="p-6">
      <h3 className="mb-4 font-serif text-base font-semibold">
        Répartition par instance
      </h3>
      <div className="flex items-center justify-center gap-6">
        <div className="h-[200px] w-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [`${v}%`]}
                contentStyle={{
                  borderRadius: 10,
                  border: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Custom legend */}
        <div className="flex flex-col gap-2.5">
          {data.map((entry, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-sm text-foreground">{entry.name}</span>
              <span className="ml-auto font-serif text-sm font-bold tabular-nums">
                {entry.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
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

  // Position median on the bar (clamped 5-95%)
  const medianPct = Math.min(95, Math.max(5, ((median - min) / range) * 100));

  return (
    <Card className="p-6">
      <h3 className="mb-6 font-serif text-base font-semibold">
        Fourchette des montants alloués
      </h3>

      <div className="relative mx-auto max-w-lg px-4">
        {/* Labels above markers */}
        <div className="relative mb-2 h-14">
          {/* Min label */}
          <div className="absolute left-0 text-center" style={{ transform: "translateX(-50%)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Min
            </p>
            <p className="mt-0.5 text-sm font-bold" style={{ color: EMERALD }}>
              {fmt(montants.min)}
            </p>
          </div>

          {/* Median label */}
          {montants.median !== null && (
            <div
              className="absolute text-center"
              style={{
                left: `${medianPct}%`,
                transform: "translateX(-50%)",
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Médian
              </p>
              <p className="mt-0.5 text-lg font-bold" style={{ color: NAVY }}>
                {fmt(montants.median)}
              </p>
            </div>
          )}

          {/* Max label */}
          <div className="absolute right-0 text-center" style={{ transform: "translateX(50%)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Max
            </p>
            <p className="mt-0.5 text-sm font-bold" style={{ color: BORDEAUX }}>
              {fmt(montants.max)}
            </p>
          </div>
        </div>

        {/* Gradient bar */}
        <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-red-500">
          {/* Min marker */}
          <div
            className="absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-md"
            style={{ left: "0%" }}
          />
          {/* Median marker */}
          {montants.median !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${medianPct}%` }}
            >
              <div className="h-6 w-2 -translate-x-1/2 rounded-full bg-white shadow-lg"
                style={{ border: `2px solid ${NAVY}` }}
              />
            </div>
          )}
          {/* Max marker */}
          <div
            className="absolute right-0 top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-md"
          />
        </div>
      </div>
    </Card>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────
export function AnalysisDashboard({ data }: { data: ParsedAnalysis }) {
  const hasStats =
    data.tauxSuccesGlobal !== null ||
    data.arguments.length > 0 ||
    data.juridictions.length > 0 ||
    data.instances.length > 0 ||
    data.montants.min !== null ||
    data.montants.max !== null;

  if (!hasStats) return null;

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: NAVY + "12" }}
        >
          <Scale className="h-5 w-5" style={{ color: NAVY }} />
        </div>
        <h2 className="font-serif text-xl font-bold tracking-tight">
          Tableau de bord analytique
        </h2>
      </div>

      {/* ── Hero gauge ──────────────────────────────────── */}
      {data.tauxSuccesGlobal !== null && (
        <HeroGauge
          value={data.tauxSuccesGlobal}
          echantillon={data.echantillon}
          confiance={data.confiance}
        />
      )}

      {/* ── KPI strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.tauxSuccesGlobal !== null && (
          <KpiCard
            label="Taux de succès"
            value={`${data.tauxSuccesGlobal}`}
            suffix="%"
            icon={TrendingUp}
            borderColor={pctColor(data.tauxSuccesGlobal)}
          />
        )}
        {data.echantillon !== null && (
          <KpiCard
            label="Décisions analysées"
            value={data.echantillon}
            icon={Users}
            borderColor={VIOLET}
          />
        )}
        {data.juridictions.length > 0 && (
          <KpiCard
            label="Juridictions"
            value={data.juridictions.length}
            icon={Landmark}
            borderColor={LIGHT_NAVY}
          />
        )}
        {data.montants.median !== null && (
          <KpiCard
            label="Montant médian"
            value={new Intl.NumberFormat("fr-FR", {
              maximumFractionDigits: 0,
            }).format(data.montants.median)}
            suffix="€"
            icon={Banknote}
            borderColor={GOLD}
          />
        )}
      </div>

      {/* ── Arguments chart ─────────────────────────────── */}
      <ArgumentsChart args={data.arguments} />

      {/* ── Jurisdictions + Instances row ────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <JurisdictionsGrid jurisdictions={data.juridictions} />
        <InstancesDonut instances={data.instances} />
      </div>

      {/* ── Montants scale ──────────────────────────────── */}
      <MontantsScale montants={data.montants} />
    </div>
  );
}
