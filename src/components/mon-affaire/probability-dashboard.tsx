"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import type { ScoreAffaireSimilaire } from "@/types/stats";

interface ProbabilityDashboardProps {
  result: ScoreAffaireSimilaire;
  onGenerateReport: () => void;
  reportLoading?: boolean;
}

export function ProbabilityDashboard({
  result,
  onGenerateReport,
  reportLoading,
}: ProbabilityDashboardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Score principal */}
      <Card>
        <CardContent className="flex flex-col items-center py-8">
          <p className="mb-2 text-sm text-muted-foreground">
            Probabilité de succès estimée
          </p>
          <div
            className={`text-6xl font-bold ${getScoreColor(result.taux_annulation)}`}
          >
            {result.taux_annulation != null
              ? `${result.taux_annulation}%`
              : "—"}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Basé sur {result.total_similaires} décision
            {result.total_similaires !== 1 ? "s" : ""} similaire
            {result.total_similaires !== 1 ? "s" : ""}
          </p>
          {result.total_similaires < 5 && (
            <Badge variant="secondary" className="mt-2">
              Échantillon limité — résultats indicatifs
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Métriques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Taux de recevabilité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {result.taux_recevabilite != null
                ? `${result.taux_recevabilite}%`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Délai moyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {result.delai_moyen != null
                ? `${result.delai_moyen} mois`
                : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Montant moyen condamnation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {result.montant_moyen != null
                ? `${result.montant_moyen.toLocaleString("fr-FR")} €`
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Décisions similaires */}
      {result.decisions_proches && result.decisions_proches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Décisions les plus similaires</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Juridiction</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>N° RG</TableHead>
                  <TableHead>Résultat</TableHead>
                  <TableHead className="text-right">Similarité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.decisions_proches.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.juridiction || "—"}
                    </TableCell>
                    <TableCell>
                      {d.date
                        ? new Date(d.date).toLocaleDateString("fr-FR")
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {d.numero_rg || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.resultat === "annulation" ? "default" : "secondary"
                        }
                      >
                        {d.resultat}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{d.score}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bouton rapport */}
      <Button
        onClick={onGenerateReport}
        size="lg"
        className="w-full"
        disabled={reportLoading}
      >
        <FileText className="mr-2 h-4 w-4" />
        {reportLoading
          ? "Génération en cours..."
          : "Générer le rapport stratégique"}
      </Button>
    </div>
  );
}
