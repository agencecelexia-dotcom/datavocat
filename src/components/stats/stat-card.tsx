import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  sparkline?: ReactNode;
  accentColor?: string;
}

export function StatCard({ title, value, subtitle, icon: Icon, sparkline, accentColor }: StatCardProps) {
  return (
    <Card
      className="border-border/40 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
      style={accentColor ? { borderLeftWidth: "4px", borderLeftColor: accentColor } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4" style={accentColor ? { color: accentColor } : undefined} />}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold text-[#1e3a5f]">{value}</div>
          {sparkline && <div className="ml-auto">{sparkline}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
