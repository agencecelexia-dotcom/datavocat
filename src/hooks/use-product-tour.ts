"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  /** Custom event name to dispatch when entering this step */
  action?: string;
  /** CSS selector — auto-advance when this element appears in DOM */
  waitFor?: string;
  /** CSS selector — skip this step if condition already met */
  skipIf?: string;
  /** Override the main button text (only for welcome step) */
  buttonLabel?: string;
  /** Show a clickable button instead of requiring element interaction */
  showButton?: boolean;
  /** Hide the dark overlay — user needs full page interaction */
  noOverlay?: boolean;
  /** Custom hint text shown in the footer for waitFor steps (default: auto-detected) */
  waitHint?: string;
}

/** Example query pre-filled during the interactive tour */
export const TOUR_QUERY =
  "Mon client est un salarié licencié pour faute grave après 15 ans d'ancienneté dans une entreprise de BTP. Il conteste le motif. Que retient la jurisprudence du conseil de prud'hommes sur ce type de contestation ?";

const TOUR_STEPS: TourStep[] = [
  {
    // Étape centrée : aucune cible DOM n'est requise (position "center").
    target: "tour-page",
    title: "Bienvenue sur Datavocat",
    description:
      "Ce tutoriel interactif vous guide à travers la plateforme. Vous cliquerez sur chaque fonctionnalité pour la découvrir.",
    position: "center",
    buttonLabel: "C'est parti",
    showButton: true,
  },
  {
    target: "analyze-button",
    title: "1. Lancez une analyse",
    description:
      "Un cas a été pré-rempli. Cliquez sur le bouton Analyser en surbrillance.",
    action: "tour:fill-query",
    waitFor: '[data-tour="clarify-section"],[data-tour-phase="analyzing"]',
  },
  {
    target: "clarify-buttons",
    title: "2. Répondez aux questions",
    description:
      "L'analyse s'affine. Certaines questions acceptent plusieurs réponses. Cliquez ensuite sur « Lancer l'analyse » ou « Passer ».",
    waitFor: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
    noOverlay: true,
    waitHint: "Interagissez avec la page",
  },
  {
    target: "analyzing-screen",
    title: "3. Analyse en cours",
    description:
      "Recherche dans Judilibre et Légifrance, puis rédaction. Les étapes s'éclairent au fur et à mesure.",
    waitFor: '[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="done"]',
    waitHint: "Veuillez patienter…",
  },
  {
    target: "fiabilite-badge",
    title: "4. Indice de fiabilité",
    description:
      "Cet indice évalue la qualité du corpus mobilisé — ce n'est pas un pronostic d'issue. Cliquez sur le (i) pour voir le détail du calcul.",
    showButton: true,
    buttonLabel: "Compris",
  },
  {
    target: "tour-view-tabs",
    title: "5. Explorez les vues",
    description:
      "Cliquez sur l'onglet Chiffres pour voir les statistiques détaillées et leurs réserves méthodologiques.",
    waitFor: '[data-tour-active-view="dashboard"]',
  },
  {
    target: "tour-view-tabs",
    title: "6. Filtrez les décisions",
    description:
      "Passez sur l'onglet Tableau, puis filtrez par Favorables / Défavorables / Nuancées pour trier les décisions.",
    waitFor: '[data-tour-active-view="tableau"]',
  },
  {
    target: "tour-view-tabs",
    title: "7. Vérifiez les sources",
    description:
      "L'onglet Sources liste les décisions citées, avec un lien direct vers Légifrance ou Judilibre pour les consulter.",
    waitFor: '[data-tour-active-view="sources"]',
  },
  {
    target: "tour-export-buttons",
    title: "8. Exportez votre travail",
    description:
      "Trois formats : PDF (rapport éditorial), DOCX (rapport complet), Excel (tableau filtrable).",
    showButton: true,
    buttonLabel: "Suivant",
  },
  {
    target: "user-menu",
    title: "9. Historique et paramètres",
    description:
      "Ce menu donne accès à vos analyses précédentes et à vos paramètres.",
  },
];

const LAUNCH_KEY = "datavocat_launch_tour";

// Module-level flag: survives React Strict Mode effect double-firing.
// The first effect run reads+removes localStorage and sets this flag.
// After cleanup+re-run, the second effect sees the flag and starts the timer.
let _pendingLaunch = false;

export function useProductTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  // Guard against rapid/concurrent next() calls (double-advance protection)
  const advancingRef = useRef(false);

  useEffect(() => {
    // Le tour ne se déclenche que lorsque scheduleTour() a posé LAUNCH_KEY
    // (uniquement après inscription réussie). Pas d'auto-démarrage.
    const val = localStorage.getItem(LAUNCH_KEY);
    if (val) {
      localStorage.removeItem(LAUNCH_KEY);
      _pendingLaunch = true;
    }
    if (_pendingLaunch) {
      const timer = setTimeout(() => {
        _pendingLaunch = false;
        setIsActive(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Reset advancing guard when step changes
  useEffect(() => {
    advancingRef.current = false;
  }, [currentStep]);

  const goToStep = useCallback((idx: number) => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    let nextIdx = idx;
    while (nextIdx < TOUR_STEPS.length) {
      const step = TOUR_STEPS[nextIdx];
      if (step.skipIf && document.querySelector(step.skipIf)) {
        nextIdx++;
      } else {
        break;
      }
    }
    if (nextIdx >= TOUR_STEPS.length) {
      setIsActive(false);
      setCurrentStep(0);
      advancingRef.current = false;
    } else {
      setCurrentStep(nextIdx);
    }
  }, []);

  const next = useCallback(() => {
    goToStep(currentStep + 1);
  }, [currentStep, goToStep]);

  const skip = useCallback(() => {
    advancingRef.current = false;
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  return {
    isActive,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    step: TOUR_STEPS[currentStep],
    steps: TOUR_STEPS,
    next,
    skip,
  };
}

export function scheduleTour() {
  localStorage.setItem(LAUNCH_KEY, "true");
}
