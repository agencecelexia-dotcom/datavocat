"use client";

import { useEffect, useState } from "react";
import type { ParsedAnalysis } from "@/lib/parse-analysis";
import { buildSourceUrl } from "@/lib/parse-analysis";
import { TrendsBlock } from "./trends-block";

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
  // Taux de succès — priorité au calcul canonique côté serveur
  // (verification.tauxSuccesRetenu, calculé arithmétiquement sur la
  // hiérarchie 4 catégories), regex sur texte Claude en fallback.
  const taux =
    data.verification?.tauxSuccesRetenu ?? data.tauxSuccesGlobal ?? 0;
  const tauxSource = data.verification?.tauxSuccesSource ?? null;
  const risque = Math.max(0, Math.round((100 - taux) * 10) / 10);

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

  const verification = data.verification;
  const removedTotal = verification
    ? verification.removedSentences + verification.removedRows
    : 0;

  // Composition 4 catégories (Règle 2)
  const composition = verification?.corpusComposition ?? null;
  const corpusTotal = composition?.total ?? 0;
  const cassPct =
    composition?.cassationPct ??
    (composition && corpusTotal > 0
      ? Math.round((composition.cassation / corpusTotal) * 100)
      : 0);
  const fondPct =
    composition?.fondPct ??
    (composition && corpusTotal > 0
      ? Math.round(
          ((composition.premierDegre + composition.courAppel) / corpusTotal) *
            100
        )
      : 0);
  const cassDominant = !!composition && cassPct >= 70 && fondPct < 30;
  const fondDominant = !!composition && fondPct >= 70 && cassPct < 30;

  // Indice de représentativité (composante B) — bandeau Règle 5 si < 30
  const corpusUnderMin = corpusTotal > 0 && corpusTotal < 30;
  const representativitePct = Math.min(100, Math.round((corpusTotal / 30) * 100));

  return (
    <div>
      {/* ── BANDEAU CORPUS RÉDUIT (REGLE 5) ──────────────────── */}
      {corpusUnderMin && (
        <div
          className="rounded-md px-4 py-3 mb-4 text-[12px] leading-relaxed"
          style={{
            border:
              "1px solid color-mix(in srgb, var(--amber) 40%, transparent)",
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            color: "var(--ink)",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em] mt-0.5 flex-shrink-0"
              style={{ color: "var(--amber)" }}
            >
              § Corpus réduit
            </span>
            <div className="flex-1">
              <div className="font-semibold">
                Seules {corpusTotal} décisions ont pu être identifiées (seuil
                cible : 30).
              </div>
              <div
                className="text-[11.5px] mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                Indice de représentativité : <strong>{representativitePct} %</strong>{" "}
                (composante B de la fiabilité). L&apos;analyse reste valable
                sur ce corpus mais ses tendances sont indicatives. Élargir la
                requête en variant les mots-clés permettrait d&apos;augmenter
                la fiabilité.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HIÉRARCHIE 4 CATÉGORIES (REGLE 2) ────────────────── */}
      {composition && corpusTotal > 0 && (
        <div
          className="rounded-md px-4 py-3 mb-4"
          style={{
            border: "1px solid var(--line)",
            background: "var(--paper)",
          }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            § Hiérarchie juridictionnelle
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "1er degré",
                count: composition.premierDegre ?? 0,
                hint: "CPH, TJ, TC, TGI, TI, T. correctionnel",
              },
              {
                label: "Cour d'appel",
                count: composition.courAppel ?? 0,
                hint: "Juridiction du 2nd degré",
              },
              {
                label: "Cour de cassation",
                count: composition.cassation ?? 0,
                hint: "Juge du droit",
              },
              {
                label: "Conseil d'État",
                count: composition.conseilEtat ?? 0,
                hint: "CE, CAA, TA — source Légifrance CETAT",
                disabled: false,
              },
            ].map((cat) => (
              <div
                key={cat.label}
                title={cat.hint}
                style={{
                  opacity: cat.disabled ? 0.45 : 1,
                }}
              >
                <div
                  className="font-mono text-[9.5px] uppercase tracking-[0.15em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {cat.label}
                </div>
                <div
                  className="font-serif text-[22px] tabular-nums leading-none mt-1"
                  style={{ color: "var(--ink)" }}
                >
                  {cat.count}
                  {corpusTotal > 0 && (
                    <span
                      className="font-mono text-[10px] ml-1.5"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      ({Math.round((cat.count / corpusTotal) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SOURCES ADDITIONNELLES (légifrance / qpc / kali) ── */}
      {verification?.additionalSources &&
        (verification.additionalSources.legifranceArticles > 0 ||
          verification.additionalSources.qpc > 0 ||
          verification.additionalSources.kali > 0) && (
          <div
            className="rounded-md px-4 py-3 mb-4"
            style={{
              border: "1px solid var(--line)",
              background: "var(--paper)",
            }}
          >
            <div
              className="font-mono text-[10px] uppercase tracking-[0.18em] mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              § Contexte juridique consulté
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[12px]">
              {verification.additionalSources.legifranceArticles > 0 && (
                <span title="Articles de loi récupérés depuis Légifrance et fournis intégralement à l'IA">
                  <span className="font-semibold tabular-nums">
                    {verification.additionalSources.legifranceArticles}
                  </span>{" "}
                  article{verification.additionalSources.legifranceArticles > 1 ? "s" : ""}{" "}
                  de loi <span style={{ color: "var(--muted-foreground)" }}>(Légifrance)</span>
                </span>
              )}
              {verification.additionalSources.qpc > 0 && (
                <span title="Décisions QPC du Conseil constitutionnel touchant au sujet de la demande">
                  <span className="font-semibold tabular-nums">
                    {verification.additionalSources.qpc}
                  </span>{" "}
                  décision{verification.additionalSources.qpc > 1 ? "s" : ""} QPC{" "}
                  <span style={{ color: "var(--muted-foreground)" }}>(Cons. const.)</span>
                </span>
              )}
              {verification.additionalSources.kali > 0 && (
                <span title="Articles de convention collective applicable récupérés depuis Légifrance KALI">
                  <span className="font-semibold tabular-nums">
                    {verification.additionalSources.kali}
                  </span>{" "}
                  article{verification.additionalSources.kali > 1 ? "s" : ""} de convention
                  collective <span style={{ color: "var(--muted-foreground)" }}>(KALI)</span>
                </span>
              )}
            </div>
            <div
              className="mt-1.5 text-[11px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Ces sources sont fournies à l&apos;IA en contexte mais n&apos;entrent pas dans
              le calcul des taux statistiques.
            </div>
          </div>
        )}

      {/* ── BANDEAU AVERTISSEMENT COMPOSITION DU CORPUS ─────── */}
      {composition && (cassDominant || fondDominant) && (
        <div
          className="rounded-md px-4 py-3 mb-4 text-[12px] leading-relaxed"
          style={{
            border: "1px solid color-mix(in srgb, var(--amber) 40%, transparent)",
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            color: "var(--ink)",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em] mt-0.5 flex-shrink-0"
              style={{ color: "var(--amber)" }}
            >
              § Avertissement
            </span>
            <div className="flex-1">
              <div className="font-semibold mb-1">
                Corpus déséquilibré :{" "}
                {cassDominant
                  ? `${composition.cassationPct}% d'arrêts de la Cour de cassation`
                  : `${composition.fondPct}% de décisions du fond (1ère inst. + CA)`}
                .
              </div>
              <div
                className="text-[11.5px] leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                {cassDominant ? (
                  <>
                    Le pourcentage affiché correspond au{" "}
                    <strong>taux de cassation</strong> calculé sur les arrêts de
                    Cour de cassation —{" "}
                    <strong>il ne préjuge pas des chances en 1ère instance</strong>{" "}
                    (CPH, TJ, TC, TGI). La Cour de cassation juge le droit, pas
                    les faits. Si votre dossier est devant un juge du fond, ces
                    chiffres ne répondent pas à votre question — ils indiquent
                    seulement quelles décisions du fond sont remises en cause par
                    la Cassation.
                  </>
                ) : (
                  <>
                    Le pourcentage affiché correspond au{" "}
                    <strong>taux d'acceptation par les juges du fond</strong> —{" "}
                    <strong>il ne préjuge pas de l'issue d'un pourvoi en cassation</strong>.
                    Si votre dossier est en Cassation, ces chiffres ne répondent
                    pas à votre question.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BANDEAU CONTRÔLE ANTI-HALLUCINATION ─────────────── */}
      {verification && verification.citedRefs > 0 && (
        <div
          className="rounded-md px-4 py-3 mb-4 text-[12px] leading-relaxed"
          style={{
            border: `1px solid ${
              removedTotal > 0
                ? "color-mix(in srgb, var(--bordeaux) 35%, transparent)"
                : "color-mix(in srgb, var(--emerald) 30%, transparent)"
            }`,
            background:
              removedTotal > 0
                ? "color-mix(in srgb, var(--bordeaux) 6%, transparent)"
                : "color-mix(in srgb, var(--emerald) 6%, transparent)",
            color: "var(--ink)",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em] mt-0.5 flex-shrink-0"
              style={{
                color: removedTotal > 0 ? "var(--bordeaux)" : "var(--emerald)",
              }}
            >
              § Sourcing
            </span>
            <div className="flex-1">
              <div className="font-semibold">
                {verification.verifiedRefs} référence
                {verification.verifiedRefs > 1 ? "s" : ""} sur{" "}
                {verification.citedRefs} vérifiée
                {verification.verifiedRefs > 1 ? "s" : ""} dans le corpus
                Judilibre.
              </div>
              {removedTotal > 0 ? (
                <div
                  className="text-[11.5px] mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {verification.removedSentences > 0 && (
                    <>
                      {verification.removedSentences} phrase
                      {verification.removedSentences > 1 ? "s" : ""} retirée
                      {verification.removedSentences > 1 ? "s" : ""}
                    </>
                  )}
                  {verification.removedSentences > 0 &&
                    verification.removedRows > 0 &&
                    " et "}
                  {verification.removedRows > 0 && (
                    <>
                      {verification.removedRows} ligne
                      {verification.removedRows > 1 ? "s" : ""} de tableau
                      retirée{verification.removedRows > 1 ? "s" : ""}
                    </>
                  )}
                  {" "}du rapport pour référence non trouvée dans le corpus.{" "}
                  {verification.unverifiedRefs.length > 0 && (
                    <span className="font-mono text-[10.5px]">
                      Refs supprimées : {verification.unverifiedRefs.slice(0, 5).join(", ")}
                      {verification.unverifiedRefs.length > 5 && "…"}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className="text-[11.5px] mt-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Toutes les décisions citées dans le rapport sont présentes
                  dans le corpus Judilibre transmis au modèle.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              {(() => {
                // Préfère le compteur du contrôle anti-hallucination (refs uniques
                // vérifiées) au sourceCount qui peut sur-compter (ECLI + pourvoi
                // + ref Cass. d'une même décision = 3 entrées).
                const verifiedCount = data.verification?.verifiedRefs ?? null;
                const displayCount = verifiedCount ?? data.sourceCount;
                if (displayCount === 0) return null;
                return (
                  <>
                    {" "}·{" "}
                    <span title="Décisions uniques effectivement citées dans le rapport (dédupliquées)">
                      <span className="font-semibold">{displayCount}</span> citées dans le rapport
                    </span>
                  </>
                );
              })()}
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
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div
              className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
              style={{ color: "var(--gold)" }}
            >
              {cassDominant ? "Taux de cassation" : "Taux de succès"}
            </div>
            <div className="flex items-baseline gap-1.5">
              <div
                className="font-serif font-medium tabular-nums"
                style={{
                  fontSize: "44px",
                  color: "var(--emerald)",
                  lineHeight: 1,
                }}
              >
                {taux}
              </div>
              <div
                className="font-serif text-[22px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                %
              </div>
            </div>
            {tauxSource && (
              <div
                className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.15em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                Source : {tauxSource === "fond" ? "1er degré + CA" : tauxSource === "mixte" ? "fond (excl. cassation)" : "Cassation uniquement"}
              </div>
            )}
          </div>
          <div>
            <div
              className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              {cassDominant ? "Confirmation décisions" : "Risque d'échec"}
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
              className="mt-3 text-[12px] leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              {cassDominant ? (
                <>
                  Sur {composition?.cassationCount} arrêts de la Cour de cassation,{" "}
                  {risque}% confirment la décision attaquée. <strong>Ces chiffres concernent la Cassation uniquement.</strong>
                </>
              ) : (
                <>Miroir du taux de succès — anticipation de l&apos;issue défavorable.</>
              )}
            </div>
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
          <Metric
            label="Sources citées"
            value={String(data.verification?.verifiedRefs ?? data.sourceCount)}
          />
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Metric label="Montant moyen" value={fmtEur(art700.montantMoyen)} />
                <Metric label="Montant médian" value={fmtEur(art700.montantMedian)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tendances jurimétriques (Niveau 3) ──────────────── */}
      <TrendsBlock data={data} />

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

      {/* ── Recommandations chiffrées (Axe 5) ───────────────── */}
      {data.recommandationsChiffrees && data.recommandationsChiffrees.length > 0 && (
        <Section title="Recommandations chiffrées">
          <ol className="space-y-3">
            {data.recommandationsChiffrees.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="shrink-0 font-mono text-[11px] tabular-nums mt-0.5"
                  style={{ color: "var(--gold)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[14px] leading-snug"
                    style={{ color: "var(--ink)" }}
                  >
                    {r.action}
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className="font-mono text-[12px] font-semibold px-2 py-0.5 rounded"
                      style={{
                        background: "color-mix(in srgb, var(--gold) 14%, transparent)",
                        color: "var(--ink)",
                      }}
                    >
                      {r.chiffre}
                    </span>
                    {r.source && (
                      <a
                        href={buildSourceUrl(r.source)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10.5px] hover:underline"
                        style={{ color: "var(--muted-foreground)" }}
                        title="Ouvrir la décision sur Légifrance"
                      >
                        Source : {r.source}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
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
