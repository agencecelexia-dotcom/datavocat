"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Search,
  Loader2,
  ExternalLink,
  BookmarkPlus,
  Trash2,
  RefreshCw,
  Filter,
  ChevronDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface JudilibreDecision {
  id: string;
  jurisdiction: string;
  chamber: string;
  number: string[];
  ecli: string;
  date: string;
  solution: string;
  solution_alt?: string;
  themes?: string[];
  sommaire?: string;
  highlights?: Record<string, string[]>;
}

interface SearchResult {
  results: JudilibreDecision[];
  total: number;
  next_page?: string;
}

interface SavedWatch {
  id: string;
  query: string;
  chamber?: string;
  dateStart?: string;
  dateEnd?: string;
  solution?: string;
  createdAt: string;
  lastRun?: string;
  resultCount?: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const CHAMBERS: Record<string, string> = {
  soc: "Chambre sociale",
  civ1: "1ere chambre civile",
  civ2: "2eme chambre civile",
  civ3: "3eme chambre civile",
  com: "Chambre commerciale",
  crim: "Chambre criminelle",
  mi: "Chambre mixte",
  pl: "Assemblee pleniere",
};

const CHAMBER_OPTIONS = [
  { value: "", label: "Toutes les chambres" },
  { value: "soc", label: "Chambre sociale" },
  { value: "civ1", label: "1ere chambre civile" },
  { value: "civ2", label: "2eme chambre civile" },
  { value: "civ3", label: "3eme chambre civile" },
  { value: "com", label: "Chambre commerciale" },
  { value: "crim", label: "Chambre criminelle" },
];

const SOLUTION_OPTIONS = [
  { value: "", label: "Toutes les solutions" },
  { value: "cassation", label: "Cassation" },
  { value: "rejet", label: "Rejet" },
];

// ─── LocalStorage helpers ────────────────────────────────────────────

function loadWatches(): SavedWatch[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("datavocat_veilles");
  return raw ? JSON.parse(raw) : [];
}

function saveWatches(watches: SavedWatch[]) {
  localStorage.setItem("datavocat_veilles", JSON.stringify(watches));
}

// ─── Page ────────────────────────────────────────────────────────────

export default function VeillePage() {
  // Search form state
  const [query, setQuery] = useState("");
  const [chamber, setChamber] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [solution, setSolution] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Results state
  const [results, setResults] = useState<JudilibreDecision[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Saved watches
  const [watches, setWatches] = useState<SavedWatch[]>([]);

  useEffect(() => {
    setWatches(loadWatches());
  }, []);

  const doSearch = useCallback(
    async (batch?: string) => {
      if (!query.trim()) return;

      if (batch) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setResults([]);
        setTotal(0);
        setNextPage(undefined);
        setError("");
      }

      try {
        const params = new URLSearchParams({ query: query.trim() });
        if (chamber) params.set("chamber", chamber);
        if (dateStart) params.set("dateStart", dateStart);
        if (dateEnd) params.set("dateEnd", dateEnd);
        if (solution) params.set("solution", solution);
        if (batch) params.set("batch", batch);

        const res = await fetch(`/api/veille?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Erreur ${res.status}`);
        }

        const data: SearchResult = await res.json();

        if (batch) {
          setResults((prev) => [...prev, ...data.results]);
        } else {
          setResults(data.results);
          setTotal(data.total);
        }
        setNextPage(data.next_page);
        setHasSearched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, chamber, dateStart, dateEnd, solution]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch();
  }

  function handleSaveWatch() {
    if (!query.trim()) return;
    const newWatch: SavedWatch = {
      id: crypto.randomUUID(),
      query: query.trim(),
      chamber: chamber || undefined,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      solution: solution || undefined,
      createdAt: new Date().toISOString(),
      lastRun: hasSearched ? new Date().toISOString() : undefined,
      resultCount: hasSearched ? total : undefined,
    };
    const updated = [newWatch, ...watches];
    setWatches(updated);
    saveWatches(updated);
  }

  function handleRelaunch(watch: SavedWatch) {
    setQuery(watch.query);
    setChamber(watch.chamber || "");
    setDateStart(watch.dateStart || "");
    setDateEnd(watch.dateEnd || "");
    setSolution(watch.solution || "");
    if (watch.chamber || watch.dateStart || watch.dateEnd || watch.solution) {
      setShowFilters(true);
    }
    // We need to trigger search after state updates, so use setTimeout
    setTimeout(() => {
      const params = new URLSearchParams({ query: watch.query });
      if (watch.chamber) params.set("chamber", watch.chamber);
      if (watch.dateStart) params.set("dateStart", watch.dateStart);
      if (watch.dateEnd) params.set("dateEnd", watch.dateEnd);
      if (watch.solution) params.set("solution", watch.solution);

      setLoading(true);
      setResults([]);
      setTotal(0);
      setNextPage(undefined);
      setError("");

      fetch(`/api/veille?${params.toString()}`)
        .then((res) => res.json())
        .then((data: SearchResult) => {
          setResults(data.results);
          setTotal(data.total);
          setNextPage(data.next_page);
          setHasSearched(true);

          // Update watch with new result count
          const idx = watches.findIndex((w) => w.id === watch.id);
          if (idx !== -1) {
            const updatedWatches = [...watches];
            updatedWatches[idx] = {
              ...updatedWatches[idx],
              lastRun: new Date().toISOString(),
              resultCount: data.total,
            };
            setWatches(updatedWatches);
            saveWatches(updatedWatches);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
        })
        .finally(() => setLoading(false));
    }, 0);
  }

  function handleDeleteWatch(id: string) {
    const updated = watches.filter((w) => w.id !== id);
    setWatches(updated);
    saveWatches(updated);
  }

  function solutionColor(sol: string) {
    const lower = sol.toLowerCase();
    if (lower.includes("rejet")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (lower.includes("cassation")) return "bg-red-100 text-red-800 border-red-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  }

  function stripEm(text: string) {
    return text.replace(/<\/?em>/g, "");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Page title */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#1e3a5f]">
          Veille Jurisprudentielle
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recherchez dans la base Judilibre de la Cour de cassation
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher des decisions (ex: licenciement economique, prise d'acte...)"
              className="h-11 pl-10 text-base"
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-11 bg-[#1e3a5f] px-6 text-white hover:bg-[#1e3a5f]/90"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Search className="size-4" />
                <span className="ml-1.5">Rechercher</span>
              </>
            )}
          </Button>
        </div>

        {/* Collapsible filters */}
        <div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:text-[#1e3a5f]/70 transition-colors"
          >
            <Filter className="size-3.5" />
            <span>Filtres avances</span>
            <ChevronDown
              className={`size-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>

          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-[#1e3a5f]/10 bg-[#1e3a5f]/[0.02] p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Chambre
                </label>
                <select
                  value={chamber}
                  onChange={(e) => setChamber(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {CHAMBER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Date debut
                </label>
                <Input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Date fin
                </label>
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Solution
                </label>
                <select
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {SOLUTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Save watch button */}
        {query.trim() && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveWatch}
            className="border-[#c9a96e]/40 text-[#c9a96e] hover:bg-[#c9a96e]/10 hover:text-[#c9a96e]"
          >
            <BookmarkPlus className="size-3.5" />
            <span className="ml-1">Sauvegarder cette recherche</span>
          </Button>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#1e3a5f]">
            {total} decision{total !== 1 ? "s" : ""} trouvee{total !== 1 ? "s" : ""}
          </h2>

          <div className="grid gap-4">
            {results.map((dec) => (
              <Card
                key={dec.id}
                className="transition-shadow hover:shadow-md hover:ring-[#1e3a5f]/20"
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-[#1e3a5f]">
                      {CHAMBERS[dec.chamber] || dec.chamber}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date(dec.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* ECLI */}
                  <a
                    href={`https://www.legifrance.gouv.fr/search/juri?query=${encodeURIComponent(dec.ecli)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#1e3a5f] underline underline-offset-2 hover:text-[#c9a96e] transition-colors"
                  >
                    {dec.ecli}
                    <ExternalLink className="size-3" />
                  </a>

                  {/* Pourvoi numbers */}
                  {dec.number && dec.number.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Pourvoi(s) :</span>{" "}
                      {dec.number.join(", ")}
                    </p>
                  )}

                  {/* Solution badge */}
                  <div>
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${solutionColor(dec.solution)}`}
                    >
                      {dec.solution_alt || dec.solution}
                    </span>
                  </div>

                  {/* Themes */}
                  {dec.themes && dec.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {dec.themes.slice(0, 5).map((theme, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-[#1e3a5f]/5 px-2 py-0.5 text-xs text-[#1e3a5f]"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Sommaire */}
                  {dec.sommaire && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {dec.sommaire.length > 200
                        ? dec.sommaire.slice(0, 200) + "..."
                        : dec.sommaire}
                    </p>
                  )}

                  {/* Highlights */}
                  {dec.highlights &&
                    Object.keys(dec.highlights).length > 0 && (
                      <div className="rounded-md bg-[#c9a96e]/5 p-3">
                        <p className="mb-1 text-xs font-medium text-[#c9a96e]">
                          Extraits pertinents
                        </p>
                        {Object.values(dec.highlights)
                          .flat()
                          .slice(0, 2)
                          .map((h, i) => (
                            <p
                              key={i}
                              className="text-xs leading-relaxed text-muted-foreground"
                            >
                              {stripEm(h).slice(0, 300)}
                              {h.length > 300 ? "..." : ""}
                            </p>
                          ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load more */}
          {nextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => doSearch(nextPage)}
                disabled={loadingMore}
                className="border-[#1e3a5f]/20 text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
              >
                {loadingMore ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span>Charger plus</span>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-[#1e3a5f]" />
        </div>
      )}

      {/* Saved watches */}
      {watches.length > 0 && (
        <div className="space-y-4 border-t pt-8">
          <h2 className="font-serif text-xl font-semibold text-[#1e3a5f]">
            Recherches sauvegardees
          </h2>

          <div className="grid gap-3">
            {watches.map((watch) => (
              <Card key={watch.id} size="sm">
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-[#1e3a5f] truncate">
                      {watch.query}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {watch.chamber && (
                        <span>{CHAMBERS[watch.chamber] || watch.chamber}</span>
                      )}
                      {watch.dateStart && <span>Depuis {watch.dateStart}</span>}
                      {watch.dateEnd && <span>Jusqu&apos;au {watch.dateEnd}</span>}
                      {watch.solution && (
                        <span className="capitalize">{watch.solution}</span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>
                        Creee le{" "}
                        {new Date(watch.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                      {watch.resultCount !== undefined && (
                        <span>{watch.resultCount} resultats</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRelaunch(watch)}
                      title="Relancer la recherche"
                    >
                      <RefreshCw className="size-3.5 text-[#1e3a5f]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteWatch(watch.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
