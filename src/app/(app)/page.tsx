"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stats/stat-card";
import { JurisdictionChart } from "@/components/stats/jurisdiction-chart";
import { DecisionsTable } from "@/components/decisions/decisions-table";
import { FileText, BarChart3, Scale, Clock } from "lucide-react";
import type { StatsGlobales, StatsParJuridiction } from "@/types/stats";

export default function DashboardPage() {
  const [global, setGlobal] = useState<StatsGlobales | null>(null);
  const [juridictions, setJuridictions] = useState<StatsParJuridiction[]>([]);
  const [recentDecisions, setRecentDecisions] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats?type=global").then((r) => r.json()),
      fetch("/api/stats?type=juridiction").then((r) => r.json()),
      fetch("/api/decisions?limit=5").then((r) => r.json()),
    ]).then(([g, j, d]) => {
      setGlobal(g);
      setJuridictions(Array.isArray(j) ? j : []);
      setRecentDecisions(d.decisions || []);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Vue d&apos;ensemble de votre base jurimétrique
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total décisions"
          value={global?.total_decisions ?? "—"}
          subtitle="Décisions analysées"
          icon={FileText}
        />
        <StatCard
          title="Taux d'annulation"
          value={global?.taux_annulation != null ? `${global.taux_annulation}%` : "—"}
          subtitle="Sur l'ensemble des décisions"
          icon={Scale}
        />
        <StatCard
          title="Délai moyen"
          value={global?.delai_moyen_mois != null ? `${global.delai_moyen_mois} mois` : "—"}
          subtitle="Pour statuer"
          icon={Clock}
        />
        <StatCard
          title="Montant moyen"
          value={global?.montant_moyen != null ? `${global.montant_moyen.toLocaleString("fr-FR")} €` : "—"}
          subtitle="Condamnations"
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Taux d&apos;annulation par juridiction</CardTitle>
          </CardHeader>
          <CardContent>
            <JurisdictionChart data={juridictions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Décisions récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDecisions.length > 0 ? (
              <DecisionsTable decisions={recentDecisions} />
            ) : (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                Aucune décision. Commencez par uploader un PDF.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
