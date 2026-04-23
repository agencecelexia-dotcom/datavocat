"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CostsData {
  totalUsd: number;
  monthUsd: number;
  prevMonthUsd: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byOperation: Array<{ operation: string; usd: number; calls: number }>;
  topUsersMonth: Array<{ userEmail: string; usd: number; calls: number }>;
  daily: Array<{ date: string; usd: number; calls: number }>;
  missingTable: boolean;
}

const USD_EUR = 0.92;
const fmtEur = (usd: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usd * USD_EUR);

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const OP_LABELS: Record<string, string> = {
  analyze: "Analyse principale",
  clarify: "Questions de clarification",
  chat: "Chat de suivi",
  rapport: "Génération rapport",
};

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function CostsPage() {
  const [data, setData] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/costs");
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (err) {
      toast.error("Impossible de charger les coûts");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-20 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  if (!data) return null;

  const variation =
    data.prevMonthUsd > 0 ? ((data.monthUsd - data.prevMonthUsd) / data.prevMonthUsd) * 100 : null;
  const VariationIcon =
    variation === null ? Minus : variation >= 0 ? TrendingUp : TrendingDown;
  const variationColor =
    variation === null
      ? "var(--muted-foreground)"
      : variation >= 0
        ? "var(--bordeaux, #9b2226)"
        : "var(--emerald, #2d6a4f)";

  const maxDaily = Math.max(0.01, ...data.daily.map((d) => d.usd));

  return (
    <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
      <div className="flex items-center gap-3 mb-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--gold)" }}>
          § Coûts API
        </span>
        <span className="h-px flex-1" style={{ background: "var(--line)" }} />
        <button
          onClick={load}
          className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.15em] cursor-pointer"
          style={{ color: "var(--muted-foreground)" }}
        >
          <RefreshCw className="h-3 w-3" />
          Rafraîchir
        </button>
      </div>

      <h1 className="font-serif text-[36px] font-medium tracking-tight mb-3">
        Consommation <span className="dv-italic">API Claude.</span>
      </h1>
      <p className="text-[14px] mb-8" style={{ color: "var(--muted-foreground)" }}>
        Suivi des coûts API Anthropic pour toutes les opérations — analyse, clarification, chat, rapport.
      </p>

      {data.missingTable && (
        <div
          className="mb-6 p-4 rounded-md text-[13px]"
          style={{
            border: `1px solid color-mix(in srgb, var(--amber, #ca6702) 40%, transparent)`,
            background: `color-mix(in srgb, var(--amber, #ca6702) 8%, transparent)`,
            color: "var(--amber, #ca6702)",
          }}
        >
          <strong>Migration manquante.</strong> Applique{" "}
          <code>supabase/migrations/00017_create_api_usage.sql</code> dans le SQL editor Supabase pour commencer le tracking.
        </div>
      )}

      {/* Hero 2 stats : mois en cours + all time */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 items-center pb-10 mb-8"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            Mois en cours
          </div>
          <div
            className="font-serif font-medium tabular-nums"
            style={{
              fontSize: "72px",
              color: "var(--ink)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {fmtEur(data.monthUsd)}
          </div>
          {variation !== null && (
            <div className="mt-3 flex items-center gap-1.5 text-[12px]">
              <VariationIcon className="h-3 w-3" style={{ color: variationColor }} />
              <span style={{ color: variationColor }}>
                {variation >= 0 ? "+" : ""}
                {variation.toFixed(1)}%
              </span>
              <span style={{ color: "var(--muted-foreground)" }}>
                vs mois précédent ({fmtEur(data.prevMonthUsd)})
              </span>
            </div>
          )}
        </div>
        <div
          className="lg:pl-10 lg:border-l flex flex-col gap-4"
          style={{ borderColor: "var(--line)" }}
        >
          <Metric label="Total cumulé" value={fmtEur(data.totalUsd)} />
          <Metric label="Appels API (tous)" value={fmtInt(data.totalCalls)} />
          <Metric
            label="Tokens consommés"
            value={`${fmtInt(data.totalInputTokens + data.totalOutputTokens)}`}
            sublabel={`${fmtInt(data.totalInputTokens)} input · ${fmtInt(data.totalOutputTokens)} output`}
          />
        </div>
      </div>

      {/* Timeline 30j */}
      <section className="mb-10 pb-8" style={{ borderBottom: "1px solid var(--line)" }}>
        <h2 className="font-serif text-[20px] font-medium tracking-tight mb-5">
          30 derniers jours
        </h2>
        <div className="flex items-end gap-1 h-36">
          {data.daily.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex flex-col items-center justify-end flex-1 relative group">
                <div
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${(d.usd / maxDaily) * 100}%`,
                    minHeight: d.usd > 0 ? "2px" : "0",
                    background: "var(--ink)",
                  }}
                />
                <div
                  className="absolute bottom-full mb-1 hidden group-hover:block px-2 py-1 rounded text-[10px] font-mono tabular-nums whitespace-nowrap"
                  style={{
                    background: "var(--ink)",
                    color: "#fff",
                  }}
                >
                  {fmtEur(d.usd)} · {d.calls} appels
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 font-mono text-[9.5px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
          <span>{data.daily.length > 0 && formatShortDate(data.daily[0].date)}</span>
          <span>aujourd&apos;hui</span>
        </div>
      </section>

      {/* Breakdown par opération + Top users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 pb-8 mb-8" style={{ borderBottom: "1px solid var(--line)" }}>
        <div>
          <h2 className="font-serif text-[20px] font-medium tracking-tight mb-5">
            Par opération
          </h2>
          {data.byOperation.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Aucune donnée.
            </p>
          ) : (
            data.byOperation.map((op) => (
              <div
                key={op.operation}
                className="flex items-center justify-between py-3"
                style={{ borderBottom: "1px solid var(--line-soft)" }}
              >
                <div>
                  <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                    {OP_LABELS[op.operation] || op.operation}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {fmtInt(op.calls)} appel{op.calls > 1 ? "s" : ""}
                  </div>
                </div>
                <div
                  className="font-mono text-[15px] tabular-nums font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  {fmtEur(op.usd)}
                </div>
              </div>
            ))
          )}
        </div>
        <div>
          <h2 className="font-serif text-[20px] font-medium tracking-tight mb-5">
            Top utilisateurs (mois)
          </h2>
          {data.topUsersMonth.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
              Aucun utilisateur ce mois-ci.
            </p>
          ) : (
            data.topUsersMonth.map((u, i) => (
              <div
                key={u.userEmail}
                className="flex items-center justify-between py-3"
                style={{ borderBottom: "1px solid var(--line-soft)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="font-mono text-[10.5px] tabular-nums shrink-0"
                    style={{ color: "var(--gold)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="font-mono text-[12px] truncate"
                      style={{ color: "var(--ink)" }}
                    >
                      {u.userEmail}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {fmtInt(u.calls)} appel{u.calls > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div
                  className="font-mono text-[14px] tabular-nums font-semibold shrink-0"
                  style={{ color: "var(--ink)" }}
                >
                  {fmtEur(u.usd)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[10.5px] italic" style={{ color: "var(--muted-foreground)", opacity: 0.8 }}>
        Tarification Anthropic Claude Sonnet 4 : 3 USD / M tokens en entrée, 15 USD / M tokens en sortie.
        Conversion USD → EUR à {USD_EUR}. Les coûts sont des estimations basées sur les retours du SDK — la facture
        réelle Anthropic peut légèrement différer (frais de cache, prompt caching, promotions).
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div>
      <div
        className="font-mono text-[10px] uppercase tracking-[0.15em] mb-1"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
      <div
        className="font-mono text-[22px] tabular-nums font-semibold"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-[11px] mt-0.5 font-mono tabular-nums" style={{ color: "var(--muted-foreground)", opacity: 0.7 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
