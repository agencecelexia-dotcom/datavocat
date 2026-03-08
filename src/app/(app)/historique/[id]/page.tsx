"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

interface Analysis {
  id: string;
  query: string;
  response: string;
  status: string;
  created_at: string;
}

export default function AnalysisDetailPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analyses/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analysis) {
    return <p className="text-muted-foreground">Analyse non trouvée.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/historique">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Historique
        </Button>
      </Link>

      <Card className="bg-muted/50 p-4">
        <p className="text-sm font-medium">Demande</p>
        <p className="mt-1 text-sm">{analysis.query}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {new Date(analysis.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </Card>

      <div className="rounded-lg border bg-card p-6">
        {analysis.response ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{
              __html: formatMarkdown(analysis.response),
            }}
          />
        ) : (
          <p className="text-muted-foreground">
            {analysis.status === "error"
              ? "Erreur lors de l'analyse."
              : "Analyse en cours..."}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        onClick={() => navigator.clipboard.writeText(analysis.response || "")}
      >
        Copier le rapport
      </Button>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-2">$1</h2>')
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>'
    )
    .replace(/^\- (.+)$/gm, '<li class="ml-4">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
