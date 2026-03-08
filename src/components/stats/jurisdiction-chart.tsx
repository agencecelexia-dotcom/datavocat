"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { StatsParJuridiction } from "@/types/stats";

const NAVY = "#1e3a5f";
const GOLD = "#c9a96e";

interface JurisdictionChartProps {
  data: StatsParJuridiction[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { total: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-xl shadow-black/10">
      <p className="mb-1 text-sm font-semibold text-foreground">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-[#1e3a5f]">{payload[0].value}%</span>
        <span className="text-xs text-muted-foreground">d&apos;annulation</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {payload[0].payload.total} decision{payload[0].payload.total > 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function JurisdictionChart({ data }: JurisdictionChartProps) {
  const chartData = data
    .filter((d) => d.total_decisions >= 1)
    .map((d) => ({
      name: d.juridiction_ville
        ? `${d.juridiction_type} ${d.juridiction_ville}`
        : d.juridiction_type || "\u2014",
      taux_annulation: d.taux_annulation_pct || 0,
      total: d.total_decisions,
    }))
    .sort((a, b) => b.taux_annulation - a.taux_annulation);

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
        Pas encore de donnees
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 44)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
        <defs>
          <linearGradient id="barGradientJuridiction" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={NAVY} />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          unit="%"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={{ stroke: "hsl(var(--border))", opacity: 0.5 }}
          tickLine={false}
        />
        <YAxis
          dataKey="name"
          type="category"
          width={140}
          tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }} />
        <Bar dataKey="taux_annulation" radius={[0, 8, 8, 0]} barSize={28}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.taux_annulation >= 60 ? NAVY : entry.taux_annulation >= 30 ? GOLD : "#94a3b8"}
              opacity={0.9}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
