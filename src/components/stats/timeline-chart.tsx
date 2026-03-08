"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TimelineDataPoint {
  annee: string;
  annulations: number;
  validations: number;
  total: number;
}

interface TimelineChartProps {
  data: TimelineDataPoint[];
}

export function TimelineChart({ data }: TimelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Pas encore de données temporelles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="annee" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="annulations"
          stroke="hsl(var(--chart-1))"
          name="Annulations"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="validations"
          stroke="hsl(var(--chart-3))"
          name="Validations"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="hsl(var(--chart-5))"
          name="Total"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
