"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, Scale, ArrowRight, User, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Analysis {
  id: string;
  query: string;
  status: string;
  created_at: string;
  client_id: string | null;
  client_name?: string | null;
  jugement_resultat: "favorable" | "partiellement_favorable" | "defavorable" | null;
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
    Promise.all([
      fetch("/api/analyses?limit=50").then((r) => r.json()),
      fetch("/api/clients").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([data, clients]) => {
        const clientMap: Record<string, string> = {};
        for (const c of clients) {
          clientMap[c.id] = `${c.prenom} ${c.nom}`;
        }
        const enriched = (Array.isArray(data) ? data : []).map((a: Analysis) => ({
          ...a,
          client_name: a.client_id ? clientMap[a.client_id] || null : null,
        }));
        setAnalyses(enriched);
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
          Vos analyses jurimétriques précédentes
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
            Lancez votre première analyse jurimétrique pour voir l&apos;historique ici.
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
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(a.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {a.client_name && (
                      <span className="flex items-center gap-1 rounded-full bg-[#1e3a5f]/5 px-2 py-0.5 text-[#1e3a5f]">
                        <User className="h-3 w-3" />
                        {a.client_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.jugement_resultat && (
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        a.jugement_resultat === "favorable"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : a.jugement_resultat === "partiellement_favorable"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                      }`}
                      title={`Jugement : ${a.jugement_resultat.replace("_", " ")}`}
                    >
                      <Gavel className="h-3 w-3" />
                      {a.jugement_resultat === "favorable"
                        ? "Favorable"
                        : a.jugement_resultat === "partiellement_favorable"
                          ? "Partiel"
                          : "Défavorable"}
                    </span>
                  )}
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
                      ? "Terminé"
                      : a.status === "error"
                      ? "Erreur"
                      : "En cours"}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
