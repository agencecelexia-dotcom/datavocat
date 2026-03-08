"use client";

import {
  AreaChart,
  Area,
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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-xl shadow-black/10">
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-muted-foreground">{entry.name}</span>
          <span className="ml-auto text-sm font-bold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TimelineChart({ data }: TimelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
        Pas encore de donnees temporelles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
        <defs>
          <linearGradient id="gradientAnnulations" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradientValidations" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d6a4f" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#2d6a4f" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a96e" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#c9a96e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis
          dataKey="annee"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          axisLine={{ stroke: "hsl(var(--border))", opacity: 0.5 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="annulations"
          stroke="#1e3a5f"
          fill="url(#gradientAnnulations)"
          name="Annulations"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
        />
        <Area
          type="monotone"
          dataKey="validations"
          stroke="#2d6a4f"
          fill="url(#gradientValidations)"
          name="Validations"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#c9a96e"
          fill="url(#gradientTotal)"
          name="Total"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
