"use client";

import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  sparkline?: ReactNode;
  accentColor?: string;
  trend?: { value: number; label?: string };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  sparkline,
  accentColor = "#1e3a5f",
  trend,
}: StatCardProps) {
  const trendUp = trend && trend.value > 0;
  const trendDown = trend && trend.value < 0;

  return (
    <Card className="group relative overflow-hidden border-border/40 bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      {/* Top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)` }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {title}
          </p>
          {Icon && (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: `${accentColor}10` }}
            >
              <Icon className="h-4.5 w-4.5" style={{ color: accentColor }} />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </span>
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                trendUp
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : trendDown
                  ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {trendUp ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>

        {/* Subtitle + sparkline */}
        <div className="mt-2 flex items-center justify-between">
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {sparkline && <div className="ml-auto">{sparkline}</div>}
        </div>
      </div>
    </Card>
  );
}
