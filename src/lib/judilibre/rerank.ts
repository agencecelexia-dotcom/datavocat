/**
 * Pré-ranking Haiku des décisions Judilibre.
 *
 * Objectif : réduire le nombre de décisions passées à Sonnet (de 100 à 60)
 * tout en PRÉSERVANT la qualité — Haiku opère une sélection sémantique
 * supérieure au score mot-clé de PISTE.
 *
 * Si Haiku échoue (timeout, erreur, parsing invalide) : on retourne le
 * tableau d'entrée inchangé → fallback sûr.
 */

import { getAnthropicClient } from "@/lib/claude/client";
import type { JudilibreDecision } from "@/lib/judilibre/client";
import { trackClaudeUsage } from "@/lib/api-usage/track";

const RERANK_MODEL = "claude-haiku-4-5-20251001";

/** Nombre de décisions conservées après reranking (passées à Sonnet). */
export const JUDILIBRE_RERANK_KEEP = 80;

/** Timeout global du reranking — on garde la requête rapide. */
const RERANK_TIMEOUT_MS = 8000;

function compactSummary(dec: JudilibreDecision, idx: number): string {
  const chamber = dec.chamber || "";
  const sol = (dec.solution_alt || dec.solution || "").slice(0, 80);
  const sommaire = (dec.sommaire || "").slice(0, 220).replace(/\s+/g, " ");
  const themes = (dec.themes || []).slice(0, 3).join(", ");
  return `[${idx}] ${dec.jurisdiction}/${chamber} ${dec.date} — ${sol}${themes ? ` | ${themes}` : ""}${sommaire ? ` | ${sommaire}` : ""}`;
}

/**
 * Demande à Haiku de classer les décisions par pertinence pour la query.
 * Retourne les `keepN` meilleures, dans l'ordre de pertinence.
 */
export async function rerankDecisions(args: {
  userQuery: string;
  decisions: JudilibreDecision[];
  keepN?: number;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<JudilibreDecision[]> {
  const { userQuery, decisions } = args;
  const keepN = args.keepN ?? JUDILIBRE_RERANK_KEEP;

  // Si on a déjà moins ou égal au target, inutile de rerank.
  if (decisions.length <= keepN) return decisions;

  const lines = decisions.map((d, i) => compactSummary(d, i)).join("\n");

  const system = `Tu es un assistant de pertinence jurisprudentielle. Tu reçois une question d'avocat et une liste indexée de décisions françaises. Tu retournes les ${keepN} indices les plus pertinents pour répondre à la question, ordonnés du plus au moins pertinent.

CRITÈRES de pertinence (par ordre) :
1. Correspondance matière / contentieux exacts
2. Similarité des faits et arguments
3. Fraîcheur (plus récent = +) à pertinence égale
4. Autorité (Cour de cassation > CA) à pertinence égale

RÉPONDS UNIQUEMENT EN JSON STRICT :
{ "top": [12, 4, 27, ...] }

Les indices doivent exister dans la liste fournie. Pas de commentaire, pas de markdown.`;

  try {
    const anthropic = getAnthropicClient();
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), RERANK_TIMEOUT_MS);

    const response = await anthropic.messages.create(
      {
        model: RERANK_MODEL,
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `QUESTION : ${userQuery}\n\nDÉCISIONS :\n${lines}\n\nRends les ${keepN} indices les plus pertinents en JSON.`,
          },
        ],
      },
      { signal: ctrl.signal }
    );
    clearTimeout(timeout);

    // Tracking (fail-silent)
    try {
      const usage = response.usage as typeof response.usage & {
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
      await trackClaudeUsage({
        userId: args.userId ?? null,
        userEmail: args.userEmail ?? null,
        model: RERANK_MODEL,
        operation: "analyze",
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheWriteTokens: usage.cache_creation_input_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        metadata: { step: "rerank" },
      });
    } catch {
      /* silent */
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return decisions.slice(0, keepN);

    const parsed = JSON.parse(match[0]) as { top?: unknown };
    if (!Array.isArray(parsed.top)) return decisions.slice(0, keepN);

    const seen = new Set<number>();
    const ordered: JudilibreDecision[] = [];
    for (const raw of parsed.top) {
      const idx = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      if (!Number.isFinite(idx)) continue;
      if (idx < 0 || idx >= decisions.length) continue;
      if (seen.has(idx)) continue;
      seen.add(idx);
      ordered.push(decisions[idx]);
      if (ordered.length >= keepN) break;
    }

    // Si Haiku a renvoyé moins que keepN (réponse tronquée), on complète
    // avec les décisions restantes dans leur ordre d'origine.
    if (ordered.length < keepN) {
      for (let i = 0; i < decisions.length && ordered.length < keepN; i++) {
        if (!seen.has(i)) {
          ordered.push(decisions[i]);
          seen.add(i);
        }
      }
    }

    return ordered;
  } catch {
    // Fallback : on retourne le top keepN dans l'ordre Judilibre d'origine.
    return decisions.slice(0, keepN);
  }
}
