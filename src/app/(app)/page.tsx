"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Scale, Send, Loader2, Sparkles, BarChart3, Presentation } from "lucide-react";
import { parseAnalysisResponse } from "@/lib/parse-analysis";
import { AnalysisDashboard } from "@/components/analysis/dashboard";
import { AnalysisSlides } from "@/components/analysis/slides";

export default function AnalyzePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"text" | "dashboard" | "slides">("text");
  const responseRef = useRef<HTMLDivElement>(null);

  const parsedData = useMemo(() => {
    if (!response || loading) return null;
    return parseAnalysisResponse(response);
  }, [response, loading]);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponse("");
    setAnalysisId(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        setResponse("Erreur lors de l'analyse. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      const id = res.headers.get("X-Analysis-Id");
      if (id) setAnalysisId(id);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setResponse(text);
        }
      }
    } catch {
      setResponse("Erreur de connexion. Vérifiez votre connexion internet.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setQuery("");
    setResponse("");
    setAnalysisId(null);
  };

  const examples = [
    "Mon client est un salarié licencié pour faute grave après 15 ans d'ancienneté dans une entreprise de BTP. Il conteste le motif. Quelles sont ses chances devant le CPH de Paris ?",
    "Une OS non signataire veut contester un accord collectif sur le temps de travail dans une entreprise de 500 salariés. L'accord a été signé par des syndicats représentant 55% des votes. Quels arguments privilégier ?",
    "Mon client locataire d'un bail commercial à Paris se voit refuser le renouvellement par le bailleur. Le bail dure depuis 12 ans. Quelles indemnités d'éviction peut-il espérer ?",
  ];

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      {!response ? (
        // Input state
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
          <div className="text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <Scale className="h-10 w-10 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">Datavocat</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Décrivez votre affaire. L&apos;IA analyse la jurisprudence et vous
              donne les statistiques et recommandations.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="relative">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Décrivez la situation juridique de votre client, le type de contentieux, les arguments envisagés..."
                className="min-h-[140px] resize-none pr-14 text-base"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-3 right-3"
                disabled={!query.trim() || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Ctrl+Entrée pour envoyer — Toute matière juridique
            </p>
          </form>

          <div className="w-full space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Exemples de demandes
            </p>
            <div className="grid gap-2">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(example)}
                  className="rounded-lg border bg-card p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // Response state
        <div className="flex flex-1 flex-col gap-4 overflow-hidden py-4">
          {/* User query */}
          <Card className="shrink-0 bg-muted/50 p-4">
            <p className="text-sm">{query}</p>
          </Card>

          {/* View toggle tabs */}
          {!loading && parsedData && (
            <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setActiveView("text")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === "text"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Scale className="h-4 w-4" />
                Rapport
              </button>
              <button
                onClick={() => setActiveView("dashboard")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === "dashboard"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveView("slides")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeView === "slides"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Presentation className="h-4 w-4" />
                Presentation
              </button>
            </div>
          )}

          {/* Content area */}
          <div
            ref={responseRef}
            className="flex-1 overflow-y-auto rounded-lg border bg-card p-6"
          >
            {loading && !response && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>
                  Recherche dans data.gouv.fr et analyse en cours...
                </span>
              </div>
            )}

            {/* Text view (default, also shown while streaming) */}
            {(activeView === "text" || loading) && (
              <>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(response) }}
                />
                {loading && response && (
                  <span className="inline-block h-4 w-2 animate-pulse bg-primary" />
                )}
              </>
            )}

            {/* Dashboard view */}
            {activeView === "dashboard" && !loading && parsedData && (
              <AnalysisDashboard data={parsedData} />
            )}

            {/* Slides view */}
            {activeView === "slides" && !loading && parsedData && (
              <AnalysisSlides data={parsedData} query={query} />
            )}
          </div>

          {/* Actions */}
          {!loading && (
            <div className="flex shrink-0 gap-3">
              <Button onClick={handleNewAnalysis} variant="outline">
                Nouvelle analyse
              </Button>
              {analysisId && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(response);
                  }}
                >
                  Copier le rapport
                </Button>
              )}
            </div>
          )}
        </div>
      )}
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
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match
        .split("|")
        .filter(Boolean)
        .map((c) => c.trim());
      return `<div class="flex gap-4 py-1 text-sm">${cells.map((c) => `<span class="flex-1">${c}</span>`).join("")}</div>`;
    })
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
