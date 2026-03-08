"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MotifChart } from "@/components/stats/motif-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StatsParMotif } from "@/types/stats";

export default function MotifsPage() {
  const [data, setData] = useState<StatsParMotif[]>([]);

  useEffect(() => {
    fetch("/api/stats?type=motif")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Statistiques par motif d&apos;invalidité
        </h1>
        <p className="text-muted-foreground">
          Taux de succès selon le motif invoqué
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparaison des motifs</CardTitle>
        </CardHeader>
        <CardContent>
          <MotifChart data={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détail par motif</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motif</TableHead>
                <TableHead className="text-right">Fois invoqué</TableHead>
                <TableHead className="text-right">Succès</TableHead>
                <TableHead className="text-right">Taux de succès</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.motif}</TableCell>
                  <TableCell className="text-right">{row.nb_invoque}</TableCell>
                  <TableCell className="text-right">{row.nb_succes}</TableCell>
                  <TableCell className="text-right font-medium">
                    {row.taux_succes_pct != null
                      ? `${row.taux_succes_pct}%`
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
