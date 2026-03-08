"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JurisdictionChart } from "@/components/stats/jurisdiction-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StatsParJuridiction } from "@/types/stats";

export default function JuridictionsPage() {
  const [data, setData] = useState<StatsParJuridiction[]>([]);

  useEffect(() => {
    fetch("/api/stats?type=juridiction")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Statistiques par juridiction
        </h1>
        <p className="text-muted-foreground">
          Comparaison des taux d&apos;annulation entre juridictions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Taux d&apos;annulation</CardTitle>
        </CardHeader>
        <CardContent>
          <JurisdictionChart data={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détail par juridiction</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Annulations</TableHead>
                <TableHead className="text-right">Taux</TableHead>
                <TableHead className="text-right">Délai moyen</TableHead>
                <TableHead className="text-right">Montant moyen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    {row.juridiction_type || "—"}
                  </TableCell>
                  <TableCell>{row.juridiction_ville || "—"}</TableCell>
                  <TableCell className="text-right">
                    {row.total_decisions}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.nb_annulations}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {row.taux_annulation_pct != null
                      ? `${row.taux_annulation_pct}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.delai_moyen_mois != null
                      ? `${row.delai_moyen_mois} mois`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.montant_moyen_condamnation != null
                      ? `${row.montant_moyen_condamnation.toLocaleString("fr-FR")} €`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
