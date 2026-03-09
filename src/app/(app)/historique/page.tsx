"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, FileText, Scale, ArrowRight, Gavel, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Analysis {
  id: string;
  query: string;
  status: string;
  created_at: string;
  jugement_resultat: "favorable" | "partiellement_favorable" | "defavorable" | null;
}

/** Strip enriched query parts (PRECISIONS COMPLEMENTAIRES, QUESTION COMPLEMENTAIRE) */
function cleanQuery(query: string): string {
  return query
    .replace(/\n\nPRECISIONS COMPLEMENTAIRES\s*:[\s\S]*/i, "")
    .replace(/\n\nQUESTION COMPLEMENTAIRE\s*:[\s\S]*/i, "")
    .trim();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-slate-100" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

export default function HistoriquePage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analyses?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setAnalyses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette analyse ? Cette action est irreversible.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAnalyses((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-2 sm:space-y-6 sm:px-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-slate-900 sm:text-3xl">
            Historique
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? "Chargement..."
              : `${analyses.length} analyse${analyses.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/">
          <Button
            size="sm"
            className="cursor-pointer gap-1.5 bg-[#1e3a5f] text-white shadow-sm hover:bg-[#162d4a]"
          >
            <span className="hidden sm:inline">Nouvelle analyse</span>
            <span className="sm:hidden">Nouveau</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <SkeletonRow key={i} delay={i * 60} />
          ))}
        </div>
      ) : analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f]/5">
            <Scale className="h-6 w-6 text-[#1e3a5f]/30" />
          </div>
          <p className="text-lg font-semibold text-slate-800">
            Aucune analyse
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Lancez votre premiere analyse jurimetrique pour voir l&apos;historique ici.
          </p>
          <Link href="/" className="mt-5">
            <Button className="cursor-pointer gap-2 bg-[#1e3a5f] text-white hover:bg-[#162d4a]">
              Nouvelle analyse
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {analyses.map((a, i) => (
            <div
              key={a.id}
              className={`group flex items-center gap-2 px-3 py-3 transition-colors duration-150 hover:bg-slate-50 sm:gap-4 sm:px-5 sm:py-3.5 ${
                i > 0 ? "border-t border-slate-100" : ""
              }`}
            >
              {/* Link area (icon + content + badges + chevron) */}
              <Link
                href={`/historique/${a.id}`}
                className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4"
              >
                {/* Icon */}
                <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/5 transition-colors group-hover:bg-[#1e3a5f]/10 sm:flex">
                  <FileText className="h-4 w-4 text-[#1e3a5f]/60" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 group-hover:text-[#1e3a5f]">
                    {cleanQuery(a.query)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(a.created_at)}</span>
                    <span className="text-slate-300">&middot;</span>
                    <span>{formatTime(a.created_at)}</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  {a.jugement_resultat && (
                    <span
                      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        a.jugement_resultat === "favorable"
                          ? "bg-emerald-50 text-emerald-700"
                          : a.jugement_resultat === "partiellement_favorable"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      <Gavel className="h-3 w-3" />
                      {a.jugement_resultat === "favorable"
                        ? "Favorable"
                        : a.jugement_resultat === "partiellement_favorable"
                          ? "Partiel"
                          : "Defavorable"}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      a.status === "done"
                        ? "bg-emerald-50 text-emerald-600"
                        : a.status === "error"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {a.status === "done"
                      ? "Termine"
                      : a.status === "error"
                        ? "Erreur"
                        : "En cours"}
                  </span>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
              </Link>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(a.id)}
                disabled={deleting === a.id}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-300 opacity-100 transition-all hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
                title="Supprimer"
              >
                <Trash2 className={`h-3.5 w-3.5 ${deleting === a.id ? "animate-pulse" : ""}`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
