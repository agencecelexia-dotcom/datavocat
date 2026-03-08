"use client";

import { LineChart, Line } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  trend?: "up" | "down" | "flat";
}

const TREND_COLORS = {
  up: "#2d6a4f",
  down: "#9b2226",
  flat: "#6b7280",
} as const;

export function Sparkline({ data, color, trend }: SparklineProps) {
  const strokeColor = trend ? TREND_COLORS[trend] : color ?? "#1e3a5f";
  const chartData = data.map((v, i) => ({ v, i }));

  return (
    <LineChart width={80} height={24} data={chartData}>
      <Line
        type="monotone"
        dataKey="v"
        stroke={strokeColor}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
