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
          <h1 className="font-serif text-3xl tracking-tight text-[#1e3a5f]">Décisions</h1>
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
            <SelectItem value="validated" className="cursor-pointer">Validées</SelectItem>
            <SelectItem value="error" className="cursor-pointer">Erreur</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-border/30 bg-card p-4" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : decisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f]/5">
            <Upload className="h-6 w-6 text-[#1e3a5f]/40" />
          </div>
          <p className="text-lg font-semibold text-foreground">Aucune décision</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Commencez par uploader un PDF de décision de justice ou importez depuis data.gouv.fr
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/decisions/upload">
              <Button className="cursor-pointer gap-2 bg-[#1e3a5f] text-white hover:bg-[#162d4a]">
                <Upload className="h-4 w-4" />
                Upload PDF
              </Button>
            </Link>
            <Link href="/decisions/import">
              <Button variant="outline" className="cursor-pointer gap-2">
                Importer
              </Button>
            </Link>
          </div>
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
            Précédent
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
