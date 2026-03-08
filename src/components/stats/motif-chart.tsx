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

interface MotifChartProps {
  data: StatsParMotif[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
];

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
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Pas encore de données
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="motif"
          tick={{ fontSize: 11 }}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis domain={[0, 100]} unit="%" />
        <Tooltip
          formatter={(value, name) => [
            `${value}%`,
            name === "taux_succes" ? "Taux de succès" : name,
          ]}
        />
        <Bar dataKey="taux_succes" radius={[4, 4, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
