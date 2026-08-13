/**
 * Filtrage par pertinence des décisions Judilibre via Haiku.
 *
 * Logique d'entonnoir dynamique (avril 2026) :
 *   1. Récolte massive côté client.ts (jusqu'à 800 candidates).
 *   2. Haiku score CHAQUE décision sur sa pertinence (0-10) par rapport à la
 *      question de l'avocat.
 *   3. On garde celles dont le score >= seuil (8/10 par défaut).
 *   4. Si > MAX (100) : on prend les 100 plus hautement scorées.
 *   5. Si < MIN (30) : on abaisse le seuil progressivement (8 → 7 → 6 → 5 → 4)
 *      jusqu'à atteindre 30 ou échouer.
 *
 * Rationale : ne PLUS imposer un nombre fixe (60 ou 80). Le corpus final
 * reflète la qualité réelle de l'offre Judilibre sur le sujet :
 *   - matière à fort volume → 80-100 décisions très pertinentes
 *   - matière de niche → 30-50 décisions moyennement pertinentes
 *
 * Si Haiku échoue (timeout, parsing) : fallback sur les MAX premières
 * décisions dans l'ordre Judilibre original.
 */

import { getAnthropicClient } from "@/lib/claude/client";
import type { JudilibreDecision } from "@/lib/judilibre/client";
import { trackClaudeUsage } from "@/lib/api-usage/track";
import {
  embedDocuments,
  embedQuery,
  cosineSimilarity,
  isVoyageAvailable,
} from "@/lib/embeddings/voyage";

const RERANK_MODEL = "claude-haiku-4-5-20251001";

/**
 * Pondération du score combiné Haiku (relevance) + Voyage (similarité sémantique).
 * Niveau 4 : si Voyage est disponible, le score final est mixé 50/50.
 * Sinon, on retombe sur Haiku seul (multiplicateur 1).
 */
const HAIKU_WEIGHT = 0.5;
const VOYAGE_WEIGHT = 0.5;

/** Plage cible du corpus final transmis à Sonnet (Règle 2 v3 / 2026-04). */
export const JUDILIBRE_TARGET_MIN = 30;
/**
 * Plafond du corpus retenu après rerank.
 *
 * Ramené de 700 à 200. Trois raisons :
 *  1. Le modèle d'analyse est `claude-sonnet-4-20250514` — 200k de contexte,
 *     pas 1M comme l'indiquait le commentaire précédent. À ~1k caractères par
 *     décision, 700 décisions consommaient l'essentiel de la fenêtre.
 *  2. Le prompt impose une ligne de tableau par décision du corpus : un tableau
 *     de 700 lignes est impossible sous `max_tokens: 32000`, ce qui déclenchait
 *     systématiquement l'incohérence de comptage détectée par `verify.ts`.
 *  3. Au-delà de ~200 décisions, l'apport statistique marginal est faible face
 *     au coût input (~0,5 $ par analyse) et à la dilution de pertinence.
 */
export const JUDILIBRE_TARGET_MAX = 200;

/** Compatibilité historique — utilisé en quelques endroits comme indicateur. */
export const JUDILIBRE_RERANK_KEEP = JUDILIBRE_TARGET_MAX;

/** Seuils de pertinence Haiku (sur 10) testés en cascade jusqu'à atteindre MIN. */
const RELEVANCE_THRESHOLDS = [8, 7, 6, 5, 4, 3];

const RERANK_TIMEOUT_MS = 18000;

/**
 * Nombre de décisions scorées par appel Haiku.
 *
 * Contrainte réelle : chaque score sérialisé `{"i":123,"s":8},` coûte ~12-14
 * tokens de sortie. Avec `max_tokens: 4096`, un appel ne peut pas restituer
 * plus de ~300 scores — au-delà, la réponse est tronquée en plein JSON,
 * `JSON.parse` échoue, et l'ancienne implémentation retombait SILENCIEUSEMENT
 * sur l'ordre brut de Judilibre. Le rerank ne fonctionnait donc pas sur les
 * matières à fort volume, précisément celles où il compte le plus.
 *
 * 150 laisse une marge confortable sous le plafond.
 */
const RERANK_BATCH_SIZE = 150;

/** Plafond de sortie par lot : ~14 tokens/score + marge de structure. */
const RERANK_MAX_TOKENS = 4096;

function compactSummary(dec: JudilibreDecision, idx: number): string {
  const chamber = dec.chamber || "";
  const sol = (dec.solution_alt || dec.solution || "").slice(0, 80);
  const sommaire = (dec.sommaire || "").slice(0, 220).replace(/\s+/g, " ");
  const themes = (dec.themes || []).slice(0, 3).join(", ");
  return `[${idx}] ${dec.jurisdiction}/${chamber} ${dec.date} — ${sol}${themes ? ` | ${themes}` : ""}${sommaire ? ` | ${sommaire}` : ""}`;
}

interface ScoredDecision {
  decision: JudilibreDecision;
  score: number; // 0-10 (combiné)
  haikuScore: number; // 0-10
  semanticScore: number | null; // 0-10 (cosinus × 10), null si Voyage indispo
  index: number;
}

/**
 * Rerank sémantique via Voyage AI (Niveau 4).
 * Embedde la requête + chaque sommaire, calcule la similarité cosinus.
 * Retourne un score 0-10 par décision (ou null si Voyage indispo).
 */
async function semanticScores(
  userQuery: string,
  decisions: JudilibreDecision[],
): Promise<number[] | null> {
  if (!isVoyageAvailable()) return null;

  const docs = decisions.map((d) => {
    const sol = (d.solution_alt || d.solution || "").slice(0, 120);
    const sommaire = (d.sommaire || "").slice(0, 800);
    const themes = (d.themes || []).slice(0, 5).join(", ");
    return [sol, themes, sommaire].filter(Boolean).join(" — ");
  });

  const [queryVec, docVecs] = await Promise.all([
    embedQuery(userQuery),
    embedDocuments(docs),
  ]);
  if (!queryVec || !docVecs) return null;

  // Cosinus ∈ [-1, 1] en théorie mais ≈ [0, 1] en pratique pour Voyage.
  // On clamp à [0, 1] puis on étend à [0, 10] pour aligner avec Haiku.
  return docVecs.map((vec) => {
    const cos = cosineSimilarity(queryVec, vec);
    return Math.max(0, Math.min(1, cos)) * 10;
  });
}

/**
 * Demande à Haiku de scorer chaque décision.
 * Retourne un tableau de scores parallèles aux décisions d'entrée.
 */
async function scoreBatch(
  userQuery: string,
  decisions: JudilibreDecision[],
  offset: number,
  opts: { userId?: string | null; userEmail?: string | null }
): Promise<number[] | null> {
  // Les index envoyés au modèle sont LOCAUX au lot (0..n-1) pour rester courts ;
  // `offset` sert à les replacer dans le tableau global au retour.
  const lines = decisions.map((d, i) => compactSummary(d, i)).join("\n");
  void offset;

  const system = `Tu es un évaluateur de pertinence jurisprudentielle. Tu reçois une question d'avocat et une liste indexée de décisions françaises. Pour CHAQUE décision, tu attribues un score de pertinence de 0 à 10 où :
- 10 = matière exacte + faits très similaires + récent et faisant autorité
- 7-9 = matière exacte, faits proches, utile pour l'analyse statistique
- 5-6 = matière proche ou faits partiellement comparables
- 3-4 = lien thématique ténu, périphérique
- 0-2 = hors sujet ou doublon

CRITÈRES :
1. Matière juridique (la même branche, le même type de contentieux)
2. Similarité factuelle (mêmes éléments en jeu)
3. Fraîcheur (≥ 5 ans = bonus)
4. Autorité (Cour de cassation > CA > 1ère instance) à pertinence égale

RÉPONDS UNIQUEMENT EN JSON STRICT :
{ "scores": [ {"i": 0, "s": 8}, {"i": 1, "s": 5}, ... ] }

Tu DOIS scorer CHAQUE décision (un objet par indice). Pas de commentaire, pas de markdown.`;

  try {
    const anthropic = getAnthropicClient();
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), RERANK_TIMEOUT_MS);

    const response = await anthropic.messages.create(
      {
        model: RERANK_MODEL,
        max_tokens: RERANK_MAX_TOKENS,
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
            content: `QUESTION DE L'AVOCAT : ${userQuery}\n\nDÉCISIONS À ÉVALUER :\n${lines}\n\nScore CHAQUE décision (0-10) en JSON.`,
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
        userId: opts.userId ?? null,
        userEmail: opts.userEmail ?? null,
        model: RERANK_MODEL,
        operation: "analyze",
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheWriteTokens: usage.cache_creation_input_tokens || 0,
        cacheReadTokens: usage.cache_read_input_tokens || 0,
        metadata: { step: "score" },
      });
    } catch {
      /* silent */
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as {
      scores?: Array<{ i: number; s: number }>;
    };
    if (!Array.isArray(parsed.scores)) return null;

    // Tableau parallèle au lot. `NaN` = décision non scorée par le modèle :
    // l'appelant la traitera comme telle plutôt que de lui prêter un 5 neutre,
    // qui suffisait à la faire passer au-dessus du seuil de la cascade.
    const scores = new Array<number>(decisions.length).fill(NaN);
    for (const item of parsed.scores) {
      if (
        typeof item.i === "number" &&
        item.i >= 0 &&
        item.i < decisions.length &&
        typeof item.s === "number" &&
        Number.isFinite(item.s)
      ) {
        scores[item.i] = Math.max(0, Math.min(10, item.s));
      }
    }
    return scores;
  } catch {
    return null;
  }
}

/**
 * Score toutes les décisions en découpant la charge en lots parallèles.
 *
 * Retourne un tableau parallèle à `decisions` où chaque entrée vaut soit un
 * score 0-10, soit `NaN` si le lot correspondant a échoué. Un échec partiel
 * n'annule donc plus l'ensemble : les lots réussis restent exploitables.
 */
async function scoreDecisions(
  userQuery: string,
  decisions: JudilibreDecision[],
  opts: { userId?: string | null; userEmail?: string | null }
): Promise<{ scores: number[]; failedBatches: number; totalBatches: number }> {
  const batches: Array<{ slice: JudilibreDecision[]; offset: number }> = [];
  for (let i = 0; i < decisions.length; i += RERANK_BATCH_SIZE) {
    batches.push({
      slice: decisions.slice(i, i + RERANK_BATCH_SIZE),
      offset: i,
    });
  }

  const results = await Promise.all(
    batches.map((b) => scoreBatch(userQuery, b.slice, b.offset, opts))
  );

  const scores = new Array<number>(decisions.length).fill(NaN);
  let failedBatches = 0;
  results.forEach((batchScores, bi) => {
    if (!batchScores) {
      failedBatches++;
      return;
    }
    const { offset } = batches[bi];
    batchScores.forEach((s, li) => {
      scores[offset + li] = s;
    });
  });

  if (failedBatches > 0) {
    console.warn(
      `[rerank] ${failedBatches}/${batches.length} lot(s) de scoring en échec — ` +
        `les décisions concernées gardent leur rang Judilibre d'origine.`
    );
  }

  return { scores, failedBatches, totalBatches: batches.length };
}

/**
 * Logique d'entonnoir : score chaque décision puis filtre selon une plage
 * dynamique [JUDILIBRE_TARGET_MIN, JUDILIBRE_TARGET_MAX].
 *
 * Le seuil de pertinence est ajusté automatiquement :
 *   - Démarre à 8/10 (très exigeant).
 *   - Si < MIN décisions retenues, abaisse à 7, puis 6, etc.
 *   - Garde les MAX premières si > MAX retenues.
 */
export async function rerankDecisions(args: {
  userQuery: string;
  decisions: JudilibreDecision[];
  keepN?: number; // ignoré dans la nouvelle logique — gardé pour compat API
  userId?: string | null;
  userEmail?: string | null;
}): Promise<JudilibreDecision[]> {
  const { userQuery, decisions } = args;

  // Si on est déjà sous le minimum, on garde tout.
  if (decisions.length <= JUDILIBRE_TARGET_MIN) return decisions;

  // Score Haiku (pertinence factuelle) + Voyage (similarité sémantique)
  // en parallèle. Voyage est null si VOYAGE_API_KEY absent.
  const [haikuResult, voyageScores] = await Promise.all([
    scoreDecisions(userQuery, decisions, {
      userId: args.userId,
      userEmail: args.userEmail,
    }),
    semanticScores(userQuery, decisions),
  ]);

  const haikuScores = haikuResult.scores;
  const allBatchesFailed =
    haikuResult.failedBatches === haikuResult.totalBatches;

  if (allBatchesFailed && !voyageScores) {
    // Aucun signal exploitable : on conserve l'ordre Judilibre, en le signalant.
    console.warn(
      "[rerank] aucun signal de pertinence disponible (Haiku et Voyage indisponibles) — " +
        "corpus tronqué dans l'ordre de pertinence mot-clé Judilibre."
    );
    return decisions.slice(0, JUDILIBRE_TARGET_MAX);
  }

  // Score combiné : Haiku + (cosinus × 10) pondérés 50/50, en n'utilisant que
  // les signaux réellement disponibles pour CHAQUE décision. Une décision non
  // scorée par Haiku (lot en échec) est classée sur Voyage seul, et
  // réciproquement — au lieu d'hériter d'un 5 neutre qui la faisait passer
  // artificiellement au-dessus du seuil.
  const scored: ScoredDecision[] = decisions.map((decision, index) => {
    const haiku = haikuScores[index];
    const hasHaiku = Number.isFinite(haiku);
    const semantic = voyageScores ? voyageScores[index] : null;
    const hasSemantic = semantic !== null && Number.isFinite(semantic);

    let combined: number;
    if (hasHaiku && hasSemantic) {
      combined = haiku * HAIKU_WEIGHT + (semantic as number) * VOYAGE_WEIGHT;
    } else if (hasHaiku) {
      combined = haiku;
    } else if (hasSemantic) {
      combined = semantic as number;
    } else {
      // Aucun signal pour cette décision : score neutre bas, elle ne sera
      // retenue que si le corpus manque de candidates mieux classées.
      combined = 0;
    }

    return {
      decision,
      score: combined,
      haikuScore: hasHaiku ? haiku : 0,
      semanticScore: hasSemantic ? (semantic as number) : null,
      index,
    };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  // Cherche le seuil qui donne entre MIN et MAX décisions.
  let chosen: ScoredDecision[] = [];
  for (const threshold of RELEVANCE_THRESHOLDS) {
    chosen = scored.filter((s) => s.score >= threshold);
    if (chosen.length >= JUDILIBRE_TARGET_MIN) break;
  }

  // Plafonne à MAX (les plus hautement scorées)
  if (chosen.length > JUDILIBRE_TARGET_MAX) {
    chosen = chosen.slice(0, JUDILIBRE_TARGET_MAX);
  }

  // Plancher : si malgré tout on a moins que MIN, on complète avec les
  // décisions suivantes (les moins bien scorées) jusqu'à atteindre MIN.
  if (chosen.length < JUDILIBRE_TARGET_MIN) {
    const seen = new Set(chosen.map((c) => c.index));
    for (const s of scored) {
      if (chosen.length >= JUDILIBRE_TARGET_MIN) break;
      if (!seen.has(s.index)) chosen.push(s);
    }
  }

  return chosen.map((c) => c.decision);
}
