"use client";

import { useState, useMemo } from "react";
import {
  Table,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Minus,
  Info,
  Calendar,
  BarChart3,
} from "lucide-react";
import type { EvidenceTable as EvidenceTableData } from "@/lib/parse-analysis";

const NAVY = "#1e3a5f";
const GOLD = "#c9a96e";
const EMERALD = "#2d6a4f";
const BORDEAUX = "#9b2226";
const AMBER = "#ca6702";

function pertinenceColor(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("favorable") && !v.includes("defavorable") && !v.includes("défavorable")) return EMERALD;
  if (v.includes("defavorable") || v.includes("défavorable")) return BORDEAUX;
  if (v.includes("nuanc")) return AMBER;
  return "#6b7280";
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

export function EvidenceTable({ data }: { data: EvidenceTableData }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterPertinence, setFilterPertinence] = useState<"all" | "favorable" | "defavorable" | "nuance">("all");

  const hasPertinence = data.headers.some((h) => h.toLowerCase().includes("pertinence"));

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
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2.5 font-serif text-2xl text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e3a5f]/10">
            <Table className="h-5 w-5 text-[#1e3a5f]" />
          </div>
          Tableau de preuve statistique
        </h2>
        <p className="mt-2 text-sm text-slate-500 font-sans leading-relaxed">
          Ce tableau recapitule l&apos;integralite des decisions de justice mobilisees dans l&apos;analyse
          et constitue la base probatoire des statistiques presentees. Chaque ligne correspond
          a une decision reelle, identifiee par sa reference (ECLI, n° de pourvoi ou reference Cass.).
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm" title="Nombre total de decisions de justice analysees dans le cadre de cette recherche jurimetrique">
            <p className="text-2xl font-bold" style={{ color: NAVY }}>{stats.total}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Decisions analysees</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm" title="Decisions dont l'issue soutient la position juridique de votre client (demande accueillie, cassation favorable, etc.)">
            <p className="text-2xl font-bold" style={{ color: EMERALD }}>{stats.favorable}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Favorables</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm" title="Decisions dont l'issue est contraire a la position de votre client — a analyser pour anticiper les moyens adverses">
            <p className="text-2xl font-bold" style={{ color: BORDEAUX }}>{stats.defavorable}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Defavorables</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm" title="Decisions a l'issue mitigee ou dont la pertinence depend du contexte precis du dossier (cassation partielle, gain partiel)">
            <p className="text-2xl font-bold" style={{ color: AMBER }}>{stats.nuance}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nuancees</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher dans le tableau..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#1e3a5f]/40 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/20"
          />
        </div>

        {/* Pertinence filter */}
        {hasPertinence && (
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            {[
              { key: "all" as const, label: "Toutes", count: stats?.total, tooltip: "Afficher toutes les decisions analysees sans filtre" },
              { key: "favorable" as const, label: "Favorables", count: stats?.favorable, tooltip: "Decisions dont l'issue est favorable a la partie demanderesse ou a une position juridique similaire a celle de votre client" },
              { key: "defavorable" as const, label: "Defavorables", count: stats?.defavorable, tooltip: "Decisions dont l'issue est defavorable — utiles pour anticiper les arguments adverses et les risques" },
              { key: "nuance" as const, label: "Nuancees", count: stats?.nuance, tooltip: "Decisions a l'issue mitigee (cassation partielle, gain partiel) ou dont la pertinence depend du contexte specifique du dossier" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterPertinence(f.key)}
                title={f.tooltip}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filterPertinence === f.key
                    ? "bg-[#1e3a5f] text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {f.label} {f.count !== undefined && `(${f.count})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Column count indicator */}
      {data.headers.length > 10 && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Table className="h-3.5 w-3.5" />
          {data.headers.length} colonnes — faites defiler horizontalement pour voir l&apos;ensemble des facteurs decisifs
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm" style={{ minWidth: data.headers.length > 8 ? `${data.headers.length * 140}px` : undefined }}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {data.headers.map((header, colIdx) => (
                <th
                  key={header}
                  onClick={() => handleSort(header)}
                  className={`cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-700 ${
                    colIdx === 0 ? "sticky left-0 z-10 bg-slate-50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {header}
                    {sortCol === header ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="h-3 w-3 text-[#1e3a5f]" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-[#1e3a5f]" />
                      )
                    ) : (
                      <ChevronDown className="h-3 w-3 text-slate-300" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                  i % 2 === 0 ? "bg-white" : "bg-slate-25"
                }`}
              >
                {data.headers.map((header, colIdx) => {
                  const value = row[header] || "";
                  const isPertinence = header.toLowerCase().includes("pertinence");
                  const isFirstCol = colIdx === 0;
                  const bgClass = i % 2 === 0 ? "bg-white" : "bg-slate-25";

                  return (
                    <td
                      key={header}
                      className={`whitespace-nowrap px-4 py-3 text-slate-700 ${
                        isFirstCol ? `sticky left-0 z-10 ${bgClass} shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]` : ""
                      }`}
                    >
                      {isPertinence ? (
                        <div className="flex items-center gap-1.5">
                          {pertinenceIcon(value)}
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{
                              color: pertinenceColor(value),
                              backgroundColor: pertinenceColor(value) + "10",
                            }}
                          >
                            {value}
                          </span>
                        </div>
                      ) : (
                        <span className={header.toLowerCase() === "decision" || header === "N°" ? "font-mono text-xs" : ""}>
                          {value}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={data.headers.length}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  Aucune decision ne correspond aux criteres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-400">
        {filtered.length} decision{filtered.length > 1 ? "s" : ""} affichee{filtered.length > 1 ? "s" : ""}
        {filtered.length !== data.rows.length && ` sur ${data.rows.length}`}
      </p>

      {/* Synthesis blocks */}
      {(data.synthese || data.periode || data.interpretation) && (
        <div className="space-y-3">
          {data.synthese && (
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[#1e3a5f]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Synthese</p>
                <p className="text-sm leading-relaxed text-slate-700">{data.synthese}</p>
              </div>
            </div>
          )}
          {data.periode && (
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Periode couverte</p>
                <p className="text-sm leading-relaxed text-slate-700">{data.periode}</p>
              </div>
            </div>
          )}
          {data.interpretation && (
            <div className="flex gap-3 rounded-xl border p-4" style={{ borderColor: GOLD + "40", backgroundColor: GOLD + "06" }}>
              <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>
                  Ce que cela signifie pour votre dossier
                </p>
                <p className="text-sm leading-relaxed text-slate-700">{data.interpretation}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-slate-400 leading-relaxed italic">
        Ce tableau est genere automatiquement a partir des decisions de justice identifiees lors de l&apos;analyse.
        Les sources proviennent de la base Judilibre (Cour de cassation) et/ou des connaissances jurisprudentielles
        consolidees du modele. Ces resultats constituent une aide a la decision strategique et ne sauraient
        se substituer a l&apos;analyse juridique du conseil.
      </p>
    </div>
  );
}
