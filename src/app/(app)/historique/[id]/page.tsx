"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  FileDown,
  FileJson,
  Sheet,
  Table,
} from "lucide-react";
import { AnalysisChat } from "@/components/analysis/chat";
import { AnalysisDashboard } from "@/components/analysis/dashboard";
import { EvidenceTable } from "@/components/analysis/evidence-table";
import { SourcesAnnex } from "@/components/analysis/sources-annex";
import { formatMarkdownSafe, stripEvidenceTableSection } from "@/lib/format-markdown";
import { parseAnalysisResponse, ParsedAnalysis } from "@/lib/parse-analysis";
import { CopyMarkdown } from "@/components/ui/copy-markdown";

interface Analysis {
  id: string;
  query: string;
  response: string;
  status: string;
  created_at: string;
}

function FiabiliteBar({ fiabilite }: { fiabilite: ParsedAnalysis["fiabilite"] }) {
  const score = fiabilite.score;
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-2">
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Indice de fiabilité
        </div>
        <div
          className="font-mono text-[22px] tabular-nums font-semibold"
          style={{ color: "var(--gold)" }}
        >
          {score}
          <span
            className="text-[13px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            /100
          </span>
        </div>
      </div>
      <div
        className="relative h-[8px] rounded-full overflow-hidden"
        style={{ background: "var(--paper-2)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, var(--gold) 70%, transparent), var(--gold))`,
          }}
        />
      </div>
    </div>
  );
}

function ExportButton({
  icon: Icon,
  label,
  onClick,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] rounded-md cursor-pointer transition-colors"
      style={{
        border: "1px solid var(--line)",
        color: "var(--muted-foreground)",
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

export default function AnalysisDetailPage() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"text" | "dashboard" | "sources" | "tableau">("text");

  useEffect(() => {
    fetch(`/api/analyses/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const parsedData = useMemo(() => {
    if (!analysis?.response || analysis.status !== "done") return null;
    return parseAnalysisResponse(analysis.response);
  }, [analysis]);

  const handleExport = async (format: "pdf" | "docx" | "csv" | "json") => {
    if (!analysis?.response) {
      toast.error("Aucune analyse à exporter");
      return;
    }
    const loadingId = toast.loading(`Préparation de l'export ${format.toUpperCase()}…`);
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
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        toast.error(`Export ${format.toUpperCase()} impossible : ${errBody.error || res.statusText}`, { id: loadingId });
        console.error(`Export ${format} failed`, res.status, errBody);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `datavocat-analyse.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} téléchargé`, { id: loadingId });
    } catch (err) {
      toast.error(`Export ${format.toUpperCase()} indisponible.`, { id: loadingId });
      console.error(`Export ${format} threw`, err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center">
        <p style={{ color: "var(--muted-foreground)" }}>Analyse non trouvée.</p>
      </div>
    );
  }

  const title = (analysis.query || "").slice(0, 120);
  const createdAt = new Date(analysis.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1040px] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
        {/* Back */}
        <Link
          href="/historique"
          className="inline-flex items-center gap-1.5 text-[12px] mb-6 transition-colors cursor-pointer"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour à l&apos;historique
        </Link>

        {/* Title block */}
        <div className="mb-8">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3 flex flex-wrap items-center gap-x-3 gap-y-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            <span style={{ color: "var(--gold)" }}>§ Rapport d&apos;analyse</span>
            <span>·</span>
            <span>{createdAt}</span>
            <span>·</span>
            <span>Dossier № {analysis.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <h1 className="font-serif text-[28px] sm:text-[36px] leading-[1.05] font-medium tracking-tight">
            {title}
            {(analysis.query || "").length > 120 && "…"}
          </h1>
        </div>

        {/* Hero stat + fiabilité */}
        {parsedData && (
          <div
            className="mb-10 pb-10"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 items-center">
              <div>
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Taux de succès estimé
                </div>
                <div className="flex items-baseline gap-1.5">
                  <div
                    className="font-serif font-medium tabular-nums"
                    style={{
                      fontSize: "72px",
                      color: "var(--ink)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                    }}
                  >
                    {parsedData.tauxSuccesGlobal ?? "—"}
                  </div>
                  <div
                    className="font-serif text-[28px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    %
                  </div>
                </div>
                <div
                  className="mt-3 text-[12px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Sur {parsedData.echantillon ?? "—"} décisions · {parsedData.sourceCount} sources citées
                </div>
              </div>
              <div
                className="lg:pl-10 lg:border-l"
                style={{ borderColor: "var(--line)" }}
              >
                <FiabiliteBar fiabilite={parsedData.fiabilite} />
                <div
                  className="mt-3 text-[12px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Indice de fiabilité{" "}
                  <span className="font-medium" style={{ color: "var(--ink)" }}>
                    {parsedData.fiabilite.label.toLowerCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs + exports */}
        {parsedData && (
          <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1">
              {[
                { key: "text" as const, label: "Rapport" },
                { key: "dashboard" as const, label: "Chiffres" },
                { key: "sources" as const, label: "Sources", count: parsedData.sourceCount },
                { key: "tableau" as const, label: "Tableau" },
              ].map((t) => {
                const active = activeView === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveView(t.key)}
                    className="px-3 py-1.5 text-[13px] transition-all cursor-pointer"
                    style={{
                      color: active ? "var(--ink)" : "var(--muted-foreground)",
                      fontWeight: active ? 500 : 400,
                      borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
                    }}
                  >
                    {t.label}
                    {typeof t.count === "number" && (
                      <span className="ml-1" style={{ color: "var(--muted-foreground)" }}>
                        ({t.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <CopyMarkdown content={analysis.response} />
              <ExportButton icon={FileDown} label="PDF" onClick={() => handleExport("pdf")} />
              <ExportButton icon={FileDown} label="DOCX" onClick={() => handleExport("docx")} />
              <ExportButton icon={Sheet} label="CSV" onClick={() => handleExport("csv")} />
              <ExportButton icon={FileJson} label="JSON" onClick={() => handleExport("json")} />
            </div>
          </div>
        )}

        {/* Content area */}
        {activeView === "text" && analysis.response ? (
          <div className="animate-fade-in-up">
            <div
              className="prose-legal max-w-none"
              dangerouslySetInnerHTML={{
                __html: formatMarkdownSafe(stripEvidenceTableSection(analysis.response)),
              }}
            />
          </div>
        ) : activeView === "dashboard" && parsedData ? (
          <div className="animate-fade-in-up">
            <AnalysisDashboard data={parsedData} />
          </div>
        ) : activeView === "tableau" && parsedData && parsedData.evidenceTable ? (
          <div className="animate-fade-in-up">
            <EvidenceTable data={parsedData.evidenceTable} />
          </div>
        ) : activeView === "tableau" && parsedData && !parsedData.evidenceTable ? (
          <div className="flex items-center justify-center p-12 text-center">
            <div>
              <Table className="mx-auto h-10 w-10 mb-3" style={{ color: "var(--muted-foreground)" }} />
              <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Aucun tableau de preuve disponible.
              </p>
            </div>
          </div>
        ) : activeView === "sources" && parsedData ? (
          <div className="animate-fade-in-up">
            <SourcesAnnex data={parsedData} />
          </div>
        ) : !analysis.response ? (
          <div className="flex items-center justify-center p-12">
            <p style={{ color: "var(--muted-foreground)" }}>
              {analysis.status === "error"
                ? "Erreur lors de l'analyse."
                : "Analyse en cours…"}
            </p>
          </div>
        ) : null}

        {/* Follow-up chat */}
        {analysis.response && analysis.status === "done" && (
          <div
            className="mt-10 pt-6"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <AnalysisChat analysisContext={analysis.response} query={analysis.query} />
          </div>
        )}
      </div>
    </div>
  );
}
