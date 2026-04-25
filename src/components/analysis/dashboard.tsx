"use client";

import { useEffect, useState } from "react";
import type { ParsedAnalysis } from "@/lib/parse-analysis";
import { TrendingUp, Gavel } from "lucide-react";

// ── Formatters ───────────────────────────────────────────────────────
const fmtEur = (v: number | null) =>
  v !== null
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v)
    : "—";

function confianceLabel(c: string | null): string {
  if (c === "élevé") return "Élevée";
  if (c === "moyen") return "Moyenne";
  if (c === "faible") return "Faible";
  return "—";
}

// Animation compteur (simple, sans effet cascadant)
function useCounter(target: number | null, duration = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === null || target === 0) {
      setV(0);
      return;
    }
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return v;
}

// ── Metadata type ────────────────────────────────────────────────────
export interface DashboardMeta {
  analyzedCount: number;
  totalFound: number;
  oldestDate: string | null;
  freshestDate: string | null;
}

// ── Section wrapper (border-bottom divider) ──────────────────────────
function Section({
  title,
  tooltip,
  children,
  className = "",
  noBorder = false,
}: {
  title: string;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
  noBorder?: boolean;
}) {
  return (
    <section
      className={`pb-8 mb-8 ${className}`}
      style={{ borderBottom: noBorder ? "none" : "1px solid var(--line)" }}
    >
      <h2
        className="font-serif text-[20px] font-medium mb-5 tracking-tight"
        title={tooltip}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Bar row ──────────────────────────────────────────────────────────
function BarRow({
  label,
  value,
  total,
  color,
  delay = 0,
  sampleText,
  lowSample,
}: {
  label: string;
  value: number;
  total?: number | null;
  color?: string;
  delay?: number;
  sampleText?: string | null;
  lowSample?: boolean;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 100 + delay * 60);
    return () => clearTimeout(t);
  }, [value, delay]);

  const barColor = color || "var(--ink)";

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="font-mono text-[10px] tabular-nums shrink-0"
            style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
          >
            {String(delay + 1).padStart(2, "0")}
          </span>
          <span
            className="text-[13px] truncate"
            style={{ color: "var(--ink)" }}
          >
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span
            className="font-mono text-[14px] tabular-nums font-semibold"
            style={{ color: barColor }}
          >
            {value}
          </span>
          <span
            className="font-mono text-[10px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            %
          </span>
          {typeof total === "number" && (
            <span
              className="font-mono text-[10px] ml-1"
              style={{ color: "var(--muted-foreground)", opacity: 0.6 }}
            >
              n={total}
            </span>
          )}
        </div>
      </div>
      <div
        className="h-[6px] rounded-full overflow-hidden relative"
        style={{ background: "var(--paper-2)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${w}%`,
            background: barColor,
            transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
        {/* seuil 50% */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{ left: "50%", background: "rgba(0,0,0,0.08)" }}
        />
      </div>
      {(sampleText || lowSample) && (
        <div
          className="mt-1 flex items-center gap-2 text-[10.5px]"
          style={{ color: "var(--muted-foreground)" }}
        >
          {sampleText && <span>{sampleText}</span>}
          {lowSample && (
            <span
              className="font-mono uppercase tracking-wider px-1.5 py-0.5 rounded text-[9px]"
              style={{
                background: "color-mix(in srgb, var(--amber, #ca6702) 10%, transparent)",
                color: "var(--amber, #ca6702)",
                border: "1px solid color-mix(in srgb, var(--amber, #ca6702) 30%, transparent)",
              }}
            >
              échantillon limité
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export function AnalysisDashboard({
  data,
  meta,
}: {
  data: ParsedAnalysis;
  meta?: DashboardMeta | null;
}) {
  const taux = data.tauxSuccesGlobal ?? 0;
  const risque = Math.max(0, 100 - taux);

  const args = [...data.arguments].sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0));
  const juris = [...data.juridictions].sort(
    (a, b) => (b.taux ?? 0) - (a.taux ?? 0)
  );
  const art700 = data.article700;
  const recommendations = extractRecommendations(data.recommandation);

  const hasMontants =
    data.montants.min !== null ||
    data.montants.median !== null ||
    data.montants.max !== null;

  return (
    <div>
      {/* ── BANDEAU VOLUMÉTRIE + PÉRIODE ─────────────────────── */}
      {((meta?.analyzedCount ?? 0) > 0 || meta?.oldestDate) && (
        <div
          className="rounded-md px-4 py-3 mb-8 text-[12px] leading-relaxed"
          style={{
            border: "1px solid var(--line)",
            background: "var(--paper)",
            color: "var(--ink)",
          }}
        >
          {(meta?.analyzedCount ?? 0) > 0 && (
            <>
              <span title="Décisions Judilibre transmises au modèle pour analyse, après reranking de pertinence">
                <span className="font-semibold">{meta!.analyzedCount}</span> décisions Judilibre lues par l'IA
              </span>
              {meta!.totalFound > meta!.analyzedCount && (
                <>
                  {" "}<span style={{ color: "var(--muted-foreground)" }}>(sur {meta!.totalFound} trouvées)</span>
                </>
              )}
              {data.sourceCount > 0 && (
                <>
                  {" "}·{" "}
                  <span title="Décisions effectivement citées dans le rapport et l'annexe des sources">
                    <span className="font-semibold">{data.sourceCount}</span> citées dans le rapport
                  </span>
                </>
              )}
              {data.evidenceTable && data.evidenceTable.rows.length > 0 && (
                <>
                  {" "}·{" "}
                  <span title="Décisions documentées avec leurs facteurs juridiques décisifs dans le tableau de preuve">
                    <span className="font-semibold">{data.evidenceTable.rows.length}</span> documentées dans le tableau
                  </span>
                </>
              )}
              .{" "}
              <span style={{ color: "var(--muted-foreground)" }}>
                Les pourcentages sont calculés sur les décisions citées et documentées.
              </span>
            </>
          )}
          {(meta?.analyzedCount ?? 0) === 0 && meta?.oldestDate && (
            <>
              Période couverte :{" "}
              <span className="font-semibold">{meta.oldestDate}</span> →{" "}
              <span className="font-semibold">{meta.freshestDate}</span>
            </>
          )}
          {(meta?.analyzedCount ?? 0) > 0 && meta?.oldestDate && (
            <>
              {" "}Période :{" "}
              <span className="font-semibold">{meta.oldestDate}</span> →{" "}
              <span className="font-semibold">{meta.freshestDate}</span>.
            </>
          )}
        </div>
      )}

      {/* ── Moyens juridiques + Juridictions (2 col) ─────────── */}
      {(args.length > 0 || juris.length > 0) && (
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 pb-8 mb-8"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          {args.length > 0 && (
            <div>
              <h2
                className="font-serif text-[20px] font-medium mb-5 tracking-tight"
                title="Taux de succès par moyen juridique invoqué, basé sur les décisions analysées. La ligne à 50% marque le seuil critique."
              >
                Moyens juridiques
              </h2>
              {args.map((arg, i) => {
                const invoque = arg.invoque ?? null;
                const retenu = arg.retenu ?? null;
                let sampleText: string | null = null;
                if (retenu != null && invoque != null) {
                  sampleText = `${retenu} retenus sur ${invoque} décisions invoquant l'argument`;
                } else if (invoque != null) {
                  sampleText = `Sur ${invoque} décisions invoquant l'argument`;
                }
                const lowSample = invoque != null && invoque < 10;
                return (
                  <BarRow
                    key={arg.name}
                    label={arg.name}
                    value={arg.taux ?? 0}
                    color="var(--ink)"
                    delay={i}
                    sampleText={sampleText}
                    lowSample={lowSample}
                  />
                );
              })}
            </div>
          )}
          {juris.length > 0 && (
            <div>
              <h2 className="font-serif text-[20px] font-medium mb-5 tracking-tight">
                Juridictions
              </h2>
              {juris.map((j, i) => (
                <BarRow
                  key={j.name}
                  label={j.name}
                  value={j.taux ?? 0}
                  total={"n" in j ? (j as { n?: number }).n : null}
                  color="var(--gold)"
                  delay={i}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Risque d'échec (rappel stratégique) ─────────────── */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 mb-8"
        style={{ borderBottom: "1px solid var(--line)" }}
        data-risques-section
      >
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            Risque d&apos;échec
          </div>
          <div className="flex items-baseline gap-1.5">
            <div
              className="font-serif font-medium tabular-nums"
              style={{
                fontSize: "44px",
                color: "var(--bordeaux)",
                lineHeight: 1,
              }}
            >
              {risque}
            </div>
            <div
              className="font-serif text-[22px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              %
            </div>
          </div>
          <div
            className="mt-3 text-[12px] leading-relaxed max-w-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            Calculé en miroir du taux de succès ({taux}%). Les facteurs de bascule ci-dessous permettent d&apos;anticiper l&apos;issue défavorable.
          </div>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <Metric label="Confiance" value={confianceLabel(data.confiance)} />
          <Metric
            label="Décisions tableau"
            value={
              data.evidenceTable && data.evidenceTable.rows.length > 0
                ? String(data.evidenceTable.rows.length)
                : data.echantillon != null
                  ? String(data.echantillon)
                  : "—"
            }
          />
          <Metric label="Sources citées" value={String(data.sourceCount)} />
        </div>
      </div>

      {/* ── Chronologie ─────────────────────────────────────── */}
      {/* Désactivé tant que parseAnalysis ne fournit pas de chronologie structurée — à brancher ultérieurement. */}

      {/* ── Montants + Article 700 (2 col) ────────────────── */}
      {(hasMontants || art700) && (
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 pb-8 mb-8"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          {hasMontants && (
            <div>
              <h2 className="font-serif text-[20px] font-medium mb-5 tracking-tight">
                Montants accordés
              </h2>
              <div className="relative h-[30px] mb-5">
                <div
                  className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[2px]"
                  style={{ background: "var(--line)" }}
                />
                {data.montants.min != null && (
                  <div
                    className="absolute"
                    style={{ left: "5%", top: "50%", transform: "translate(-50%, -50%)" }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: "var(--muted-foreground)" }}
                    />
                  </div>
                )}
                {data.montants.median != null && data.montants.max != null && (
                  <div
                    className="absolute"
                    style={{
                      left: `${Math.min(95, (data.montants.median / data.montants.max) * 95)}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full"
                      style={{
                        background: "var(--gold)",
                        boxShadow: "0 0 0 4px var(--bg)",
                      }}
                    />
                  </div>
                )}
                {data.montants.max != null && (
                  <div
                    className="absolute"
                    style={{ right: "2%", top: "50%", transform: "translateY(-50%)" }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: "var(--muted-foreground)" }}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Min." value={fmtEur(data.montants.min)} />
                <Metric label="Médian" value={fmtEur(data.montants.median)} em />
                <Metric label="Max." value={fmtEur(data.montants.max)} />
              </div>
            </div>
          )}
          {art700 && (
            <div>
              <h2 className="font-serif text-[20px] font-medium mb-5 tracking-tight">
                Article 700 CPC
              </h2>
              {art700.tauxCondamnation != null && (
                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <div
                      className="text-[12px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Taux de condamnation
                    </div>
                    <div
                      className="font-mono text-[20px] tabular-nums font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {art700.tauxCondamnation}%
                    </div>
                  </div>
                  <div
                    className="h-[6px] rounded-full overflow-hidden"
                    style={{ background: "var(--paper-2)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${art700.tauxCondamnation}%`,
                        background: "var(--gold)",
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Montant moyen" value={fmtEur(art700.montantMoyen)} />
                <Metric label="Montant médian" value={fmtEur(art700.montantMedian)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pipeline procédural ─────────────────────────────── */}
      {data.instances.length > 0 && (
        <Section title="Pipeline procédural">
          <div className="space-y-0">
            {data.instances.map((inst, i) => (
              <div
                key={inst.name}
                className="flex items-center gap-4 py-3"
                style={{
                  borderBottom:
                    i < data.instances.length - 1 ? "1px solid var(--line-soft)" : "none",
                }}
              >
                <div
                  className="shrink-0 font-mono text-[11px] tabular-nums w-6"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[14px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {inst.name}
                  </div>
                  <div
                    className="text-[11.5px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {inst.gagnees != null && inst.total != null
                      ? `${inst.gagnees} favorables sur ${inst.total} décisions`
                      : "Données insuffisantes"}
                  </div>
                </div>
                <div
                  className="font-mono text-[22px] tabular-nums font-semibold shrink-0"
                  style={{ color: "var(--ink)" }}
                >
                  {inst.taux ?? "—"}
                  {inst.taux != null && (
                    <span
                      className="text-[12px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      %
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Points d'attention stratégiques ─────────────────── */}
      {recommendations.length > 0 && (
        <Section title="Points d'attention" noBorder>
          <ol className="space-y-3">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-4">
                <span
                  className="shrink-0 font-mono text-[11px] tabular-nums mt-0.5"
                  style={{ color: "var(--gold)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p
                  className="text-[14px] leading-[1.6]"
                  style={{ color: "var(--ink)" }}
                >
                  {r}
                </p>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

// ── Metric mini-card (label + value) ────────────────────────────────
function Metric({
  label,
  value,
  em = false,
}: {
  label: string;
  value: string;
  em?: boolean;
}) {
  return (
    <div>
      <div
        className="font-mono text-[10px] uppercase tracking-[0.15em]"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
      <div
        className="font-mono text-[15px] tabular-nums font-semibold mt-0.5"
        style={{ color: em ? "var(--gold)" : "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Extract recommandations helper ──────────────────────────────────
// Nettoie les marqueurs markdown (###, **, -, etc.) et retourne des lignes propres.
function extractRecommendations(reco: string): string[] {
  if (!reco) return [];
  const lines = reco
    .split(/\n/)
    .map((l) => l
      // Retire les # de titres
      .replace(/^#{1,6}\s*/, "")
      // Retire les puces / numérotations
      .replace(/^[-•*]\s+/, "")
      .replace(/^\d+[.)]\s+/, "")
      // Retire ** gras markdown
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // Retire * italique orphelin
      .replace(/\*{1,2}/g, "")
      .trim()
    )
    .filter((l) => l.length > 10);
  return lines.slice(0, 6);
}
