"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Minus,
  ExternalLink,
} from "lucide-react";
import type { EvidenceTable as EvidenceTableData } from "@/lib/parse-analysis";
import { buildSourceUrl } from "@/lib/parse-analysis";

const EMERALD = "var(--emerald, #2d6a4f)";
const BORDEAUX = "var(--bordeaux, #9b2226)";
const AMBER = "var(--amber, #ca6702)";
const MUTED = "var(--muted-foreground)";

function pertinenceColor(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("favorable") && !v.includes("defavorable") && !v.includes("défavorable")) return EMERALD;
  if (v.includes("defavorable") || v.includes("défavorable")) return BORDEAUX;
  if (v.includes("nuanc")) return AMBER;
  return MUTED;
}

function pertinenceIcon(value: string) {
  const v = value.toLowerCase();
  if (v.includes("favorable") && !v.includes("defavorable") && !v.includes("défavorable")) {
    return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: EMERALD }} />;
  }
  if (v.includes("defavorable") || v.includes("défavorable")) {
    return <XCircle className="h-3.5 w-3.5" style={{ color: BORDEAUX }} />;
  }
  if (v.includes("nuanc")) {
    return <Minus className="h-3.5 w-3.5" style={{ color: AMBER }} />;
  }
  return null;
}

const COMPACT_KEYWORDS = ["n°", "decision", "référence", "reference", "date", "solution", "pertinence"];

function isCompactColumn(header: string): boolean {
  const h = header.toLowerCase();
  return COMPACT_KEYWORDS.some((k) => h.includes(k));
}

export function EvidenceTable({ data }: { data: EvidenceTableData }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterPertinence, setFilterPertinence] = useState<"all" | "favorable" | "defavorable" | "nuance">("all");
  // Mode condensé : colonnes essentielles par défaut, expand par ligne pour le détail.
  const [compactMode, setCompactMode] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const hasPertinence = data.headers.some((h) => h.toLowerCase().includes("pertinence"));

  const compactHeaders = useMemo(
    () => data.headers.filter(isCompactColumn),
    [data.headers]
  );
  const extraHeaders = useMemo(
    () => data.headers.filter((h) => !isCompactColumn(h)),
    [data.headers]
  );
  const showCompact = compactMode && compactHeaders.length >= 3 && extraHeaders.length > 0;
  const visibleHeaders = showCompact ? compactHeaders : data.headers;

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // Compute stats
  const stats = useMemo(() => {
    const pertCol = data.headers.find((h) => h.toLowerCase().includes("pertinence"));
    if (!pertCol) return null;

    let favorable = 0;
    let defavorable = 0;
    let nuance = 0;
    for (const row of data.rows) {
      const v = (row[pertCol] || "").toLowerCase();
      if (v.includes("favorable") && !v.includes("defavorable") && !v.includes("défavorable")) favorable++;
      else if (v.includes("defavorable") || v.includes("défavorable")) defavorable++;
      else nuance++;
    }
    return { total: data.rows.length, favorable, defavorable, nuance };
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data.rows;

    // Filter by pertinence
    if (filterPertinence !== "all" && hasPertinence) {
      const pertCol = data.headers.find((h) => h.toLowerCase().includes("pertinence"))!;
      rows = rows.filter((row) => {
        const v = (row[pertCol] || "").toLowerCase();
        if (filterPertinence === "favorable") return v.includes("favorable") && !v.includes("defavorable") && !v.includes("défavorable");
        if (filterPertinence === "defavorable") return v.includes("defavorable") || v.includes("défavorable");
        if (filterPertinence === "nuance") return v.includes("nuanc");
        return true;
      });
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((v) => v.toLowerCase().includes(term))
      );
    }

    // Sort
    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const va = a[sortCol] || "";
        const vb = b[sortCol] || "";
        const cmp = va.localeCompare(vb, "fr", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [data.rows, data.headers, searchTerm, sortCol, sortDir, filterPertinence, hasPertinence]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header éditorial */}
      <div>
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
          style={{ color: "var(--gold)" }}
        >
          § Tableau de preuve
        </div>
        <h2 className="font-serif text-[28px] font-medium tracking-tight">
          {stats ? stats.total : data.rows.length} décisions <span className="dv-italic">analysées.</span>
        </h2>
        <p
          className="mt-2 text-[13.5px] leading-relaxed max-w-2xl"
          style={{ color: "var(--muted-foreground)" }}
        >
          Chaque ligne correspond à une décision réelle identifiée par sa référence (ECLI, n° de pourvoi ou référence Cass.). Base probatoire des statistiques présentées.
        </p>
      </div>

      {/* Stats chip line */}
      {stats && (
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <StatChip label="Total" value={stats.total} color="var(--ink)" />
          <StatChip label="Favorables" value={stats.favorable} color={EMERALD} />
          <StatChip label="Défavorables" value={stats.defavorable} color={BORDEAUX} />
          <StatChip label="Nuancées" value={stats.nuance} color={AMBER} />
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
            placeholder="Rechercher dans le tableau…"
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

        {/* Pertinence filter */}
        {hasPertinence && (
          <div data-tour="evidence-filters" className="flex items-center gap-1.5">
            <Filter
              className="h-3.5 w-3.5"
              style={{ color: "var(--muted-foreground)" }}
            />
            {[
              { key: "all" as const, label: "Toutes", count: stats?.total, tooltip: "Afficher toutes les décisions sans filtre" },
              { key: "favorable" as const, label: "Favorables", count: stats?.favorable, tooltip: "Décisions dont l'issue soutient la position de votre client" },
              { key: "defavorable" as const, label: "Défavorables", count: stats?.defavorable, tooltip: "Décisions contraires — utiles pour anticiper les moyens adverses" },
              { key: "nuance" as const, label: "Nuancées", count: stats?.nuance, tooltip: "Décisions à l'issue mitigée (cassation partielle, gain partiel)" },
            ].map((f) => {
              const active = filterPertinence === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilterPertinence(f.key)}
                  title={f.tooltip}
                  className="px-3 py-1 text-[11.5px] transition-colors cursor-pointer"
                  style={{
                    color: active ? "var(--ink)" : "var(--muted-foreground)",
                    fontWeight: active ? 600 : 400,
                    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
                  }}
                >
                  {f.label}
                  {typeof f.count === "number" && (
                    <span className="ml-1 font-mono tabular-nums opacity-60">
                      ({f.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Légende persistante des filtres */}
      {hasPertinence && (
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
          <span style={{ color: AMBER }}>Nuancées</span> = mitigées (gain partiel, cassation partielle).
        </div>
      )}

      {/* Column count + toggle (caché sur mobile, on est en vue cartes) */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.15em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          {showCompact
            ? `Vue condensée — ${compactHeaders.length} / ${data.headers.length} colonnes`
            : `${data.headers.length} colonnes — scroll horizontal pour tout voir`}
        </p>
        {extraHeaders.length > 0 && (
          <button
            onClick={() => setCompactMode((v) => !v)}
            className="px-3 py-1 text-[11px] transition-colors cursor-pointer rounded-md"
            style={{
              border: "1px solid var(--line)",
              color: "var(--muted-foreground)",
            }}
          >
            {compactMode ? "Toutes les colonnes" : "Vue condensée"}
          </button>
        )}
      </div>

      {/* ─── Mobile : vue cartes (< sm) ─── */}
      <div className="sm:hidden space-y-3">
        {filtered.map((row, i) => {
          const pertCol = data.headers.find((h) =>
            h.toLowerCase().includes("pertinence")
          );
          const pertValue = pertCol ? row[pertCol] || "" : "";
          const refCol = data.headers.find((h) =>
            /decision|référence|reference/i.test(h)
          );
          const refValue = refCol ? row[refCol] || "" : "";
          const dateCol = data.headers.find((h) =>
            h.toLowerCase().includes("date")
          );
          const dateValue = dateCol ? row[dateCol] || "" : "";
          const numCol = data.headers.find(
            (h) => h === "N°" || h.toLowerCase().includes("n°")
          );
          const numValue = numCol ? row[numCol] || String(i + 1) : String(i + 1);
          const solutionCol = data.headers.find((h) =>
            h.toLowerCase().includes("solution")
          );
          const solutionValue = solutionCol ? row[solutionCol] || "" : "";
          const isExpanded = expandedRows.has(i);
          const otherFields = data.headers.filter(
            (h) =>
              h !== refCol &&
              h !== dateCol &&
              h !== numCol &&
              h !== pertCol &&
              h !== solutionCol &&
              row[h]
          );
          return (
            <div
              key={i}
              className="rounded-md p-3"
              style={{
                border: "1px solid var(--line)",
                background: "var(--card)",
                borderLeft: `3px solid ${pertinenceColor(pertValue) || "transparent"}`,
              }}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{ color: "var(--gold)" }}
                >
                  N° {numValue}
                </span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {dateValue}
                </span>
              </div>
              {refValue && (
                <a
                  href={buildSourceUrl(refValue)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-serif text-[14px] font-medium leading-snug mb-1.5 break-all"
                  style={{ color: "var(--ink)" }}
                >
                  {refValue}
                </a>
              )}
              {solutionValue && (
                <p
                  className="text-[12px] leading-snug mb-2"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {solutionValue}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {pertValue && (
                  <span
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.05em] font-semibold px-2 py-0.5 rounded"
                    style={{
                      color: pertinenceColor(pertValue),
                      backgroundColor: `color-mix(in srgb, ${pertinenceColor(pertValue)} 10%, transparent)`,
                    }}
                  >
                    {pertinenceIcon(pertValue)}
                    {pertValue}
                  </span>
                )}
                {otherFields.length > 0 && (
                  <button
                    onClick={() => toggleRow(i)}
                    className="text-[11px] font-mono uppercase tracking-[0.1em] cursor-pointer"
                    style={{ color: "var(--gold)" }}
                  >
                    {isExpanded ? "Masquer" : "Détails"}
                  </button>
                )}
              </div>
              {isExpanded && otherFields.length > 0 && (
                <div
                  className="mt-3 pt-3 grid grid-cols-1 gap-2"
                  style={{ borderTop: "1px solid var(--line-soft)" }}
                >
                  {otherFields.map((h) => (
                    <div key={h} className="flex justify-between gap-3 text-[11.5px]">
                      <span
                        className="font-mono text-[9.5px] uppercase tracking-[0.1em] flex-shrink-0"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {h}
                      </span>
                      <span
                        className="text-right break-words"
                        style={{ color: "var(--ink)" }}
                      >
                        {row[h]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Tablette + desktop (≥ sm) : table classique ─── */}
      <div
        className="hidden sm:block overflow-x-auto rounded-md"
        style={{
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        <table
          className="w-full text-[13px]"
          style={{
            minWidth:
              visibleHeaders.length > 10 ? `${visibleHeaders.length * 130}px` : undefined,
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
              {visibleHeaders.map((header, colIdx) => (
                <th
                  key={header}
                  onClick={() => handleSort(header)}
                  className="cursor-pointer whitespace-nowrap px-2 sm:px-4 py-2 sm:py-3 text-left font-mono text-[9.5px] uppercase tracking-[0.15em] font-semibold transition-colors"
                  style={{
                    color: "var(--muted-foreground)",
                    position: colIdx === 0 ? "sticky" : undefined,
                    left: colIdx === 0 ? 0 : undefined,
                    zIndex: colIdx === 0 ? 10 : undefined,
                    background: colIdx === 0 ? "var(--paper)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {header}
                    {sortCol === header ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="h-3 w-3" style={{ color: "var(--gold)" }} />
                      ) : (
                        <ChevronDown className="h-3 w-3" style={{ color: "var(--gold)" }} />
                      )
                    ) : (
                      <ChevronDown
                        className="h-3 w-3"
                        style={{ color: "var(--muted-foreground)", opacity: 0.3 }}
                      />
                    )}
                  </div>
                </th>
              ))}
              {showCompact && (
                <th
                  className="w-20 px-2 py-3 text-right font-mono text-[9.5px] uppercase tracking-[0.15em] font-semibold"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Détail
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const isExpanded = expandedRows.has(i);
              // Pertinence row highlight (left border)
              const pertCol = data.headers.find((h) => h.toLowerCase().includes("pertinence"));
              const pertValue = pertCol ? (row[pertCol] || "").toLowerCase() : "";
              const leftBorderColor =
                pertValue.includes("favorable") && !pertValue.includes("defavorable") && !pertValue.includes("défavorable")
                  ? EMERALD
                  : pertValue.includes("defavorable") || pertValue.includes("défavorable")
                    ? BORDEAUX
                    : pertValue.includes("nuanc")
                      ? AMBER
                      : "transparent";
              return (
                <React.Fragment key={i}>
                  <tr
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid var(--line-soft)",
                      borderLeft: `3px solid ${leftBorderColor}`,
                    }}
                  >
                    {visibleHeaders.map((header, colIdx) => {
                      const value = row[header] || "";
                      const isPertinence = header.toLowerCase().includes("pertinence");
                      const isFirstCol = colIdx === 0;
                      const isRef = /decision|référence|reference/i.test(header);
                      const isNum = header === "N°" || header.toLowerCase().includes("n°");

                      return (
                        <td
                          key={header}
                          className="whitespace-nowrap px-2 sm:px-4 py-2 sm:py-3"
                          style={{
                            position: isFirstCol ? "sticky" : undefined,
                            left: isFirstCol ? 0 : undefined,
                            zIndex: isFirstCol ? 10 : undefined,
                            background: isFirstCol ? "var(--card)" : undefined,
                            color: "var(--ink)",
                          }}
                        >
                          {isPertinence ? (
                            <div className="flex items-center gap-1.5">
                              {pertinenceIcon(value)}
                              <span
                                className="font-mono text-[10.5px] uppercase tracking-[0.05em] font-semibold px-2 py-0.5 rounded"
                                style={{
                                  color: pertinenceColor(value),
                                  backgroundColor: `color-mix(in srgb, ${pertinenceColor(value)} 10%, transparent)`,
                                }}
                              >
                                {value}
                              </span>
                            </div>
                          ) : isNum ? (
                            <span
                              className="font-mono text-[10.5px] tabular-nums"
                              style={{ color: "var(--gold)" }}
                            >
                              {value}
                            </span>
                          ) : isRef && value ? (
                            <a
                              href={buildSourceUrl(value)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/ref inline-flex items-center gap-1.5 font-serif text-[13px] font-medium transition-colors"
                              style={{ color: "var(--ink)" }}
                              title="Ouvrir la décision sur Légifrance"
                            >
                              {value}
                              <ExternalLink
                                className="h-3 w-3 opacity-0 group-hover/ref:opacity-70 transition-opacity"
                                style={{ color: "var(--gold)" }}
                              />
                            </a>
                          ) : (
                            <span
                              style={{ color: "var(--muted-foreground)" }}
                              className="text-[12px]"
                            >
                              {value}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {showCompact && (
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => toggleRow(i)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] cursor-pointer rounded-md transition-colors"
                          style={{
                            border: "1px solid var(--line)",
                            color: "var(--muted-foreground)",
                            background: "var(--card)",
                          }}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              Fermer
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              Voir
                            </>
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                  {showCompact && isExpanded && (
                    <tr style={{ borderBottom: "1px solid var(--line-soft)" }}>
                      <td
                        colSpan={visibleHeaders.length + 1}
                        className="px-4 py-3"
                        style={{ background: "var(--paper)" }}
                      >
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {extraHeaders.map((h) => {
                            const v = row[h];
                            if (!v) return null;
                            return (
                              <div
                                key={h}
                                className="px-3 py-2 rounded-md"
                                style={{
                                  background: "var(--card)",
                                  border: "1px solid var(--line-soft)",
                                }}
                              >
                                <div
                                  className="font-mono text-[10px] uppercase tracking-[0.15em]"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  {h}
                                </div>
                                <div
                                  className="mt-0.5 text-[12px]"
                                  style={{ color: "var(--ink)" }}
                                >
                                  {v}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={visibleHeaders.length + (showCompact ? 1 : 0)}
                  className="px-4 py-8 text-center text-[13px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Aucune décision ne correspond aux critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Count */}
      <p
        className="font-mono text-[11px] uppercase tracking-[0.15em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {filtered.length} décision{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
        {filtered.length !== data.rows.length && ` sur ${data.rows.length}`}
      </p>

      {/* Synthesis blocks — filets éditoriaux */}
      {(data.synthese || data.periode || data.facteursDeterminants || data.interpretation) && (
        <div
          className="space-y-5 pt-5"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          {data.synthese && (
            <SynthesisBlock label="Synthèse" value={data.synthese} />
          )}
          {data.periode && (
            <SynthesisBlock label="Période couverte" value={data.periode} />
          )}
          {data.facteursDeterminants && (
            <SynthesisBlock
              label="Facteurs déterminants"
              value={data.facteursDeterminants}
            />
          )}
          {data.interpretation && (
            <SynthesisBlock
              label="Ce que cela signifie pour votre dossier"
              value={data.interpretation}
              emphasized
            />
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p
        className="text-[10.5px] leading-relaxed italic"
        style={{ color: "var(--muted-foreground)", opacity: 0.8 }}
      >
        Ce tableau est généré automatiquement à partir des décisions identifiées lors de l&apos;analyse
        (Judilibre et connaissances jurisprudentielles consolidées). Il constitue une aide à la décision
        stratégique et ne saurait se substituer à l&apos;analyse juridique du conseil.
      </p>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function StatChip({
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
        className="font-mono text-[22px] tabular-nums font-semibold"
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

function SynthesisBlock({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className="pl-4"
      style={{ borderLeft: `2px solid ${emphasized ? "var(--gold)" : "var(--line)"}` }}
    >
      <div
        className="font-mono text-[9.5px] uppercase tracking-[0.2em] mb-1.5"
        style={{ color: emphasized ? "var(--gold)" : "var(--muted-foreground)" }}
      >
        {label}
      </div>
      <p
        className="text-[13.5px] leading-[1.65]"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </p>
    </div>
  );
}
