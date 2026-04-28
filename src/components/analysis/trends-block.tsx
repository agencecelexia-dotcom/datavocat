"use client";

import type { ParsedAnalysis } from "@/lib/parse-analysis";
import { TrendingUp, TrendingDown, Minus, MapPin, Layers } from "lucide-react";

/**
 * Bloc d'analyse statistique avancée (Niveau 3 jurimétrie) :
 *  - Tendance temporelle du taux d'acceptation (par année)
 *  - Variations régionales (par cour d'appel)
 *  - Variations par chambre/formation
 *  - Variations par thème juridique
 *
 * Affiche uniquement les sections où on a assez de données.
 * Affichage minimaliste, pas de graphique JS lourd : barres CSS.
 */
export function TrendsBlock({ data }: { data: ParsedAnalysis }) {
  const v = data.verification;
  if (!v) return null;
  const { temporalTrend, regionalVariations, chamberVariations, themeVariations } = v;

  const hasTemporal =
    temporalTrend && temporalTrend.buckets && temporalTrend.buckets.length >= 3;
  const hasRegional = regionalVariations && regionalVariations.length >= 2;
  const hasChamber = chamberVariations && chamberVariations.length >= 2;
  const hasTheme = themeVariations && themeVariations.length >= 2;

  if (!hasTemporal && !hasRegional && !hasChamber && !hasTheme) return null;

  return (
    <div className="space-y-8 mt-10">
      <div>
        <div
          className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
          style={{ color: "var(--gold)" }}
        >
          § Analyse statistique avancée
        </div>
        <h2 className="font-serif text-[24px] font-medium tracking-tight">
          Tendances <span className="dv-italic">jurisprudentielles.</span>
        </h2>
        <p
          className="mt-2 text-[13px] leading-relaxed max-w-2xl"
          style={{ color: "var(--muted-foreground)" }}
        >
          Statistiques calculées arithmétiquement sur le corpus du fond
          (CA + 1<sup>er</sup> degré). Au-delà du taux global, ces tendances
          révèlent où, quand et comment la jurisprudence évolue.
        </p>
      </div>

      {/* TEMPORAL TREND */}
      {hasTemporal && temporalTrend && (
        <TemporalTrend trend={temporalTrend} />
      )}

      {/* REGIONAL */}
      {hasRegional && regionalVariations && (
        <VariationsList
          icon={<MapPin className="h-3.5 w-3.5" />}
          title="Variations par cour d'appel"
          subtitle="Identifie les juridictions les plus favorables et défavorables"
          rows={regionalVariations.slice(0, 8)}
        />
      )}

      {/* CHAMBER */}
      {hasChamber && chamberVariations && (
        <VariationsList
          icon={<Gavel />}
          title="Variations par chambre / formation"
          subtitle="Pertinent pour orienter la stratégie de saisine"
          rows={chamberVariations.slice(0, 6)}
        />
      )}

      {/* THEME */}
      {hasTheme && themeVariations && (
        <VariationsList
          icon={<Layers className="h-3.5 w-3.5" />}
          title="Variations par thème juridique"
          subtitle="Sous-sujets discriminants au sein du contentieux"
          rows={themeVariations.slice(0, 8)}
        />
      )}
    </div>
  );
}

function Gavel() {
  // Importé via dynamic pour éviter conflit avec le dashboard
  return <Layers className="h-3.5 w-3.5" />;
}

function rateColor(rate: number): string {
  if (rate >= 60) return "var(--emerald, #2d6a4f)";
  if (rate >= 40) return "var(--gold, #b88a3e)";
  return "var(--bordeaux, #9b2226)";
}

function TemporalTrend({
  trend,
}: {
  trend: NonNullable<NonNullable<ParsedAnalysis["verification"]>["temporalTrend"]>;
}) {
  const { buckets, direction, deltaPct, medianYear } = trend;
  const max = Math.max(...buckets.map((b) => b.rate), 100);
  const dirLabel =
    direction === "ascending"
      ? "En hausse"
      : direction === "descending"
        ? "En baisse"
        : direction === "flat"
          ? "Stable"
          : "Insuffisant";
  const dirIcon =
    direction === "ascending" ? (
      <TrendingUp className="h-4 w-4" style={{ color: "var(--emerald, #2d6a4f)" }} />
    ) : direction === "descending" ? (
      <TrendingDown className="h-4 w-4" style={{ color: "var(--bordeaux, #9b2226)" }} />
    ) : (
      <Minus className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
    );

  return (
    <div
      className="rounded-md p-4 sm:p-5"
      style={{ border: "1px solid var(--line)", background: "var(--card)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        {dirIcon}
        <h3 className="font-serif text-[16px] font-medium">
          Tendance temporelle — <span className="dv-italic">{dirLabel}</span>
        </h3>
      </div>
      <p
        className="text-[12px] mb-4"
        style={{ color: "var(--muted-foreground)" }}
      >
        Variation : <strong>{deltaPct >= 0 ? "+" : ""}{deltaPct} pts</strong>{" "}
        sur la période ·{" "}
        {medianYear ? (
          <>Année médiane : <strong>{medianYear}</strong></>
        ) : null}
      </p>

      {/* Barres horizontales par année */}
      <div className="space-y-2">
        {buckets.map((b) => (
          <div key={b.year} className="flex items-center gap-3">
            <div
              className="font-mono text-[10.5px] tabular-nums w-12 flex-shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            >
              {b.year}
            </div>
            <div
              className="relative flex-1 h-[14px] rounded-sm overflow-hidden"
              style={{ background: "var(--paper-2, #f6f4ef)" }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all"
                style={{
                  width: `${(b.rate / max) * 100}%`,
                  background: rateColor(b.rate),
                  opacity: 0.85,
                }}
              />
            </div>
            <div className="font-mono text-[11px] tabular-nums w-20 flex-shrink-0 text-right">
              <span className="font-semibold">{b.rate}%</span>
              <span style={{ color: "var(--muted-foreground)" }}>
                {" "}({b.favorables}/{b.total})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VariationsList({
  icon,
  title,
  subtitle,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  rows: Array<{ label: string; total: number; favorables: number; rate: number }>;
}) {
  if (!rows || rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.rate), 100);

  return (
    <div
      className="rounded-md p-4 sm:p-5"
      style={{ border: "1px solid var(--line)", background: "var(--card)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: "var(--muted-foreground)" }}>{icon}</span>
        <h3 className="font-serif text-[16px] font-medium">{title}</h3>
      </div>
      <p
        className="text-[11.5px] mb-3"
        style={{ color: "var(--muted-foreground)" }}
      >
        {subtitle}
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div
              className="text-[12px] flex-shrink-0 truncate"
              style={{ width: "180px", color: "var(--ink)" }}
              title={r.label}
            >
              {r.label}
            </div>
            <div
              className="relative flex-1 h-[12px] rounded-sm overflow-hidden"
              style={{ background: "var(--paper-2, #f6f4ef)" }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-sm"
                style={{
                  width: `${(r.rate / max) * 100}%`,
                  background: rateColor(r.rate),
                  opacity: 0.85,
                }}
              />
            </div>
            <div className="font-mono text-[10.5px] tabular-nums w-20 flex-shrink-0 text-right">
              <span className="font-semibold">{r.rate}%</span>
              <span style={{ color: "var(--muted-foreground)" }}>
                {" "}({r.total})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
