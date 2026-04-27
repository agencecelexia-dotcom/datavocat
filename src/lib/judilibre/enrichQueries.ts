/**
 * Enrichissement des requêtes de recherche avec des termes juridiques
 * connexes selon la matière détectée.
 *
 * Pour chaque matière, on connait les "facteurs" et "terminologie" qui
 * structurent le contentieux. En les ajoutant en sous-requêtes, on capture
 * davantage d'arrêts pertinents que la seule requête utilisateur ne le ferait.
 *
 * Exemple : "licenciement faute grave BTP" déclenche aussi des recherches
 * sur "cause réelle et sérieuse", "indemnité licenciement", "préavis",
 * "dommages-intérêts faute grave" — qui sont les axes statistiques d'un
 * contentieux licenciement.
 */

const MATTER_ENRICHMENTS: Record<string, string[]> = {
  // Droit social — licenciement, contrat de travail
  social: [
    "cause réelle et sérieuse licenciement",
    "indemnité licenciement faute grave",
    "préavis licenciement",
    "dommages-intérêts licenciement sans cause",
    "harcèlement moral travail",
    "discrimination embauche licenciement",
    "rupture conventionnelle homologation",
    "convention collective licenciement",
  ],
  // Droit commercial — bail commercial, société, concurrence
  commercial: [
    "indemnité d'éviction bail commercial",
    "renouvellement bail commercial refus",
    "résiliation bail commercial preuve",
    "rupture brutale relations commerciales",
    "concurrence déloyale dommages-intérêts",
    "procédure collective créancier",
    "sociétés associé minoritaire abus",
  ],
  // Droit de la famille
  famille: [
    "divorce faute prestation compensatoire",
    "garde alternée enfant intérêt supérieur",
    "pension alimentaire montant calcul",
    "succession partage indivision",
    "autorité parentale décision parents",
    "violences conjugales protection",
  ],
  // Droit civil général — responsabilité, contrats, baux
  civil: [
    "responsabilité civile dommage causalité",
    "vice caché vente obligation vendeur",
    "trouble anormal voisinage",
    "bail habitation congé locataire",
    "copropriété charges syndic",
    "indemnisation préjudice corporel",
  ],
  // Droit pénal
  penal: [
    "faute grave intention élément moral",
    "circonstances aggravantes peine",
    "récidive sursis emprisonnement",
    "sursis probatoire conditions",
    "partie civile dommages préjudice",
  ],
  // Droit administratif
  admin: [
    "annulation pour excès de pouvoir",
    "responsabilité de la puissance publique",
    "indemnisation préjudice administration",
    "permis construire annulation tiers",
    "fiscal redressement procédure contradictoire",
    "fonction publique sanction discipline",
  ],
};

export type MatterKey = keyof typeof MATTER_ENRICHMENTS;

/**
 * Ajoute des sous-requêtes connexes à la requête utilisateur, basées
 * sur la matière détectée. Retourne la liste fusionnée (originale
 * + enrichissements) en priorité décroissante.
 *
 * @param baseQueries requêtes de base extraites de la query utilisateur
 * @param matter matière détectée par detectMatter() dans client.ts
 * @param maxAdded nombre max de sous-requêtes ajoutées (défaut 3)
 */
export function enrichSearchQueries(
  baseQueries: string[],
  matter: string | null | undefined,
  maxAdded: number = 3
): string[] {
  if (!matter || matter === "unknown") return baseQueries;
  const enrichments = MATTER_ENRICHMENTS[matter];
  if (!enrichments || enrichments.length === 0) return baseQueries;

  const out = [...baseQueries];
  const seen = new Set(baseQueries.map((q) => q.toLowerCase()));
  for (const e of enrichments.slice(0, maxAdded)) {
    if (!seen.has(e.toLowerCase())) {
      out.push(e);
      seen.add(e.toLowerCase());
    }
  }
  return out;
}
