"use client";

import { useState, useEffect } from "react";
import { DecisionsTable } from "@/components/decisions/decisions-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [pendingValidation, setPendingValidation] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("datavocat_pending_validation");
    if (raw) {
      const n = parseInt(raw, 10);
      setPendingValidation(isNaN(n) ? null : n);
    }
  }, []);

  useEffect(() => {
    async function fetchDecisions() {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/decisions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDecisions(data.decisions);
        setTotal(data.total);
      }
      setLoading(false);
    }
    fetchDecisions();
  }, [page, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-[#1e3a5f]">Decisions</h1>
          <p className="text-muted-foreground">
            {total} decision{total !== 1 ? "s" : ""} dans la base
          </p>
        </div>
        <Link href="/decisions/upload">
          <Button className="cursor-pointer gap-2 bg-[#c9a96e] text-white transition-all duration-200 hover:bg-[#b8944f] hover:shadow-md">
            <Upload className="h-4 w-4" />
            Upload PDF
          </Button>
        </Link>
      </div>

      {pendingValidation != null && pendingValidation > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-[#2d6a4f]/20 bg-[#2d6a4f]/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-[#2d6a4f]">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              <strong>{pendingValidation}</strong> decision{pendingValidation > 1 ? "s" : ""} avec
              confiance &gt;90% en attente de validation
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer border-[#2d6a4f]/30 text-[#2d6a4f] transition-all duration-200 hover:bg-[#2d6a4f]/10"
            onClick={() => {
              setPendingValidation(0);
              localStorage.setItem("datavocat_pending_validation", "0");
            }}
          >
            Tout valider
          </Button>
        </div>
      )}

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-48 cursor-pointer border-border/40 bg-white transition-all duration-200 focus:border-[#1e3a5f]">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="cursor-pointer">Tous les statuts</SelectItem>
            <SelectItem value="pending" className="cursor-pointer">En attente</SelectItem>
            <SelectItem value="extracting" className="cursor-pointer">Extraction...</SelectItem>
            <SelectItem value="review" className="cursor-pointer">A valider</SelectItem>
            <SelectItem value="validated" className="cursor-pointer">Validees</SelectItem>
            <SelectItem value="error" className="cursor-pointer">Erreur</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Chargement...
        </div>
      ) : (
        <DecisionsTable decisions={decisions} />
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer transition-all duration-200"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Precedent
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} / {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            className="cursor-pointer transition-all duration-200"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
