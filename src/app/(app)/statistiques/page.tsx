"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stats/stat-card";
import { Sparkline } from "@/components/stats/sparkline";
import { JurisdictionChart } from "@/components/stats/jurisdiction-chart";
import { MotifChart } from "@/components/stats/motif-chart";
import { FileText, Scale, BarChart3, Clock } from "lucide-react";
import type { StatsGlobales, StatsParJuridiction, StatsParMotif } from "@/types/stats";

function mockTrend(current: number): number[] {
  return [current - 2, current - 1, current, current + 1, current + 2, current];
}

function detectTrend(data: number[]): "up" | "down" | "flat" {
  const first = data[0];
  const last = data[data.length - 1];
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
}

export default function StatistiquesPage() {
  const [global, setGlobal] = useState<StatsGlobales | null>(null);
  const [juridictions, setJuridictions] = useState<StatsParJuridiction[]>([]);
  const [motifs, setMotifs] = useState<StatsParMotif[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats?type=global").then((r) => r.json()),
      fetch("/api/stats?type=juridiction").then((r) => r.json()),
      fetch("/api/stats?type=motif").then((r) => r.json()),
    ]).then(([g, j, m]) => {
      setGlobal(g);
      setJuridictions(j);
      setMotifs(m);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-[#1e3a5f]">Statistiques</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble des tendances jurisprudentielles
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total decisions"
          value={global?.total_decisions ?? "\u2014"}
          subtitle="Decisions validees"
          icon={FileText}
          accentColor="#1e3a5f"
          sparkline={global ? (() => { const d = mockTrend(global.total_decisions); return <Sparkline data={d} trend={detectTrend(d)} />; })() : undefined}
        />
        <StatCard
          title="Taux d'annulation"
          value={global?.taux_annulation != null ? `${global.taux_annulation}%` : "\u2014"}
          subtitle="Sur l'ensemble"
          icon={Scale}
          accentColor="#c9a96e"
          sparkline={global?.taux_annulation != null ? (() => { const d = mockTrend(global.taux_annulation); return <Sparkline data={d} trend={detectTrend(d)} />; })() : undefined}
        />
        <StatCard
          title="Delai moyen"
          value={global?.delai_moyen_mois != null ? `${global.delai_moyen_mois} mois` : "\u2014"}
          subtitle="Pour statuer"
          icon={Clock}
          accentColor="#2d6a4f"
          sparkline={global?.delai_moyen_mois != null ? (() => { const d = mockTrend(global.delai_moyen_mois); return <Sparkline data={d} trend={detectTrend(d)} />; })() : undefined}
        />
        <StatCard
          title="Montant moyen"
          value={global?.montant_moyen != null ? `${global.montant_moyen.toLocaleString("fr-FR")} \u20AC` : "\u2014"}
          subtitle="Condamnations"
          icon={BarChart3}
          accentColor="#1e3a5f"
          sparkline={global?.montant_moyen != null ? (() => { const d = mockTrend(global.montant_moyen); return <Sparkline data={d} trend={detectTrend(d)} />; })() : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/40 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-[#1e3a5f]">Taux d&apos;annulation par juridiction</CardTitle>
          </CardHeader>
          <CardContent>
            <JurisdictionChart data={juridictions} />
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle className="font-serif text-[#1e3a5f]">Taux de succes par motif</CardTitle>
          </CardHeader>
          <CardContent>
            <MotifChart data={motifs} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
