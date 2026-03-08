"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  FileText,
  BarChart3,
  Presentation,
  FileDown,
  BookOpen,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  User,
} from "lucide-react";
import { AnalysisChat } from "@/components/analysis/chat";
import { AnalysisDashboard } from "@/components/analysis/dashboard";
import { AnalysisSlides } from "@/components/analysis/slides";
import { formatMarkdownSafe } from "@/lib/format-markdown";
import { parseAnalysisResponse, ParsedAnalysis } from "@/lib/parse-analysis";
import { CopyMarkdown } from "@/components/ui/copy-markdown";

interface Analysis {
  id: string;
  query: string;
  response: string;
  status: string;
  created_at: string;
  client_id: string | null;
}

interface ClientOption {
  id: string;
  prenom: string;
  nom: string;
  entreprise: string | null;
}

export default function AnalysisDetailPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"text" | "dashboard" | "slides">("text");
  const [showSources, setShowSources] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/analyses/${id}`).then((r) => r.json()),
      fetch("/api/clients").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([data, clientsData]) => {
        setAnalysis(data);
        setClients(clientsData);
        setSelectedClientId(data.client_id || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const parsedData = useMemo(() => {
    if (!analysis?.response || analysis.status !== "done") return null;
    return parseAnalysisResponse(analysis.response);
  }, [analysis]);

  const handleClientChange = async (clientId: string) => {
    setSelectedClientId(clientId);
    await fetch(`/api/analyses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId || null }),
    });
  };

  const handleExport = async (format: "pdf" | "docx") => {
    if (!analysis?.response) return;
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: analysis.id,
          query: analysis.query,
          response: analysis.response,
          parsed: parsedData,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `datavocat-analyse.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silently fail
    }
  };

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
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-4">
      {/* Back + query header */}
      <div className="flex items-start gap-3">
        <Link href="/historique">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Historique
          </Button>
        </Link>
      </div>

      <Card className="bg-muted/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
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
          </div>
          {/* Client selector */}
          {clients.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="h-8 rounded-lg border border-border/50 bg-background px-2.5 text-xs text-foreground outline-none focus:border-[#1e3a5f]/30"
              >
                <option value="">Sans client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom}{c.entreprise ? ` — ${c.entreprise}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Source count + Fiabilité + View toggle */}
      {parsedData && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <SourcesBadge data={parsedData} onClick={() => setShowSources(!showSources)} />
          <FiabiliteBadge fiabilite={parsedData.fiabilite} />

          <div className="flex-1" />

          {/* View tabs */}
          <div className="flex gap-0.5 rounded-xl border border-border/40 bg-muted/50 p-0.5">
            {([
              { key: "text" as const, label: "Rapport", icon: FileText },
              { key: "dashboard" as const, label: "Dashboard", icon: BarChart3 },
              { key: "slides" as const, label: "Slides", icon: Presentation },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  activeView === tab.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sources panel (collapsible) */}
      {showSources && parsedData && parsedData.sources.length > 0 && (
        <SourcesPanel sources={parsedData.sources} />
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border/30 bg-card shadow-lg shadow-black/[0.03]">
        {/* Header bar with export */}
        {analysis.response && analysis.status === "done" && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-card/95 px-5 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[#1e3a5f]/10">
                {activeView === "text" ? (
                  <FileText className="h-3 w-3 text-[#1e3a5f]" />
                ) : activeView === "dashboard" ? (
                  <BarChart3 className="h-3 w-3 text-[#1e3a5f]" />
                ) : (
                  <Presentation className="h-3 w-3 text-[#1e3a5f]" />
                )}
              </div>
              <span className="font-medium text-foreground">
                {activeView === "text"
                  ? "Rapport d'analyse"
                  : activeView === "dashboard"
                    ? "Dashboard jurimétrique"
                    : "Présentation"}
              </span>
              <span className="text-muted-foreground/50">|</span>
              <span>Datavocat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CopyMarkdown content={analysis.response} />
              <button
                onClick={() => handleExport("pdf")}
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border/40 bg-background px-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                <FileDown className="h-3 w-3" />
                PDF
              </button>
              <button
                onClick={() => handleExport("docx")}
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border/40 bg-background px-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                <FileDown className="h-3 w-3" />
                DOCX
              </button>
            </div>
          </div>
        )}

        {/* Text view */}
        {activeView === "text" && analysis.response ? (
          <div className="animate-fade-in-up px-8 py-6 lg:px-12">
            <div
              className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-serif prose-h2:text-xl prose-h2:text-[#1e3a5f] prose-h3:text-base prose-h3:text-foreground prose-strong:text-foreground prose-a:text-[#1e3a5f] prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{
                __html: formatMarkdownSafe(analysis.response),
              }}
            />
          </div>
        ) : activeView === "dashboard" && parsedData ? (
          <div className="animate-fade-in-up p-6">
            <AnalysisDashboard data={parsedData} />
          </div>
        ) : activeView === "slides" && parsedData ? (
          <div className="animate-fade-in-up">
            <AnalysisSlides data={parsedData} query={analysis.query} />
          </div>
        ) : !analysis.response ? (
          <div className="flex items-center justify-center p-12">
            <p className="text-muted-foreground">
              {analysis.status === "error"
                ? "Erreur lors de l'analyse."
                : "Analyse en cours..."}
            </p>
          </div>
        ) : null}
      </div>

      {/* Follow-up chat */}
      {analysis.response && analysis.status === "done" && (
        <AnalysisChat analysisContext={analysis.response} query={analysis.query} />
      )}
    </div>
  );
}

/* ═══ SOURCES BADGE ═══ */
function SourcesBadge({
  data,
  onClick,
}: {
  data: ParsedAnalysis;
  onClick: () => void;
}) {
  const count = data.sourceCount;
  return (
    <button
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-3.5 py-1.5 text-sm font-medium text-[#1e3a5f] transition-all duration-200 hover:bg-[#1e3a5f]/10 hover:shadow-sm"
    >
      <BookOpen className="h-4 w-4" />
      <span>
        {count} source{count !== 1 ? "s" : ""}
      </span>
      {count > 0 && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
    </button>
  );
}

/* ═══ FIABILITÉ BADGE ═══ */
function FiabiliteBadge({
  fiabilite,
}: {
  fiabilite: ParsedAnalysis["fiabilite"];
}) {
  const config: Record<string, { bg: string; text: string; icon: typeof ShieldCheck }> = {
    "Tres eleve": {
      bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: ShieldCheck,
    },
    Eleve: {
      bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: ShieldCheck,
    },
    Moyen: {
      bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-400",
      icon: ShieldAlert,
    },
    Faible: {
      bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
      text: "text-rose-700 dark:text-rose-400",
      icon: ShieldX,
    },
    "Tres faible": {
      bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800",
      text: "text-rose-700 dark:text-rose-400",
      icon: ShieldX,
    },
  };

  const c = config[fiabilite.label] || config["Faible"];
  const Icon = c.icon;

  return (
    <div
      className={`group relative inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium ${c.bg} ${c.text}`}
    >
      <Icon className="h-4 w-4" />
      <span>
        Fiabilité : {fiabilite.label} ({fiabilite.score}/100)
      </span>
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-72 rounded-lg border bg-card p-3 text-xs text-foreground shadow-lg group-hover:block">
        <p className="font-medium">Détails du score de fiabilité</p>
        <p className="mt-1 text-muted-foreground">{fiabilite.details}</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${fiabilite.score}%`,
              backgroundColor:
                fiabilite.score >= 60
                  ? "#2d6a4f"
                  : fiabilite.score >= 40
                    ? "#ca6702"
                    : "#9b2226",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══ SOURCES PANEL ═══ */
function SourcesPanel({ sources }: { sources: ParsedAnalysis["sources"] }) {
  return (
    <Card className="shrink-0 border-[#1e3a5f]/20 bg-[#1e3a5f]/[0.02] p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-sm font-semibold text-primary">
          Sources de jurisprudence ({sources.length})
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-white p-3 transition-all duration-200 hover:border-[#1e3a5f]/40 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                {source.reference}
              </p>
              {(source.chamber || source.date) && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[source.chamber, source.date, source.solution]
                    .filter(Boolean)
                    .join(" — ")}
                </p>
              )}
            </div>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
          </a>
        ))}
      </div>
    </Card>
  );
}
