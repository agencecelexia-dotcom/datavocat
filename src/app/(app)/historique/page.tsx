"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText } from "lucide-react";

interface Analysis {
  id: string;
  query: string;
  status: string;
  created_at: string;
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
        <h1 className="text-3xl font-bold tracking-tight">Historique</h1>
        <p className="text-muted-foreground">
          Vos analyses jurimétriques précédentes
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : analyses.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Aucune analyse</p>
          <p className="text-sm text-muted-foreground">
            Lancez votre première analyse depuis la{" "}
            <Link href="/" className="text-primary underline">
              page principale
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {analyses.map((a) => (
            <Link key={a.id} href={`/historique/${a.id}`}>
              <Card className="p-4 transition-colors hover:bg-accent/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.query}</p>
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
