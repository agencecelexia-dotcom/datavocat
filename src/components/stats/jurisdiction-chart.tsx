"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { StatsParJuridiction } from "@/types/stats";

interface JurisdictionChartProps {
  data: StatsParJuridiction[];
}

export function JurisdictionChart({ data }: JurisdictionChartProps) {
  const chartData = data
    .filter((d) => d.total_decisions >= 1)
    .map((d) => ({
      name: d.juridiction_ville
        ? `${d.juridiction_type} ${d.juridiction_ville}`
        : d.juridiction_type || "—",
      taux_annulation: d.taux_annulation_pct || 0,
      total: d.total_decisions,
    }))
    .sort((a, b) => b.taux_annulation - a.taux_annulation);

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Pas encore de données
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} unit="%" />
        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [`${value}%`, "Taux d'annulation"]}
          labelFormatter={(label) => `${label}`}
        />
        <Bar dataKey="taux_annulation" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
