/**
 * Tests du moteur statistique.
 *
 * Ces tests verrouillent les invariants corrigés lors de l'audit d'août 2026.
 * Ils portent sur ce qui est *publié à l'avocat* : dénominateurs, seuils, et
 * absence de statistiques fabriquées.
 */

import { describe, it, expect } from "vitest";
import { computeCorpusStats, formatStatsForPrompt } from "./stats";
import type { JudilibreDecision } from "./client";

/** Fabrique une décision minimale pour les tests. */
function dec(over: Partial<JudilibreDecision> = {}): JudilibreDecision {
  return {
    id: Math.random().toString(36).slice(2),
    jurisdiction: "ca",
    chamber: "soc",
    number: ["21/01234"],
    solution: "Infirme la décision déférée",
    date: "2024-06-15",
    themes: [],
    ...over,
  };
}

/** n décisions identiques. */
function many(n: number, over: Partial<JudilibreDecision> = {}) {
  return Array.from({ length: n }, () => dec(over));
}

/**
 * Corpus réaliste : 75 % d'infirmations, 25 % de confirmations.
 * Un corpus à sens unique déclencherait le garde-fou `corpusUnilateral`.
 */
function mixte(n: number, over: Partial<JudilibreDecision> = {}) {
  const fav = Math.ceil(n * 0.75);
  return [
    ...many(fav, { solution: "Infirme la décision déférée", ...over }),
    ...many(n - fav, { solution: "Confirme la décision déférée", ...over }),
  ];
}

describe("dénominateurs des taux", () => {
  it("exclut les décisions sans dispositif du taux d'issue favorable", () => {
    // 10 favorables + 10 sans dispositif (typiquement le fonds JURI).
    const corpus = [
      ...many(10, { solution: "Infirme la décision déférée" }),
      ...many(10, { solution: "" }),
    ];
    const stats = computeCorpusStats(corpus);

    // Le taux doit valoir 100 % (10/10 classifiables), pas 50 % (10/20).
    expect(stats.hierarchy.courAppel.classifiables).toBe(10);
    expect(stats.hierarchy.courAppel.indetermines).toBe(10);
    expect(stats.hierarchy.courAppel.acceptanceRate).toBe(100);
    expect(stats.indeterminesTotal).toBe(10);
  });

  it("n'écrase pas la cohérence à cause des décisions muettes", () => {
    // Sans la correction, 10 « nuances » feraient tomber coherencePct à 50 %,
    // ce qui pèse 35 % de l'indice de fiabilité affiché.
    const corpus = [
      ...many(10, { solution: "Confirme la décision déférée" }),
      ...many(10, { solution: "" }),
    ];
    expect(computeCorpusStats(corpus).coherencePct).toBe(100);
  });

  it("le total du corpus reste la somme des 4 catégories hiérarchiques", () => {
    const corpus = [
      ...many(5, { jurisdiction: "cc" }),
      ...many(4, { jurisdiction: "ca" }),
      ...many(3, { jurisdiction: "tj" }),
      ...many(2, { jurisdiction: "ce" }),
    ];
    const s = computeCorpusStats(corpus);
    const sum =
      s.hierarchy.premierDegre.total +
      s.hierarchy.courAppel.total +
      s.hierarchy.cassation.total +
      s.hierarchy.conseilEtat.total;
    expect(sum).toBe(s.total);
    expect(s.total).toBe(14);
  });
});

describe("seuil d'échantillon du taux publié", () => {
  it("ne publie pas de taux sous 15 décisions classifiables", () => {
    const stats = computeCorpusStats(many(14, { jurisdiction: "ca" }));
    expect(stats.tauxSuccesRetenu).toBeNull();
    expect(stats.tauxSuccesSource).toBeNull();
  });

  it("publie le taux avec son effectif et sa marge dès 15 décisions", () => {
    // Corpus des deux sens : 12 infirmations + 4 confirmations. Un corpus
    // unilatéral serait refusé par le garde-fou (cf. « corpus unilatéral »).
    const stats = computeCorpusStats([
      ...many(12, { jurisdiction: "ca", solution: "Infirme la décision déférée" }),
      ...many(4, { jurisdiction: "ca", solution: "Confirme la décision déférée" }),
    ]);
    expect(stats.tauxSuccesRetenu).toBe(75);
    expect(stats.tauxSuccesN).toBe(16);
    expect(stats.tauxSuccesMarge).not.toBeNull();
  });

  it("la marge d'erreur décroît quand l'échantillon grandit", () => {
    const petit = computeCorpusStats(
      [...many(10, { solution: "Infirme" }), ...many(10, { solution: "Confirme" })]
    );
    const grand = computeCorpusStats(
      [...many(100, { solution: "Infirme" }), ...many(100, { solution: "Confirme" })]
    );
    expect(petit.tauxSuccesMarge).not.toBeNull();
    expect(grand.tauxSuccesMarge).not.toBeNull();
    expect(grand.tauxSuccesMarge!).toBeLessThan(petit.tauxSuccesMarge!);
  });
});

describe("corpus unilatéral (constaté en test réel)", () => {
  it("ne publie pas de taux quand aucune décision n'est défavorable", () => {
    // Cas réel observé : Judilibre remonte 52 cassations + 35 infirmations,
    // zéro rejet et zéro confirmation. Le taux vaudrait 100 % ± 0 — une
    // précision apparente qui ne mesure que le biais de sélection.
    const corpus = [
      ...many(52, { jurisdiction: "cc", solution: "cassation" }),
      ...many(35, {
        jurisdiction: "ca",
        solution: "Infirme partiellement, réforme ou modifie certaines dispositions",
      }),
    ];
    const stats = computeCorpusStats(corpus);

    expect(stats.corpusUnilateral).toBe(true);
    expect(stats.tauxSuccesRetenu).toBeNull();
  });

  it("publie le taux dès qu'il existe des décisions dans les deux sens", () => {
    const corpus = [
      ...many(20, { jurisdiction: "ca", solution: "Infirme la décision déférée" }),
      ...many(20, { jurisdiction: "ca", solution: "Confirme la décision déférée" }),
    ];
    const stats = computeCorpusStats(corpus);

    expect(stats.corpusUnilateral).toBe(false);
    expect(stats.tauxSuccesRetenu).toBe(50);
  });

  it("explique le refus dans le bloc transmis au modèle", () => {
    const corpus = many(40, { jurisdiction: "cc", solution: "cassation" });
    const bloc = formatStatsForPrompt(computeCorpusStats(corpus));
    expect(bloc).toContain("NON PUBLIABLE");
    expect(bloc).toContain("biais de sélection");
  });
});

describe("statistiques non fabriquées", () => {
  it("ne produit aucune variation régionale (ressort absent de Judilibre)", () => {
    // Auparavant : label = "CA " + chamber → des variations PAR CHAMBRE
    // étiquetées comme des variations PAR COUR D'APPEL.
    const corpus = [
      ...many(5, { jurisdiction: "ca", chamber: "soc" }),
      ...many(5, { jurisdiction: "ca", chamber: "com" }),
    ];
    expect(computeCorpusStats(corpus).regionalVariations).toEqual([]);
  });

  it("ne publie pas de taux de condamnation article 700", () => {
    const corpus = many(20, {
      sommaire:
        "condamne la société à payer 2 000 euros au titre de l'article 700 du code de procédure civile",
    });
    expect(computeCorpusStats(corpus).montantsStats.article700.tauxCondamnation).toBeNull();
  });

  it("exige au moins 5 décisions pour publier un thème de classement", () => {
    const corpus = [
      ...many(4, { themes: ["Contrat de travail - rupture"] }),
      ...many(6, { themes: ["Licenciement - faute grave"] }),
    ];
    const noms = computeCorpusStats(corpus).argumentStats.map((a) => a.name);
    expect(noms).toContain("Licenciement");
    expect(noms).not.toContain("Contrat de travail");
  });
});

describe("bloc FAITS VÉRIFIÉS transmis au modèle", () => {
  it("interdit explicitement la formulation « chances de succès »", () => {
    const bloc = formatStatsForPrompt(computeCorpusStats(mixte(20)));
    expect(bloc).toContain("TAUX D'ISSUE FAVORABLE OBSERVÉ");
    expect(bloc).toMatch(/n'écris JAMAIS « X% de chances de succès »/);
  });

  it("signale que les variations régionales ne sont pas calculables", () => {
    const bloc = formatStatsForPrompt(computeCorpusStats(mixte(20)));
    expect(bloc).toContain("VARIATIONS RÉGIONALES : non disponibles");
  });

  it("cadre les thèmes comme du classement documentaire", () => {
    const corpus = many(10, { themes: ["Licenciement - faute grave"] });
    const bloc = formatStatsForPrompt(computeCorpusStats(corpus));
    expect(bloc).toContain("ISSUE FAVORABLE PAR THÈME DE CLASSEMENT");
    expect(bloc).toContain("pas les moyens invoqués par les parties");
  });

  it("préserve l'invariant de comptage annoncé au modèle", () => {
    const bloc = formatStatsForPrompt(computeCorpusStats(many(23)));
    expect(bloc).toContain("Total décisions analysées : 23");
    expect(bloc).toContain("(doit = 23)");
  });

  it("n'affiche pas de fourchette de montants sous 5 échantillons", () => {
    const corpus = [
      ...many(2, { sommaire: "condamne à payer 5 000 euros de dommages-intérêts" }),
      ...many(18, { sommaire: "rejette la demande" }),
    ];
    const bloc = formatStatsForPrompt(computeCorpusStats(corpus));
    expect(bloc).toMatch(/échantillon insuffisant|aucun montant/i);
  });
});
