"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, Scale, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Analysis {
  id: string;
  query: string;
  status: string;
  created_at: string;
}

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-border/30 bg-card p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-xl bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export default function HistoriquePage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analyses?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setAnalyses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          Historique
        </h1>
        <p className="text-muted-foreground">
          Vos analyses jurimetriques precedentes
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <SkeletonRow key={i} delay={i * 80} />
          ))}
        </div>
      ) : analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f]/5">
            <Scale className="h-6 w-6 text-[#1e3a5f]/40" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            Aucune analyse
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
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
        <div className="space-y-3">
          {analyses.map((a, i) => (
            <Link key={a.id} href={`/historique/${a.id}`}>
              <Card
                className="group flex items-center gap-4 border-border/40 p-5 transition-all duration-200 hover:border-[#1e3a5f]/20 hover:shadow-md hover:-translate-y-px"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f]/5 transition-colors group-hover:bg-[#1e3a5f]/10">
                  <FileText className="h-4.5 w-4.5 text-[#1e3a5f]/60" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-[#1e3a5f]">
                    {a.query}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(a.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <Badge
                  variant={a.status === "done" ? "default" : "secondary"}
                  className={
                    a.status === "done"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : a.status === "error"
                      ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : ""
                  }
                >
                  {a.status === "done"
                    ? "Termine"
                    : a.status === "error"
                    ? "Erreur"
                    : "En cours"}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
