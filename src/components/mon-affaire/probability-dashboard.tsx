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
    if (score >= 60) return "text-[#2d6a4f]";
    if (score >= 40) return "text-[#ca6702]";
    return "text-[#9b2226]";
  };

  return (
    <div className="space-y-6">
      {/* Score principal */}
      <Card className="shadow-sm">
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
        <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#1e3a5f]">
              Taux de recevabilité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1e3a5f]">
              {result.taux_recevabilite != null
                ? `${result.taux_recevabilite}%`
                : "---"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#1e3a5f]">Délai moyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1e3a5f]">
              {result.delai_moyen != null
                ? `${result.delai_moyen} mois`
                : "---"}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm transition-shadow duration-200 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#1e3a5f]">
              Montant moyen condamnation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1e3a5f]">
              {result.montant_moyen != null
                ? `${result.montant_moyen.toLocaleString("fr-FR")} EUR`
                : "---"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Décisions similaires */}
      {result.decisions_proches && result.decisions_proches.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-[#1e3a5f]">Décisions les plus similaires</CardTitle>
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
        className="w-full cursor-pointer bg-[#c9a96e] text-white transition-all duration-200 hover:bg-[#b8944f]"
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
