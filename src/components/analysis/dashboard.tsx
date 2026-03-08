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
  TrendingDown,
  Minus,
  Scale,
  Users,
  Landmark,
  Banknote,
  ShieldCheck,
  AlertTriangle,
  Info,
} from "lucide-react";

const COLORS = [
  "hsl(221, 83%, 53%)", // blue-600
  "hsl(250, 56%, 57%)", // violet
  "hsl(173, 58%, 39%)", // teal
  "hsl(43, 96%, 56%)",  // amber
  "hsl(349, 89%, 60%)", // rose
  "hsl(199, 89%, 48%)", // sky
  "hsl(142, 71%, 45%)", // green
  "hsl(280, 67%, 50%)", // purple
];

const GAUGE_COLOR = "hsl(221, 83%, 53%)";
const GAUGE_BG = "hsl(220, 14%, 90%)";

interface DashboardProps {
  data: ParsedAnalysis;
}

function KpiCard({
  label,
  value,
  suffix,
  icon: Icon,
  trend,
  color,
}: {
  label: string;
  value: string | number | null;
  suffix?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  if (value === null || value === undefined) return null;
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
        ? "text-rose-500"
        : "text-muted-foreground";

  return (
    <Card className="relative overflow-hidden p-5">
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color || GAUGE_COLOR }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {value}
            {suffix && (
              <span className="ml-1 text-lg font-normal text-muted-foreground">
                {suffix}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {trend && <TrendIcon className={`h-4 w-4 ${trendColor}`} />}
          <Icon className="h-5 w-5 text-muted-foreground/60" />
        </div>
      </div>
    </Card>
  );
}

function GaugeChart({ value }: { value: number }) {
  const data = [
    { name: "score", value, fill: GAUGE_COLOR },
    { name: "rest", value: 100 - value, fill: GAUGE_BG },
  ];

  return (
    <div className="relative mx-auto h-40 w-40">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="100%"
          innerRadius="70%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
          data={[data[0]]}
          barSize={14}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={8}
            background={{ fill: GAUGE_BG }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <span className="text-3xl font-bold">{value}%</span>
      </div>
    </div>
  );
}

function ArgumentsChart({
  args,
}: {
  args: ParsedAnalysis["arguments"];
}) {
  if (args.length === 0) return null;
  const data = args.map((a, i) => ({
    name: a.name.length > 30 ? a.name.slice(0, 28) + "..." : a.name,
    taux: a.taux ?? 0,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Taux de succes par argument
      </h3>
      <div style={{ height: Math.max(200, args.length * 48) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              fontSize={11}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              fontSize={11}
              tick={{ fill: "hsl(var(--foreground))" }}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, "Taux de succes"]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            <Bar dataKey="taux" radius={[0, 6, 6, 0]} barSize={24}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function JurisdictionsChart({
  jurisdictions,
}: {
  jurisdictions: ParsedAnalysis["juridictions"];
}) {
  if (jurisdictions.length === 0) return null;
  const data = jurisdictions.map((j) => ({
    name: j.name,
    taux: j.taux ?? 0,
  }));

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Taux par juridiction
      </h3>
      <div style={{ height: Math.max(180, jurisdictions.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              fontSize={11}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              fontSize={11}
              tick={{ fill: "hsl(var(--foreground))" }}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, "Taux"]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            <Bar dataKey="taux" fill="hsl(173, 58%, 39%)" radius={[0, 6, 6, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function InstancesPie({
  instances,
}: {
  instances: ParsedAnalysis["instances"];
}) {
  if (instances.length === 0) return null;
  const data = instances.map((inst, i) => ({
    name: inst.name,
    value: inst.taux ?? 0,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Repartition par instance
      </h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}%`}
              labelLine={false}
              fontSize={11}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [`${v}%`]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function MontantsCard({
  montants,
}: {
  montants: ParsedAnalysis["montants"];
}) {
  if (!montants.min && !montants.median && !montants.max) return null;
  const fmt = (v: number | null) =>
    v !== null
      ? new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(v)
      : "—";

  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Fourchette de montants
      </h3>
      <div className="flex items-end justify-between gap-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Min</p>
          <p className="mt-1 text-lg font-semibold text-emerald-600">
            {fmt(montants.min)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Median</p>
          <p className="mt-1 text-2xl font-bold">{fmt(montants.median)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Max</p>
          <p className="mt-1 text-lg font-semibold text-rose-600">
            {fmt(montants.max)}
          </p>
        </div>
      </div>
      {/* Visual bar */}
      {montants.min !== null && montants.max !== null && (
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-rose-400 opacity-80" />
      )}
    </Card>
  );
}

function ConfidenceBadge({
  confiance,
  echantillon,
}: {
  confiance: ParsedAnalysis["confiance"];
  echantillon: number | null;
}) {
  const config = {
    "élevé": { color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: ShieldCheck },
    moyen: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertTriangle },
    faible: { color: "bg-rose-100 text-rose-800 border-rose-200", icon: AlertTriangle },
  };

  const c = confiance ? config[confiance] : null;
  const Icon = c?.icon ?? Info;

  return (
    <div className="flex items-center gap-3">
      {c && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${c.color}`}
        >
          <Icon className="h-3.5 w-3.5" />
          Confiance {confiance}
        </span>
      )}
      {echantillon && (
        <span className="text-xs text-muted-foreground">
          {echantillon} decisions analysees
        </span>
      )}
    </div>
  );
}

export function AnalysisDashboard({ data }: DashboardProps) {
  const hasStats =
    data.tauxSuccesGlobal !== null ||
    data.arguments.length > 0 ||
    data.juridictions.length > 0 ||
    data.instances.length > 0 ||
    (data.montants.min !== null || data.montants.max !== null);

  if (!hasStats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Scale className="h-5 w-5 text-primary" />
          Tableau de bord analytique
        </h2>
        <ConfidenceBadge
          confiance={data.confiance}
          echantillon={data.echantillon}
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.tauxSuccesGlobal !== null && (
          <KpiCard
            label="Taux de succes global"
            value={data.tauxSuccesGlobal}
            suffix="%"
            icon={TrendingUp}
            trend={
              data.tauxSuccesGlobal > 60
                ? "up"
                : data.tauxSuccesGlobal < 40
                  ? "down"
                  : "neutral"
            }
            color={
              data.tauxSuccesGlobal > 60
                ? "hsl(142, 71%, 45%)"
                : data.tauxSuccesGlobal < 40
                  ? "hsl(349, 89%, 60%)"
                  : "hsl(43, 96%, 56%)"
            }
          />
        )}
        {data.echantillon !== null && (
          <KpiCard
            label="Decisions analysees"
            value={data.echantillon}
            icon={Users}
            color="hsl(250, 56%, 57%)"
          />
        )}
        {data.juridictions.length > 0 && (
          <KpiCard
            label="Juridictions"
            value={data.juridictions.length}
            icon={Landmark}
            color="hsl(173, 58%, 39%)"
          />
        )}
        {data.montants.median !== null && (
          <KpiCard
            label="Montant median"
            value={new Intl.NumberFormat("fr-FR", {
              maximumFractionDigits: 0,
            }).format(data.montants.median)}
            suffix="EUR"
            icon={Banknote}
            color="hsl(199, 89%, 48%)"
          />
        )}
      </div>

      {/* Gauge + charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.tauxSuccesGlobal !== null && (
          <Card className="flex flex-col items-center justify-center p-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Probabilite de succes
            </h3>
            <GaugeChart value={data.tauxSuccesGlobal} />
            <p className="mt-2 text-sm text-muted-foreground">
              {data.tauxSuccesGlobal >= 60
                ? "Perspective favorable"
                : data.tauxSuccesGlobal >= 40
                  ? "Issue incertaine"
                  : "Perspective defavorable"}
            </p>
          </Card>
        )}
        <InstancesPie instances={data.instances} />
        <MontantsCard montants={data.montants} />
      </div>

      {/* Detailed charts */}
      <ArgumentsChart args={data.arguments} />
      <JurisdictionsChart jurisdictions={data.juridictions} />
    </div>
  );
}
