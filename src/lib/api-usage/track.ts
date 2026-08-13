/**
 * Tracking des coûts API Claude.
 *
 * Appelé après chaque appel au modèle pour enregistrer la consommation
 * tokens et le coût estimé. Les données sont stockées dans la table
 * `api_usage` (service role) et agrégées par la route /api/admin/costs.
 *
 * Les erreurs d'insertion sont catchées silencieusement — le tracking
 * ne doit JAMAIS casser le flow utilisateur.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** Tarification Anthropic par modèle (USD / token). */
const PRICING: Record<string, { input: number; output: number }> = {
  // Famille Sonnet — $3/M in, $15/M out
  "claude-sonnet-5": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-sonnet-4-5-20250929": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  // Modèle historique, retiré du catalogue — conservé pour les analyses archivées.
  "claude-sonnet-4-20250514": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  // Famille Haiku — $1/M in, $5/M out
  "claude-haiku-4-5-20251001": { input: 1 / 1_000_000, output: 5 / 1_000_000 },
  // Famille Opus — $5/M in, $25/M out. Sans cette entrée, un basculement sur
  // Opus via ANALYZE_MODEL aurait été facturé au tarif Sonnet, sous-estimant
  // le coût réel affiché dans /admin/costs.
  "claude-opus-5": { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  "claude-opus-4-8": { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  "claude-opus-4-7": { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  "claude-opus-4-6": { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  "claude-opus-4-5-20251101": { input: 5 / 1_000_000, output: 25 / 1_000_000 },
  // Repli prudent : tarif le plus élevé, pour ne jamais sous-estimer un coût.
  default: { input: 5 / 1_000_000, output: 25 / 1_000_000 },
};

export function priceFor(model: string) {
  return PRICING[model] || PRICING.default;
}

export function computeUsdCost(args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): number {
  const p = priceFor(args.model);
  // Anthropic cache pricing: cache read = 0.1x input, cache write = 1.25x input.
  const cacheRead = (args.cacheReadTokens || 0) * p.input * 0.1;
  const cacheWrite = (args.cacheWriteTokens || 0) * p.input * 1.25;
  return (
    args.inputTokens * p.input +
    args.outputTokens * p.output +
    cacheRead +
    cacheWrite
  );
}

export interface TrackClaudeArgs {
  userId: string | null;
  userEmail: string | null;
  model: string;
  operation: "analyze" | "clarify" | "chat" | "rapport";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  analysisId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Insert une ligne dans api_usage. Fail-silent pour ne pas casser le flow.
 */
export async function trackClaudeUsage(args: TrackClaudeArgs): Promise<void> {
  try {
    const cost = computeUsdCost({
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cacheReadTokens: args.cacheReadTokens,
      cacheWriteTokens: args.cacheWriteTokens,
    });
    const supabase = createAdminClient();
    // `api_usage` figure désormais dans les types Database : plus de cast.
    const { error } = await supabase.from("api_usage").insert({
      user_id: args.userId,
      user_email: args.userEmail,
      provider: "anthropic",
      model: args.model,
      operation: args.operation,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      cache_read_tokens: args.cacheReadTokens || 0,
      cache_write_tokens: args.cacheWriteTokens || 0,
      cost_usd: cost,
      analysis_id: args.analysisId || null,
      metadata: (args.metadata ?? null) as never,
    });
    if (error) {
      console.warn("[api-usage] insert failed:", error.message);
    }
  } catch (err) {
    console.warn("[api-usage] track failed (silent):", err instanceof Error ? err.message : err);
  }
}

/** Taux de conversion USD → EUR (fixe, configurable via env). */
export function usdToEurRate(): number {
  const raw = process.env.USD_EUR_RATE;
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.92;
}

export function formatEur(usd: number): string {
  const eur = usd * usdToEurRate();
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(eur);
}
