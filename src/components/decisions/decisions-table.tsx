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

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  validated: {
    label: "Validee",
    bg: "bg-[#2d6a4f]/10",
    text: "text-[#2d6a4f]",
  },
  pending: {
    label: "En attente",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  extracting: {
    label: "Extraction...",
    bg: "bg-[#1e3a5f]/10",
    text: "text-[#1e3a5f]",
  },
  review: {
    label: "A valider",
    bg: "bg-[#1e3a5f]/10",
    text: "text-[#1e3a5f]",
  },
  error: {
    label: "Erreur",
    bg: "bg-[#9b2226]/10",
    text: "text-[#9b2226]",
  },
};

const statusBadge = (status: string) => {
  const config = statusConfig[status] || { label: status, bg: "bg-gray-100", text: "text-gray-700" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

const resultatBadge = (resultat: string | null) => {
  if (!resultat) return <span className="text-muted-foreground">{"\u2014"}</span>;
  const colors: Record<string, string> = {
    annulation: "bg-[#2d6a4f]/10 text-[#2d6a4f]",
    validation: "bg-[#9b2226]/10 text-[#9b2226]",
    irrecevabilité: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[resultat] || "bg-gray-100 text-gray-700"}`}
    >
      {resultat.charAt(0).toUpperCase() + resultat.slice(1)}
    </span>
  );
};

export function DecisionsTable({ decisions }: DecisionsTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-lg border border-border/40 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f8fafc] hover:bg-[#f8fafc]">
            <TableHead className="font-semibold text-[#1e3a5f]">Juridiction</TableHead>
            <TableHead className="font-semibold text-[#1e3a5f]">Date</TableHead>
            <TableHead className="font-semibold text-[#1e3a5f]">N RG</TableHead>
            <TableHead className="font-semibold text-[#1e3a5f]">Demandeur</TableHead>
            <TableHead className="font-semibold text-[#1e3a5f]">Resultat</TableHead>
            <TableHead className="font-semibold text-[#1e3a5f]">Statut</TableHead>
            <TableHead className="text-right font-semibold text-[#1e3a5f]">Confiance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {decisions.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                Aucune decision trouvee
              </TableCell>
            </TableRow>
          )}
          {decisions.map((d) => (
            <TableRow
              key={d.id}
              className="cursor-pointer transition-colors duration-200 hover:bg-gray-50"
              onClick={() => router.push(`/decisions/${d.id}`)}
            >
              <TableCell className="font-medium">
                {d.juridiction || d.juridiction_type || "\u2014"}
                {d.juridiction_ville && (
                  <span className="ml-1 text-muted-foreground">
                    ({d.juridiction_ville})
                  </span>
                )}
              </TableCell>
              <TableCell>
                {d.date_decision
                  ? new Date(d.date_decision).toLocaleDateString("fr-FR")
                  : "\u2014"}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {d.numero_rg || "\u2014"}
              </TableCell>
              <TableCell>{d.demandeur_type || "\u2014"}</TableCell>
              <TableCell>{resultatBadge(d.resultat)}</TableCell>
              <TableCell>{statusBadge(d.status)}</TableCell>
              <TableCell className="text-right">
                {d.extraction_confidence !== null
                  ? `${Math.round(d.extraction_confidence * 100)}%`
                  : "\u2014"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
