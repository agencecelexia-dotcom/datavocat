"use client";

import { useState } from "react";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  BookOpen,
  Filter,
  Search,
} from "lucide-react";
import type { ParsedAnalysis, DetailedSource } from "@/lib/parse-analysis";

const NAVY = "#1e3a5f";

function PertinenceBadge({ value }: { value: DetailedSource["pertinence"] }) {
  if (value === "favorable") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Favorable
      </span>
    );
  }
  if (value === "defavorable") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
        <XCircle className="h-3 w-3" />
        Defavorable
      </span>
    );
  }
  if (value === "neutre") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        isJudilibre
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
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
  return (
    <div
      className={`border-b border-slate-200 transition-colors duration-200 ${
        expanded ? "bg-slate-50" : "hover:bg-slate-50/50"
      }`}
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-4 px-5 py-3.5 text-left"
      >
        {/* Index */}
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: NAVY }}
        >
          {index + 1}
        </div>

        {/* Reference + date */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {source.reference}
          </p>
          {(source.chambre || source.date || source.juridiction) && (
            <p className="mt-0.5 text-xs text-slate-500">
              {[source.chambre, source.date, source.juridiction]
                .filter(Boolean)
                .join(" — ")}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="hidden items-center gap-2 sm:flex">
          <PertinenceBadge value={source.pertinence} />
          {source.source && <SourceBadge value={source.source} />}
        </div>

        {/* Solution */}
        {source.solution && (
          <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 lg:inline-block">
            {source.solution}
          </span>
        )}

        {/* Expand icon */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="animate-fade-in-up border-t border-slate-100 px-5 pb-4 pt-3">
          {/* Mobile badges */}
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:hidden">
            <PertinenceBadge value={source.pertinence} />
            {source.source && <SourceBadge value={source.source} />}
            {source.solution && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                {source.solution}
              </span>
            )}
          </div>

          {/* Detail grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {source.juridiction && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Juridiction
                </p>
                <p className="mt-0.5 text-sm text-slate-800">
                  {source.juridiction}
                </p>
              </div>
            )}
            {source.chambre && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Chambre
                </p>
                <p className="mt-0.5 text-sm text-slate-800">
                  {source.chambre}
                </p>
              </div>
            )}
            {source.date && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Date
                </p>
                <p className="mt-0.5 text-sm text-slate-800">{source.date}</p>
              </div>
            )}
            {source.solution && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Solution
                </p>
                <p className="mt-0.5 text-sm text-slate-800">
                  {source.solution}
                </p>
              </div>
            )}
          </div>

          {/* Apport — the key value */}
          {source.apport && (
            <div className="mt-3 rounded-lg border border-[#c9a96e]/20 bg-[#c9a96e]/5 p-3.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#c9a96e]">
                Apport pour le dossier
              </p>
              <p className="text-sm leading-relaxed text-slate-800">
                {source.apport}
              </p>
            </div>
          )}

          {/* Link to Legifrance */}
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-3 py-1.5 text-xs font-medium text-[#1e3a5f] transition-all hover:bg-[#1e3a5f]/10"
            >
              <ExternalLink className="h-3 w-3" />
              Consulter sur Judilibre
            </a>
          )}
        </div>
      )}
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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2.5 font-serif text-2xl text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a5f]/10">
            <BookOpen className="h-5 w-5 text-[#1e3a5f]" />
          </div>
          Annexe des sources
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {detailedSources.length} decision{detailedSources.length !== 1 ? "s" : ""} citee{detailedSources.length !== 1 ? "s" : ""} dans l&apos;analyse — cliquez pour voir le detail
        </p>
      </div>

      {/* Stats summary */}
      {hasDetailed && (favorableCount > 0 || defavorableCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {favorableCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">{favorableCount}</span>
              <span className="text-xs text-emerald-600">favorable{favorableCount > 1 ? "s" : ""}</span>
            </div>
          )}
          {defavorableCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <XCircle className="h-4 w-4 text-rose-600" />
              <span className="text-sm font-semibold text-rose-700">{defavorableCount}</span>
              <span className="text-xs text-rose-600">defavorable{defavorableCount > 1 ? "s" : ""}</span>
            </div>
          )}
          {neutreCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <MinusCircle className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-600">{neutreCount}</span>
              <span className="text-xs text-slate-500">neutre{neutreCount > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par reference, juridiction, contenu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1e3a5f]/30 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/20"
          />
        </div>

        {/* Filter pills */}
        {hasDetailed && (
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            {(["all", "favorable", "defavorable", "neutre"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
                  filter === f
                    ? f === "favorable"
                      ? "bg-emerald-100 text-emerald-700"
                      : f === "defavorable"
                        ? "bg-rose-100 text-rose-700"
                        : f === "neutre"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-[#1e3a5f] text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                }`}
              >
                {f === "all" ? "Toutes" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Table header */}
        <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <div className="w-7" />
          <div className="flex-1">Reference / Details</div>
          <div className="hidden w-24 text-center sm:block">Pertinence</div>
          <div className="hidden w-24 text-center sm:block">Source</div>
          <div className="hidden w-20 text-center lg:block">Solution</div>
          <div className="w-4" />
        </div>

        {/* Rows */}
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
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Aucune source ne correspond aux filtres.
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs italic text-slate-400">
        Les liens renvoient vers Judilibre (Cour de cassation). Verifiez systematiquement les decisions avant toute utilisation dans un acte de procedure.
      </p>
    </div>
  );
}
