"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, ArrowRight, Trash2, Sparkles } from "lucide-react";

interface Analysis {
  id: string;
  query: string;
  status: string;
  created_at: string;
}

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

function SkeletonRow() {
  return (
    <div
      className="flex items-start gap-5 p-5"
      style={{ borderBottom: "1px solid var(--line-soft)" }}
    >
      <div
        className="h-4 w-16 animate-pulse rounded"
        style={{ background: "var(--paper)" }}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div
          className="h-4 w-2/3 animate-pulse rounded"
          style={{ background: "var(--paper)" }}
        />
        <div
          className="h-3 w-1/3 animate-pulse rounded"
          style={{ background: "var(--paper)" }}
        />
      </div>
      <div
        className="h-6 w-20 animate-pulse rounded"
        style={{ background: "var(--paper)" }}
      />
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
    if (!confirm("Supprimer cette analyse ? Cette action est irréversible.")) return;
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
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: "var(--gold)" }}
          >
            § Historique
          </span>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
          <span
            className="font-mono text-[10px] tabular-nums"
            style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
          >
            {loading ? "…" : `${analyses.length} analyse${analyses.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Title */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-serif text-[36px] lg:text-[40px] font-medium tracking-tight">
              Vos <span className="dv-italic">analyses</span> précédentes
            </h1>
            <p
              className="mt-2 text-[14px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Toutes vos saisines et rapports — archivés, chiffrés, exportables à tout moment.
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-medium rounded-md text-white cursor-pointer"
            style={{ background: "var(--ink)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nouvelle analyse</span>
            <span className="sm:hidden">Nouveau</span>
          </Link>
        </div>

        {loading ? (
          <div
            className="overflow-hidden rounded-md"
            style={{
              border: "1px solid var(--line)",
              background: "var(--card)",
            }}
          >
            {[...Array(5)].map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center rounded-md"
            style={{ border: "1px dashed var(--line)" }}
          >
            <p
              className="font-serif text-[22px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Aucune <span className="dv-italic">analyse</span> encore.
            </p>
            <p
              className="mt-2 max-w-sm text-[13px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Lancez votre première analyse jurimétrique pour voir l&apos;historique ici.
            </p>
            <Link
              href="/"
              className="mt-6 flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white rounded-md cursor-pointer"
              style={{ background: "var(--ink)" }}
            >
              Nouvelle analyse
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {analyses.map((a, i) => (
              <div
                key={a.id}
                className="group relative flex items-start gap-5 p-5 rounded-md transition-all"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                }}
              >
                <Link
                  href={`/historique/${a.id}`}
                  className="flex flex-1 items-start gap-5 min-w-0"
                >
                  {/* Numéro + date */}
                  <div className="shrink-0">
                    <div
                      className="font-mono text-[9px] uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      № {String(analyses.length - i).padStart(3, "0")}
                    </div>
                    <div
                      className="font-mono text-[10.5px] tabular-nums mt-0.5 flex items-center gap-1"
                      style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
                    >
                      <Clock className="h-3 w-3" />
                      {formatDate(a.created_at)}
                    </div>
                    <div
                      className="font-mono text-[10px] tabular-nums"
                      style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
                    >
                      {formatTime(a.created_at)}
                    </div>
                  </div>

                  {/* Title + snippet */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-serif text-[16px] font-medium leading-tight line-clamp-2"
                      style={{ color: "var(--ink)" }}
                    >
                      {cleanQuery(a.query)}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="shrink-0 flex items-center gap-3 text-right">
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.15em] px-2 py-0.5 rounded"
                      style={{
                        color:
                          a.status === "done"
                            ? "var(--emerald, #2d6a4f)"
                            : a.status === "error"
                              ? "var(--bordeaux, #9b2226)"
                              : "var(--muted-foreground)",
                        background: "var(--paper)",
                      }}
                    >
                      {a.status === "done"
                        ? "Terminé"
                        : a.status === "error"
                          ? "Erreur"
                          : "En cours"}
                    </span>
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                      style={{ color: "var(--muted-foreground)" }}
                    />
                  </div>
                </Link>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deleting === a.id}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  style={{
                    color: "var(--muted-foreground)",
                  }}
                  title="Supprimer"
                >
                  <Trash2
                    className={`h-3.5 w-3.5 ${deleting === a.id ? "animate-pulse" : ""}`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
