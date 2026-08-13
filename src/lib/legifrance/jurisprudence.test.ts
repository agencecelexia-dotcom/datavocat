/**
 * Tests du parsing des titres CETAT (jurisprudence administrative).
 *
 * Les titres utilisés ici sont ceux réellement renvoyés par l'API Légifrance,
 * relevés lors du test en conditions réelles d'août 2026. Le parsing initial
 * n'acceptait que les formes développées (« Cour administrative d'appel »)
 * ancrées en début de chaîne, alors que l'API renvoie « CAA de PARIS » :
 * aucune CAA ni aucun TA n'était reconnu.
 */

import { describe, it, expect } from "vitest";
import { parseTitleCetat } from "./jurisprudence";

describe("parseTitleCetat — juridiction", () => {
  it("reconnaît le Conseil d'État", () => {
    const r = parseTitleCetat(
      "Conseil d'État, 2ème - 7ème chambres réunies, 28/10/2025, 504980"
    );
    expect(r.jurisdiction).toBe("ce");
    expect(r.date).toBe("2025-10-28");
    expect(r.numero).toBe("504980");
  });

  it("reconnaît une CAA sous sa forme abrégée", () => {
    const r = parseTitleCetat("CAA de PARIS, 5ème chambre, 03/07/2026, 25PA05264");
    expect(r.jurisdiction).toBe("caa");
    expect(r.date).toBe("2026-07-03");
    expect(r.numero).toBe("25PA05264");
  });

  it("reconnaît un TA sous sa forme abrégée", () => {
    const r = parseTitleCetat("TA de LYON, 3ème chambre, 12/03/2024, 2201234");
    expect(r.jurisdiction).toBe("ta");
  });

  it("reconnaît encore les formes développées", () => {
    expect(
      parseTitleCetat("Cour administrative d'appel de Nantes, 4/05/2023, 21NT01234")
        .jurisdiction
    ).toBe("caa");
    expect(
      parseTitleCetat("Tribunal administratif de Melun, 8/01/2022, 1900123")
        .jurisdiction
    ).toBe("ta");
  });
});

describe("parseTitleCetat — numéro d'instance", () => {
  it("extrait le numéro malgré une mention de publication en fin de titre", () => {
    // Régression : l'ancienne regex était ancrée en fin de chaîne et échouait
    // dès qu'un suffixe suivait, produisant des citations inexploitables.
    const r = parseTitleCetat(
      "CAA de MARSEILLE, 2ème chambre, 22/07/2020, 19MA02913, Inédit au recueil Lebon"
    );
    expect(r.numero).toBe("19MA02913");
    expect(r.jurisdiction).toBe("caa");
  });

  it("extrait un numéro de Conseil d'État suivi d'une mention", () => {
    const r = parseTitleCetat(
      "Conseil d'État, 2ème - 7ème chambres réunies, 10/10/2024, 493514, Publié au recueil Lebon"
    );
    expect(r.numero).toBe("493514");
  });
});

describe("parseTitleCetat — formation", () => {
  it("extrait la formation de jugement", () => {
    expect(
      parseTitleCetat("CAA de VERSAILLES, Formation plénière, 04/07/2023, 22VE02570")
        .chamber
    ).toBe("Formation plénière");
  });
});

describe("parseTitleCetat — balises de surlignage", () => {
  it("retire les balises <mark> insérées par l'API dans le titre", () => {
    // Régression observée en réel : l'API surligne les termes recherchés
    // À L'INTÉRIEUR du nom de juridiction, ce qui empêchait toute
    // reconnaissance et renvoyait la décision en « autre ».
    const r = parseTitleCetat(
      "<mark>Conseil</mark> d'État, 2ème chambre, 28/10/2025, 504980"
    );
    expect(r.jurisdiction).toBe("ce");
    expect(r.numero).toBe("504980");
  });

  it("reconnaît le Tribunal des conflits malgré le surlignage", () => {
    const r = parseTitleCetat(
      "<mark>Tribunal</mark> des Conflits, , 05/02/2024, C4299"
    );
    expect(r.jurisdiction).toBe("tc");
  });
});

describe("parseTitleCetat — robustesse", () => {
  it("ne lève pas sur un titre vide ou inattendu", () => {
    expect(() => parseTitleCetat("")).not.toThrow();
    expect(parseTitleCetat("").jurisdiction).toBe("autre");
    expect(parseTitleCetat("texte sans structure").jurisdiction).toBe("autre");
  });
});
