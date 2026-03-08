"use client";

import { useState } from "react";

export default function ComparateurPage() {
  const [context, setContext] = useState("");
  const [strategyA, setStrategyA] = useState("");
  const [strategyB, setStrategyB] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!context.trim() || !strategyA.trim() || !strategyB.trim()) return;
    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/comparateur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, strategyA, strategyB }),
      });

      if (!res.ok) throw new Error("Erreur lors de la comparaison");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setResult(text);
        }
      }
    } catch (error) {
      console.error(error);
      setResult("Une erreur est survenue lors de la comparaison.");
    } finally {
      setLoading(false);
    }
  };

  const parsed = parseComparison(result);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#1e3a5f]">
          Comparateur de strategies
        </h1>
        <p className="text-muted-foreground">
          Comparez deux strategies juridiques pour identifier la plus adaptee a
          votre affaire.
        </p>
      </div>

      {/* Context field */}
      <div className="rounded-lg border bg-card p-6">
        <label className="mb-2 block font-serif text-sm font-semibold text-[#1e3a5f]">
          Contexte de l&apos;affaire
        </label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={4}
          placeholder="Decrivez les faits de l'affaire, le contexte, les parties en presence..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      {/* Two strategy columns */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <label className="mb-2 block font-serif text-sm font-semibold text-[#1e3a5f]">
            Strategie A
          </label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={5}
            placeholder="Decrivez la premiere strategie..."
            value={strategyA}
            onChange={(e) => setStrategyA(e.target.value)}
          />
        </div>

        <div className="rounded-lg border bg-card p-6">
          <label className="mb-2 block font-serif text-sm font-semibold text-[#1e3a5f]">
            Strategie B
          </label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={5}
            placeholder="Decrivez la deuxieme strategie..."
            value={strategyB}
            onChange={(e) => setStrategyB(e.target.value)}
          />
        </div>
      </div>

      {/* Compare button */}
      <div className="flex justify-center">
        <button
          onClick={handleCompare}
          disabled={
            loading || !context.trim() || !strategyA.trim() || !strategyB.trim()
          }
          className="rounded-lg bg-[#1e3a5f] px-8 py-3 font-serif text-lg font-semibold text-white transition-colors hover:bg-[#2a4d7a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Analyse en cours..." : "Comparer"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Side-by-side strategy cards */}
          {(parsed.strategyA.title || parsed.strategyB.title) && (
            <div className="grid gap-6 md:grid-cols-2">
              <StrategyCard strategy={parsed.strategyA} label="A" />
              <StrategyCard strategy={parsed.strategyB} label="B" />
            </div>
          )}

          {/* Verdict section */}
          {parsed.verdict && (
            <div className="rounded-lg border-2 border-[#c9a96e] bg-card p-6">
              <h2 className="mb-4 font-serif text-xl font-bold text-[#c9a96e]">
                Verdict comparatif
              </h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: formatMarkdown(parsed.verdict),
                }}
              />
            </div>
          )}

          {/* Raw fallback if parsing didn't extract structured data */}
          {!parsed.strategyA.title && !parsed.verdict && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 font-serif text-xl font-bold text-[#1e3a5f]">
                Resultat de la comparaison
              </h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(result) }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Parsed types & helpers ----------

interface ParsedStrategy {
  title: string;
  taux: string;
  tauxColor: string;
  arguments: string;
  risques: string;
  delais: string;
  montants: string;
  raw: string;
}

interface ParsedComparison {
  strategyA: ParsedStrategy;
  strategyB: ParsedStrategy;
  verdict: string;
}

function emptyStrategy(): ParsedStrategy {
  return {
    title: "",
    taux: "",
    tauxColor: "text-gray-500",
    arguments: "",
    risques: "",
    delais: "",
    montants: "",
    raw: "",
  };
}

function getTauxColor(taux: string): string {
  const match = taux.match(/(\d+)/);
  if (!match) return "text-gray-500";
  const n = parseInt(match[1], 10);
  if (n >= 60) return "text-[#2d6a4f]";
  if (n >= 35) return "text-amber-600";
  return "text-red-600";
}

function extractSection(text: string, heading: string): string {
  const regex = new RegExp(
    `###\\s*${heading}\\s*\\n([\\s\\S]*?)(?=###|##|$)`,
    "i"
  );
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function parseComparison(raw: string): ParsedComparison {
  const result: ParsedComparison = {
    strategyA: emptyStrategy(),
    strategyB: emptyStrategy(),
    verdict: "",
  };

  // Split by ## headings
  const stratAMatch = raw.match(
    /## Strategie A\s*:\s*(.+?)\n([\s\S]*?)(?=## Strategie B|$)/i
  );
  const stratBMatch = raw.match(
    /## Strategie B\s*:\s*(.+?)\n([\s\S]*?)(?=## Verdict|$)/i
  );
  const verdictMatch = raw.match(/## Verdict comparatif\s*\n([\s\S]*)/i);

  if (stratAMatch) {
    const body = stratAMatch[2];
    const taux = extractSection(body, "Taux de succes estime");
    result.strategyA = {
      title: stratAMatch[1].trim(),
      taux,
      tauxColor: getTauxColor(taux),
      arguments: extractSection(body, "Arguments principaux"),
      risques: extractSection(body, "Risques"),
      delais: extractSection(body, "Delais previsibles"),
      montants: extractSection(body, "Montants previsibles"),
      raw: body,
    };
  }

  if (stratBMatch) {
    const body = stratBMatch[2];
    const taux = extractSection(body, "Taux de succes estime");
    result.strategyB = {
      title: stratBMatch[1].trim(),
      taux,
      tauxColor: getTauxColor(taux),
      arguments: extractSection(body, "Arguments principaux"),
      risques: extractSection(body, "Risques"),
      delais: extractSection(body, "Delais previsibles"),
      montants: extractSection(body, "Montants previsibles"),
      raw: body,
    };
  }

  if (verdictMatch) {
    result.verdict = verdictMatch[1].trim();
  }

  return result;
}

function StrategyCard({
  strategy,
  label,
}: {
  strategy: ParsedStrategy;
  label: string;
}) {
  if (!strategy.title) return null;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 font-serif text-lg font-bold text-[#1e3a5f]">
        Strategie {label} : {strategy.title}
      </h2>

      {/* Taux de succes */}
      {strategy.taux && (
        <div className="mb-4 rounded-md bg-muted/50 p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Taux de succes estime
          </p>
          <p className={`font-serif text-3xl font-bold ${strategy.tauxColor}`}>
            {strategy.taux.match(/\d+\s*%/)?.[0] || strategy.taux}
          </p>
        </div>
      )}

      {/* Arguments */}
      {strategy.arguments && (
        <div className="mb-3">
          <h3 className="mb-1 font-serif text-sm font-semibold text-[#1e3a5f]">
            Arguments principaux
          </h3>
          <div
            className="text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{
              __html: formatMarkdown(strategy.arguments),
            }}
          />
        </div>
      )}

      {/* Risques */}
      {strategy.risques && (
        <div className="mb-3">
          <h3 className="mb-1 font-serif text-sm font-semibold text-red-700">
            Risques identifies
          </h3>
          <div
            className="text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{
              __html: formatMarkdown(strategy.risques),
            }}
          />
        </div>
      )}

      {/* Delais */}
      {strategy.delais && (
        <div className="mb-3">
          <h3 className="mb-1 font-serif text-sm font-semibold text-[#1e3a5f]">
            Delais previsibles
          </h3>
          <p className="text-sm text-muted-foreground">{strategy.delais}</p>
        </div>
      )}

      {/* Montants */}
      {strategy.montants && (
        <div>
          <h3 className="mb-1 font-serif text-sm font-semibold text-[#c9a96e]">
            Montants previsibles
          </h3>
          <p className="text-sm text-muted-foreground">{strategy.montants}</p>
        </div>
      )}
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-base font-semibold mt-4 mb-1 font-serif text-[#1e3a5f]">$1</h3>'
    )
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
