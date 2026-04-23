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
      setResult("Erreur: Une erreur est survenue lors de la comparaison.");
    } finally {
      setLoading(false);
    }
  };

  const parsed = parseComparison(result);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-10">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: "var(--gold)" }}
          >
            § Comparateur
          </span>
          <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>

        {/* Title */}
        <h1 className="font-serif text-[36px] lg:text-[40px] font-medium tracking-tight mb-3">
          Comparez <span className="dv-italic">deux stratégies.</span>
        </h1>
        <p
          className="text-[14px] max-w-[640px] mb-10"
          style={{ color: "var(--muted-foreground)" }}
        >
          Mettez en regard deux approches contentieuses pour identifier la stratégie la plus favorable à votre client : arguments, risques, délais et montants comparés côte à côte.
        </p>

        {/* Context field */}
        <div className="mb-6">
          <div
            className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            01 · Contexte de l&apos;affaire
          </div>
          <textarea
            className="w-full px-4 py-3 text-[14px] leading-[1.6] bg-transparent outline-none resize-none rounded-md"
            style={{
              border: "1px solid var(--line)",
              background: "var(--card)",
              color: "var(--ink)",
            }}
            rows={3}
            placeholder="Faits de l'affaire, parties en présence, juridiction visée…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        {/* Two strategy columns */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {[
            { letter: "A", value: strategyA, setter: setStrategyA },
            { letter: "B", value: strategyB, setter: setStrategyB },
          ].map(({ letter, value, setter }) => (
            <div key={letter}>
              <div
                className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                § {letter} · Stratégie {letter}
              </div>
              <textarea
                className="w-full px-4 py-3 text-[14px] leading-[1.6] bg-transparent outline-none resize-none rounded-md"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--ink)",
                }}
                rows={5}
                placeholder={`Approche ${letter} : arguments, fondements juridiques, demandes…`}
                value={value}
                onChange={(e) => setter(e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Compare button */}
        <div className="flex justify-center mb-10">
          <button
            onClick={handleCompare}
            disabled={
              loading || !context.trim() || !strategyA.trim() || !strategyB.trim()
            }
            className="flex items-center gap-2 px-6 py-3 text-[13px] font-semibold text-white rounded-md cursor-pointer transition-all disabled:opacity-40"
            style={{ background: "var(--ink)" }}
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyse en cours…
              </>
            ) : (
              "Comparer les stratégies"
            )}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div
            className="space-y-8 pt-10"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            {(parsed.strategyA.title || parsed.strategyB.title) && (
              <div className="grid gap-5 md:grid-cols-2">
                <StrategyCard strategy={parsed.strategyA} label="A" />
                <StrategyCard strategy={parsed.strategyB} label="B" />
              </div>
            )}

            {/* Verdict */}
            {parsed.verdict && (
              <div
                className="p-6 rounded-md"
                style={{
                  border: "1px solid var(--gold)",
                  background: "color-mix(in srgb, var(--gold) 5%, var(--card))",
                }}
              >
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                  style={{ color: "var(--gold)" }}
                >
                  § Verdict comparatif
                </div>
                <div
                  className="prose-legal max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(parsed.verdict),
                  }}
                />
              </div>
            )}

            {/* Raw fallback */}
            {!parsed.strategyA.title && !parsed.verdict && (
              <div
                className="p-6 rounded-md"
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                }}
              >
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
                  style={{ color: "var(--gold)" }}
                >
                  § Résultat de la comparaison
                </div>
                <div
                  className="prose-legal max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(result) }}
                />
              </div>
            )}
          </div>
        )}
      </div>
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
    /## Stratégie A\s*:\s*(.+?)\n([\s\S]*?)(?=## Stratégie B|$)/i
  );
  const stratBMatch = raw.match(
    /## Stratégie B\s*:\s*(.+?)\n([\s\S]*?)(?=## Verdict|$)/i
  );
  const verdictMatch = raw.match(/## Verdict comparatif\s*\n([\s\S]*)/i);

  if (stratAMatch) {
    const body = stratAMatch[2];
    const taux = extractSection(body, "Taux de succès estimé");
    result.strategyA = {
      title: stratAMatch[1].trim(),
      taux,
      tauxColor: getTauxColor(taux),
      arguments: extractSection(body, "Arguments principaux"),
      risques: extractSection(body, "Risques"),
      delais: extractSection(body, "Délais prévisibles"),
      montants: extractSection(body, "Montants prévisibles"),
      raw: body,
    };
  }

  if (stratBMatch) {
    const body = stratBMatch[2];
    const taux = extractSection(body, "Taux de succès estimé");
    result.strategyB = {
      title: stratBMatch[1].trim(),
      taux,
      tauxColor: getTauxColor(taux),
      arguments: extractSection(body, "Arguments principaux"),
      risques: extractSection(body, "Risques"),
      delais: extractSection(body, "Délais prévisibles"),
      montants: extractSection(body, "Montants prévisibles"),
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

  const tauxNum = strategy.taux.match(/(\d+)/);
  const tauxValue = tauxNum ? parseInt(tauxNum[1], 10) : null;
  const tauxColor =
    tauxValue == null
      ? "var(--muted-foreground)"
      : tauxValue >= 60
        ? "var(--emerald, #2d6a4f)"
        : tauxValue >= 35
          ? "var(--amber, #ca6702)"
          : "var(--bordeaux, #9b2226)";

  return (
    <div
      className="p-6 rounded-md"
      style={{
        border: "1px solid var(--line)",
        background: "var(--card)",
      }}
    >
      <div
        className="flex items-center justify-between mb-3"
        style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 10 }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "var(--gold)" }}
        >
          § {label}
        </div>
        <div
          className="font-mono text-[9.5px] tabular-nums"
          style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
        >
          Stratégie
        </div>
      </div>

      <h3
        className="font-serif text-[20px] font-medium tracking-tight mb-4"
        style={{ color: "var(--ink)" }}
      >
        {strategy.title}
      </h3>

      {/* Taux hero */}
      {strategy.taux && (
        <div className="mb-5 pb-4" style={{ borderBottom: "1px solid var(--line-soft)" }}>
          <div
            className="font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Taux de succès
          </div>
          <div
            className="font-serif font-medium tabular-nums"
            style={{
              fontSize: "44px",
              color: tauxColor,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {tauxValue ?? "—"}
            {tauxValue != null && (
              <span
                className="text-[22px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                %
              </span>
            )}
          </div>
        </div>
      )}

      {/* Arguments / Risques / Délais / Montants */}
      <div className="space-y-4">
        <StrategyField label="Arguments principaux" value={strategy.arguments} />
        <StrategyField
          label="Risques identifiés"
          value={strategy.risques}
          emphasis="bordeaux"
        />
        <StrategyField label="Délais prévisibles" value={strategy.delais} />
        <StrategyField
          label="Montants prévisibles"
          value={strategy.montants}
          emphasis="gold"
        />
      </div>
    </div>
  );
}

function StrategyField({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "gold" | "bordeaux";
}) {
  if (!value) return null;
  const color =
    emphasis === "gold"
      ? "var(--gold)"
      : emphasis === "bordeaux"
        ? "var(--bordeaux, #9b2226)"
        : "var(--muted-foreground)";
  return (
    <div>
      <div
        className="font-mono text-[9.5px] uppercase tracking-[0.2em] mb-1"
        style={{ color }}
      >
        {label}
      </div>
      <div
        className="text-[13px] leading-[1.6]"
        style={{ color: "var(--ink)" }}
        dangerouslySetInnerHTML={{ __html: formatMarkdown(value) }}
      />
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-[14px] font-semibold mt-3 mb-1 font-serif">$1</h3>'
    )
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
