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
import type { StatsParMotif } from "@/types/stats";

const COLORS = ["#1e3a5f", "#c9a96e", "#2d6a4f", "#7c3aed", "#ca6702", "#5b8ec9", "#9b2226"];

interface MotifChartProps {
  data: StatsParMotif[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { nb_invoque: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-xl shadow-black/10">
      <p className="mb-1 max-w-[200px] text-sm font-semibold leading-tight text-foreground">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-[#1e3a5f]">{payload[0].value}%</span>
        <span className="text-xs text-muted-foreground">de succes</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Invoque {payload[0].payload.nb_invoque} fois
      </p>
    </div>
  );
}

export function MotifChart({ data }: MotifChartProps) {
  const chartData = data
    .filter((d) => d.nb_invoque > 0)
    .map((d) => ({
      motif: d.motif,
      taux_succes: d.taux_succes_pct || 0,
      nb_invoque: d.nb_invoque,
    }))
    .sort((a, b) => b.taux_succes - a.taux_succes);

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
        Pas encore de donnees
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={chartData} margin={{ left: 10, right: 10, top: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
        <XAxis
          dataKey="motif"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          angle={-25}
          textAnchor="end"
          height={70}
          axisLine={{ stroke: "hsl(var(--border))", opacity: 0.5 }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          unit="%"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }} />
        <Bar dataKey="taux_succes" radius={[6, 6, 0, 0]} barSize={36}>
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
