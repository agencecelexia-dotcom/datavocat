"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface DecisionRow {
  id: string;
  juridiction: string | null;
  juridiction_type: string | null;
  juridiction_ville: string | null;
  date_decision: string | null;
  numero_rg: string | null;
  resultat: string | null;
  demandeur_type: string | null;
  status: string;
  extraction_confidence: number | null;
  created_at: string;
}

interface DecisionsTableProps {
  decisions: DecisionRow[];
}

const statusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    extracting: "outline",
    review: "default",
    validated: "default",
    error: "destructive",
  };
  const labels: Record<string, string> = {
    pending: "En attente",
    extracting: "Extraction...",
    review: "À valider",
    validated: "Validée",
    error: "Erreur",
  };
  return (
    <Badge variant={variants[status] || "secondary"}>
      {labels[status] || status}
    </Badge>
  );
};

const resultatBadge = (resultat: string | null) => {
  if (!resultat) return <span className="text-muted-foreground">—</span>;
  const colors: Record<string, string> = {
    annulation: "bg-green-100 text-green-800",
    validation: "bg-red-100 text-red-800",
    irrecevabilité: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[resultat] || ""}`}
    >
      {resultat.charAt(0).toUpperCase() + resultat.slice(1)}
    </span>
  );
};

export function DecisionsTable({ decisions }: DecisionsTableProps) {
  const router = useRouter();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Juridiction</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>N° RG</TableHead>
            <TableHead>Demandeur</TableHead>
            <TableHead>Résultat</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Confiance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {decisions.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Aucune décision trouvée
              </TableCell>
            </TableRow>
          )}
          {decisions.map((d) => (
            <TableRow
              key={d.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/decisions/${d.id}`)}
            >
              <TableCell className="font-medium">
                {d.juridiction || d.juridiction_type || "—"}
                {d.juridiction_ville && (
                  <span className="ml-1 text-muted-foreground">
                    ({d.juridiction_ville})
                  </span>
                )}
              </TableCell>
              <TableCell>
                {d.date_decision
                  ? new Date(d.date_decision).toLocaleDateString("fr-FR")
                  : "—"}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {d.numero_rg || "—"}
              </TableCell>
              <TableCell>{d.demandeur_type || "—"}</TableCell>
              <TableCell>{resultatBadge(d.resultat)}</TableCell>
              <TableCell>{statusBadge(d.status)}</TableCell>
              <TableCell className="text-right">
                {d.extraction_confidence !== null
                  ? `${Math.round(d.extraction_confidence * 100)}%`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
