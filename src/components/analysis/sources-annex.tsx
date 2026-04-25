"use client";

import { useState } from "react";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Filter,
  Search,
} from "lucide-react";
import type { ParsedAnalysis, DetailedSource } from "@/lib/parse-analysis";

const EMERALD = "var(--emerald, #2d6a4f)";
const BORDEAUX = "var(--bordeaux, #9b2226)";
const AMBER = "var(--amber, #ca6702)";

function PertinenceBadge({ value }: { value: DetailedSource["pertinence"] }) {
  if (value === "favorable") {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.05em] font-semibold px-2 py-0.5 rounded"
        style={{
          color: EMERALD,
          background: "color-mix(in srgb, var(--emerald, #2d6a4f) 10%, transparent)",
        }}
      >
        <CheckCircle2 className="h-3 w-3" />
        Favorable
      </span>
    );
  }
  if (value === "defavorable") {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.05em] font-semibold px-2 py-0.5 rounded"
        style={{
          color: BORDEAUX,
          background: "color-mix(in srgb, var(--bordeaux, #9b2226) 10%, transparent)",
        }}
      >
        <XCircle className="h-3 w-3" />
        Défavorable
      </span>
    );
  }
  if (value === "neutre") {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.05em] font-semibold px-2 py-0.5 rounded"
        style={{
          color: "var(--muted-foreground)",
          background: "var(--paper)",
        }}
      >
        <MinusCircle className="h-3 w-3" />
        Neutre
      </span>
    );
  }
  return null;
}

function SourceBadge({ value }: { value: string }) {
  const isJudilibre = value.toLowerCase().includes("judilibre");
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.05em] font-medium px-2 py-0.5 rounded"
      style={{
        border: "1px solid var(--line)",
        background: "var(--paper)",
        color: isJudilibre ? "var(--navy)" : AMBER,
      }}
    >
      {isJudilibre ? "Judilibre" : "Connaissance"}
    </span>
  );
}

function SourceRow({
  source,
  index,
  expanded,
  onToggle,
}: {
  source: DetailedSource;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const leftBorderColor =
    source.pertinence === "favorable"
      ? EMERALD
      : source.pertinence === "defavorable"
        ? BORDEAUX
        : source.pertinence === "neutre"
          ? "var(--muted-foreground)"
          : "transparent";

  return (
    <div
      className="transition-colors"
      style={{
        borderBottom: "1px solid var(--line-soft)",
        borderLeft: `3px solid ${leftBorderColor}`,
        background: expanded ? "var(--paper)" : "transparent",
      }}
    >
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left sm:gap-4 sm:px-5 sm:py-3.5"
      >
        {/* Index */}
        <div
          className="shrink-0 w-8 h-8 flex items-center justify-center font-mono text-[11px] font-semibold rounded"
          style={{
            background: "color-mix(in srgb, var(--gold) 10%, transparent)",
            color: "var(--gold)",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        {/* Reference + metadata */}
        <div className="min-w-0 flex-1">
          <p
            className="font-serif text-[13.5px] font-medium leading-tight"
            style={{ color: "var(--ink)" }}
          >
            {source.reference}
          </p>
          {(source.chambre || source.date || source.juridiction) && (
            <p
              className="mt-0.5 text-[11px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              {[source.chambre, source.date, source.juridiction]
                .filter(Boolean)
                .join(" — ")}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="hidden items-center gap-2 sm:flex shrink-0">
          <PertinenceBadge value={source.pertinence} />
          {source.source && <SourceBadge value={source.source} />}
        </div>

        {/* Solution */}
        {source.solution && (
          <span
            className="hidden font-mono text-[10px] uppercase tracking-[0.05em] px-2 py-0.5 rounded lg:inline-block shrink-0"
            style={{
              background: "var(--paper)",
              color: "var(--muted-foreground)",
              border: "1px solid var(--line)",
            }}
          >
            {source.solution}
          </span>
        )}

        {/* Chevron */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 mt-1" style={{ color: "var(--muted-foreground)" }} />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 mt-1" style={{ color: "var(--muted-foreground)" }} />
        )}
      </button>

      {expanded && (
        <div
          className="animate-fade-in-up px-3 pb-4 sm:px-5 sm:pb-5"
          style={{ borderTop: "1px solid var(--line-soft)" }}
        >
          {/* Mobile badges */}
          <div className="mb-3 mt-3 flex flex-wrap items-center gap-2 sm:hidden">
            <PertinenceBadge value={source.pertinence} />
            {source.source && <SourceBadge value={source.source} />}
            {source.solution && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.05em] px-2 py-0.5 rounded"
                style={{
                  background: "var(--paper)",
                  color: "var(--muted-foreground)",
                }}
              >
                {source.solution}
              </span>
            )}
          </div>

          {/* Detail grid */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Juridiction" value={source.juridiction} />
            <DetailField label="Chambre" value={source.chambre} />
            <DetailField label="Date" value={source.date} />
            <DetailField label="Solution" value={source.solution} />
          </div>

          {/* Apport */}
          {source.apport && (
            <div
              className="mt-3 pl-4"
              style={{ borderLeft: "2px solid var(--gold)" }}
            >
              <div
                className="font-mono text-[9.5px] uppercase tracking-[0.2em] mb-1"
                style={{ color: "var(--gold)" }}
              >
                Apport pour le dossier
              </div>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--ink)" }}
              >
                {source.apport}
              </p>
            </div>
          )}

          {/* Link */}
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium rounded-md transition-colors"
              style={{
                border: "1px solid var(--line)",
                color: "var(--ink)",
                background: "var(--card)",
              }}
            >
              <ExternalLink className="h-3 w-3" />
              {source.url.includes("legifrance")
                ? "Consulter sur Légifrance"
                : "Consulter sur Judilibre"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div
        className="font-mono text-[9.5px] uppercase tracking-[0.15em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-[12.5px]"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function SourcesAnnex({ data }: { data: ParsedAnalysis }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "favorable" | "defavorable" | "neutre">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Use detailedSources if available, otherwise fall back to basic sources
  const hasDetailed = data.detailedSources.length > 0;

  const detailedSources = hasDetailed
    ? data.detailedSources
    : data.sources.map((s) => ({
        reference: s.reference,
        juridiction: "",
        chambre: s.chamber,
        date: s.date,
        solution: s.solution,
        source: "",
        pertinence: "" as const,
        apport: "",
        url: s.url,
      }));

  const filtered = detailedSources.filter((s) => {
    if (filter !== "all" && s.pertinence !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        s.reference.toLowerCase().includes(term) ||
        s.apport.toLowerCase().includes(term) ||
        s.juridiction.toLowerCase().includes(term) ||
        s.chambre.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Stats
  const favorableCount = detailedSources.filter((s) => s.pertinence === "favorable").length;
  const defavorableCount = detailedSources.filter((s) => s.pertinence === "defavorable").length;
  const neutreCount = detailedSources.filter((s) => s.pertinence === "neutre").length;

  return (
    <div className="space-y-6">
      {/* Header éditorial */}
      <div>
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
          style={{ color: "var(--gold)" }}
        >
          § Annexe des sources
        </div>
        <h2 className="font-serif text-[28px] font-medium tracking-tight">
          {detailedSources.length} décision{detailedSources.length !== 1 ? "s" : ""} <span className="dv-italic">citée{detailedSources.length !== 1 ? "s" : ""}.</span>
        </h2>
        <p
          className="mt-2 text-[13.5px] leading-relaxed max-w-2xl"
          style={{ color: "var(--muted-foreground)" }}
        >
          Chaque entrée est identifiée par sa référence (ECLI, n° de pourvoi ou référence Cass.). Cliquez pour voir le détail complet et l&apos;apport pour votre dossier.
        </p>
      </div>

      {/* Stats chip line */}
      {hasDetailed && (favorableCount > 0 || defavorableCount > 0 || neutreCount > 0) && (
        <div
          className="flex flex-wrap items-center gap-x-3 sm:gap-x-6 gap-y-2 py-3 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <AnnexStatChip label="Total" value={detailedSources.length} color="var(--ink)" />
          {favorableCount > 0 && (
            <AnnexStatChip label="Favorables" value={favorableCount} color={EMERALD} />
          )}
          {defavorableCount > 0 && (
            <AnnexStatChip label="Défavorables" value={defavorableCount} color={BORDEAUX} />
          )}
          {neutreCount > 0 && (
            <AnnexStatChip label="Neutres" value={neutreCount} color="var(--muted-foreground)" />
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] w-full sm:w-auto">
          <Search
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--muted-foreground)" }}
          />
          <input
            type="text"
            placeholder="Rechercher par référence, juridiction, contenu…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-2 pl-9 pr-3 text-[12.5px] outline-none rounded-md"
            style={{
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--ink)",
            }}
          />
        </div>

        {hasDetailed && (
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
            {(["all", "favorable", "defavorable", "neutre"] as const).map((f) => {
              const active = filter === f;
              const label = f === "all" ? "Toutes" : f.charAt(0).toUpperCase() + f.slice(1) + "s";
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1 text-[11.5px] transition-colors cursor-pointer"
                  style={{
                    color: active ? "var(--ink)" : "var(--muted-foreground)",
                    fontWeight: active ? 600 : 400,
                    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Légende persistante */}
      {hasDetailed && (
        <div
          className="rounded-md px-3 py-2 text-[11px] leading-relaxed"
          style={{
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--muted-foreground)",
          }}
        >
          <span
            className="font-mono uppercase tracking-[0.15em] text-[10px] mr-1.5"
            style={{ color: "var(--ink)" }}
          >
            Légende&nbsp;:
          </span>
          <span style={{ color: EMERALD }}>Favorables</span> = issue favorable pour votre client,{" "}
          <span style={{ color: BORDEAUX }}>Défavorables</span> = issue opposée,{" "}
          <span>Neutres</span> = sans effet sur votre position.
        </div>
      )}

      {/* List */}
      <div
        className="overflow-hidden rounded-md"
        style={{
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        {filtered.length > 0 ? (
          filtered.map((source, i) => (
            <SourceRow
              key={i}
              source={source}
              index={i}
              expanded={expandedIndex === i}
              onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
            />
          ))
        ) : (
          <div
            className="px-5 py-10 text-center text-[13px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Aucune source ne correspond aux filtres.
          </div>
        )}
      </div>

      {/* Footer note */}
      <p
        className="text-[10.5px] italic"
        style={{ color: "var(--muted-foreground)", opacity: 0.8 }}
      >
        Les liens renvoient vers Légifrance ou Judilibre (Cour de cassation). Vérifiez systématiquement les décisions avant toute utilisation dans un acte de procédure.
      </p>
    </div>
  );
}

function AnnexStatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <div
        className="font-mono text-[20px] tabular-nums font-semibold"
        style={{ color }}
      >
        {value}
      </div>
      <div
        className="font-mono text-[10px] uppercase tracking-[0.15em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
    </div>
  );
}
