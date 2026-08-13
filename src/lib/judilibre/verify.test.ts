/**
 * Tests de la vérification post-génération.
 *
 * Enjeu : ce module est le dernier rempart avant qu'un rapport parte chez
 * l'avocat. Il doit retirer ce qui n'est pas vérifiable — sans jamais
 * fabriquer d'erreur en essayant de « réparer » le texte.
 */

import { describe, it, expect } from "vitest";
import { verifyAndCleanMarkdown } from "./verify";
import type { JudilibreDecision } from "./client";

function dec(over: Partial<JudilibreDecision> = {}): JudilibreDecision {
  return {
    id: "id-1",
    jurisdiction: "cc",
    chamber: "soc",
    number: ["21-12345"],
    ecli: "ECLI:FR:CCASS:2023:SO00547",
    solution: "Cassation",
    date: "2023-05-11",
    themes: [],
    ...over,
  };
}

describe("suppression des références non vérifiables", () => {
  it("retire une phrase citant un ECLI absent du corpus", () => {
    const corpus = [dec()];
    const md =
      "Le principe est établi.\n" +
      "Voir ECLI:FR:CCASS:2099:SO99999 qui l'illustre.\n";
    const r = verifyAndCleanMarkdown(md, corpus);

    expect(r.cleanedMarkdown).not.toContain("ECLI:FR:CCASS:2099:SO99999");
    expect(r.cleanedMarkdown).toContain("Le principe est établi.");
    expect(r.unverifiedRefs.length).toBeGreaterThan(0);
  });

  it("conserve une référence présente dans le corpus", () => {
    const corpus = [dec()];
    const md = "Comme le retient ECLI:FR:CCASS:2023:SO00547, la solution est acquise.";
    const r = verifyAndCleanMarkdown(md, corpus);

    expect(r.cleanedMarkdown).toContain("ECLI:FR:CCASS:2023:SO00547");
    expect(r.verifiedRefs).toBeGreaterThan(0);
  });

  it("ne confond pas un n° RG de cour d'appel avec un n° de pourvoi", () => {
    // "21/12345" (RG, juridiction du fond) ne doit pas valider par
    // rapprochement avec "21-12345" (pourvoi, Cassation) du corpus.
    const corpus = [dec({ jurisdiction: "cc", number: ["21-12345"] })];
    const md = "La cour d'appel a statué dans l'affaire n° RG 21/12345 en 2023.";
    const r = verifyAndCleanMarkdown(md, corpus);

    expect(r.unverifiedRefs.length).toBeGreaterThan(0);
  });
});

describe("cohérence du comptage — ne jamais réécrire les chiffres", () => {
  it("n'altère PAS les pourcentages quand des lignes sont retirées", () => {
    // Régression : `patchAnnouncedCount` réécrivait « 40 » en « 35 » sans
    // toucher au « 70 % », produisant un rapport arithmétiquement faux.
    const corpus = [dec()];
    const md = [
      "Sur 40 décisions, 28 favorables (70 %).",
      "",
      "## Tableau de preuve",
      "",
      "| N° | Reference | Resultat |",
      "| --- | --- | --- |",
      "| 1 | ECLI:FR:CCASS:2023:SO00547 | Favorable |",
      "| 2 | ECLI:FR:CCASS:2099:SO99999 | Favorable |",
      "",
    ].join("\n");

    const r = verifyAndCleanMarkdown(md, corpus);

    // La ligne inventée disparaît…
    expect(r.cleanedMarkdown).not.toContain("SO99999");
    // …mais le couple (28, 70 %) reste intact : on ne fabrique pas de chiffre.
    expect(r.cleanedMarkdown).toContain("28 favorables (70 %)");
    expect(r.removedRows).toBeGreaterThan(0);
  });

  it("signale l'incohérence au lieu de la masquer", () => {
    const corpus = [dec(), dec({ id: "id-2", ecli: "ECLI:FR:CCASS:2023:SO00548" })];
    const md = [
      "## Tableau de preuve",
      "",
      "| N° | Reference |",
      "| --- | --- |",
      "| 1 | ECLI:FR:CCASS:2023:SO00547 |",
      "| 2 | ECLI:FR:CCASS:2099:SO99999 |",
      "",
    ].join("\n");

    const r = verifyAndCleanMarkdown(md, corpus);

    expect(r.coherenceCorrected).toBe(true);
    expect(r.countMismatch).not.toBeNull();
    expect(r.cleanedMarkdown).toContain("Contrôle automatique des sources");
  });

  it("ne signale rien quand le tableau est intact", () => {
    const corpus = [dec()];
    const md = [
      "## Tableau de preuve",
      "",
      "| N° | Reference |",
      "| --- | --- |",
      "| 1 | ECLI:FR:CCASS:2023:SO00547 |",
      "",
    ].join("\n");

    const r = verifyAndCleanMarkdown(md, corpus);

    expect(r.removedRows).toBe(0);
    expect(r.countMismatch).toBeNull();
    expect(r.cleanedMarkdown).not.toContain("Contrôle automatique");
  });
});

describe("robustesse", () => {
  it("accepte un corpus vide sans lever", () => {
    expect(() => verifyAndCleanMarkdown("Texte simple.", [])).not.toThrow();
  });

  it("accepte un markdown vide", () => {
    const r = verifyAndCleanMarkdown("", [dec()]);
    expect(r.citedRefs).toBe(0);
  });
});
