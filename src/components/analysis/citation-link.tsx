"use client";

import type { JudilibreDecision } from "@/lib/judilibre/client";
import { formatCitation, sourceBadge } from "@/lib/refs/format";
import { ExternalLink } from "lucide-react";

/**
 * Citation cliquable d'une décision (Axe F).
 * Rend le label normalisé style Dalloz/JCP avec :
 *   - italique sur l'abréviation de juridiction (Cass. soc., CA Paris…)
 *   - espace insécable préservé sur les numéros
 *   - lien hypertexte vers Légifrance (ID canonique si disponible)
 *   - picto/badge source au survol
 *
 * Si la décision n'est pas dans le corpus, on accepte un fallback texte
 * brut via `fallbackText` (rétro-compat avec analyses anciennes).
 */
export function CitationLink({
  decision,
  fallbackText,
  showSource = true,
}: {
  decision?: JudilibreDecision | null;
  fallbackText?: string;
  showSource?: boolean;
}) {
  if (!decision) {
    if (!fallbackText) return null;
    return (
      <span style={{ color: "var(--muted-foreground)" }}>
        {fallbackText}{" "}
        <span
          className="font-mono text-[9px] uppercase tracking-[0.15em]"
          style={{ color: "var(--bordeaux)" }}
          title="Référence non vérifiée — à confirmer auprès de la source"
        >
          [non vérifiée]
        </span>
      </span>
    );
  }

  const citation = formatCitation(decision);
  const badge = sourceBadge(citation.source);
  // Espaces insécables sur les numéros pour ne pas casser la ligne
  const suffixWithNbsp = citation.suffix.replace(/n°\s/g, "n° ");

  const inner = (
    <span className="inline-flex items-baseline gap-1">
      <span
        className="dv-italic"
        style={{ fontStyle: "italic", color: "var(--ink)" }}
      >
        {citation.italicPrefix}
      </span>
      {citation.suffix && (
        <span style={{ color: "var(--ink)" }}>{suffixWithNbsp}</span>
      )}
      {showSource && (
        <span
          className="font-mono text-[9px] uppercase tracking-[0.15em] ml-1.5"
          style={{ color: badge.tone, opacity: 0.7 }}
          title={`Source : ${badge.label}`}
        >
          · {badge.label.split(" ").pop()}
        </span>
      )}
    </span>
  );

  if (citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group/cit inline-flex items-baseline gap-1 hover:underline"
        title={`Ouvrir sur ${badge.label}`}
      >
        {inner}
        <ExternalLink
          className="h-2.5 w-2.5 opacity-0 group-hover/cit:opacity-60 transition-opacity"
          style={{ color: "var(--gold)" }}
        />
      </a>
    );
  }

  return inner;
}
