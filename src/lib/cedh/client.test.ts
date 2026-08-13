/**
 * Tests du ciblage des sources de contexte CEDH et CNIL.
 *
 * Enjeu : ces sources ne doivent être interrogées que lorsque la matière s'y
 * prête. Les solliciter systématiquement coûterait du temps de réponse et du
 * contexte payant pour un apport nul sur un litige commercial ou un bail.
 */

import { describe, it, expect } from "vitest";
import { isConventionMatter, formatCedhForPrompt } from "./client";
import { isDataProtectionMatter } from "../legifrance/cnil";

describe("isConventionMatter — déclenchement CEDH", () => {
  it("détecte le droit des étrangers", () => {
    expect(isConventionMatter("Recours contre une OQTF, refus de titre de séjour")).toBe(true);
    expect(isConventionMatter("Mon client demande l'asile après un refus")).toBe(true);
  });

  it("détecte les libertés fondamentales et la procédure pénale", () => {
    expect(isConventionMatter("Contestation d'une garde à vue prolongée")).toBe(true);
    expect(isConventionMatter("Atteinte à la liberté d'expression d'un salarié")).toBe(true);
    expect(isConventionMatter("Délai raisonnable de jugement dépassé")).toBe(true);
  });

  it("détecte une invocation explicite de la Convention", () => {
    expect(isConventionMatter("Violation de l'article 8 de la Convention européenne")).toBe(true);
    expect(isConventionMatter("Jurisprudence CEDH applicable")).toBe(true);
  });

  it("ne se déclenche pas sur un litige sans dimension conventionnelle", () => {
    expect(isConventionMatter("Refus de renouvellement d'un bail commercial")).toBe(false);
    expect(isConventionMatter("Rupture brutale de relations commerciales établies")).toBe(false);
    expect(isConventionMatter("Litige sur une clause de non-concurrence")).toBe(false);
  });
});

describe("isDataProtectionMatter — déclenchement CNIL", () => {
  it("détecte les sujets de protection des données", () => {
    expect(isDataProtectionMatter("Sanction RGPD pour défaut de consentement")).toBe(true);
    expect(isDataProtectionMatter("Vidéosurveillance des salariés dans l'entreprise")).toBe(true);
    expect(isDataProtectionMatter("Géolocalisation des véhicules de fonction")).toBe(true);
    expect(isDataProtectionMatter("Violation de données personnelles chez un sous-traitant")).toBe(true);
  });

  it("ne se déclenche pas hors protection des données", () => {
    expect(isDataProtectionMatter("Licenciement pour faute grave après 15 ans")).toBe(false);
    expect(isDataProtectionMatter("Indemnité d'éviction d'un bail commercial")).toBe(false);
  });
});

describe("formatCedhForPrompt — cadrage du bloc", () => {
  it("ne produit rien sans décision", () => {
    expect(formatCedhForPrompt([])).toBe("");
  });

  it("interdit explicitement la comptabilisation dans les taux", () => {
    const bloc = formatCedhForPrompt([
      {
        itemid: "001-123456",
        docname: "AFFAIRE X c. FRANCE",
        date: "2024-03-12",
        article: "8",
        conclusion: "Violation de l'article 8",
        importance: "1",
        url: "https://hudoc.echr.coe.int/fre?i=001-123456",
      },
    ]);
    expect(bloc).toContain("AFFAIRE X c. FRANCE");
    expect(bloc).toContain("ne sont PAS comptabilisés dans les statistiques");
    expect(bloc).toContain("AUCUN taux");
  });
});
