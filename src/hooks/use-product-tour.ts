"use client";

import { useState, useCallback, useEffect } from "react";

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
}

/** Example query pre-filled during the interactive tour */
export const TOUR_QUERY =
  "Mon client est un salarie licencie pour faute grave apres 15 ans d'anciennete dans une entreprise de BTP. Il conteste le motif. Quelles sont ses chances devant le CPH de Paris ?";

const TOUR_STEPS: TourStep[] = [
  {
    target: "tour-welcome",
    title: "Bienvenue sur Datavocat !",
    description:
      "Ce tutoriel interactif vous guide a travers la plateforme. Vous allez cliquer sur chaque fonctionnalite pour la decouvrir.",
    position: "center",
    buttonLabel: "C'est parti !",
    showButton: true,
  },
  {
    target: "analyze-button",
    title: "1. Lancez une analyse",
    description:
      "Un cas a ete pre-rempli. Cliquez sur le bouton Analyser en surbrillance.",
    action: "tour:fill-query",
    waitFor: '[data-tour="clarify-section"],[data-tour-phase="analyzing"]',
  },
  {
    target: "clarify-buttons",
    title: "2. Repondez aux questions",
    description:
      "L'IA affine l'analyse. Repondez aux questions puis cliquez 'Lancer l'analyse' ou 'Passer et analyser'.",
    waitFor: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
  },
  {
    target: "analyzing-screen",
    title: "3. Analyse en cours",
    description:
      "Recherche dans 500 000+ decisions. Patientez 30 a 60 secondes.",
    waitFor: '[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="done"]',
  },
  {
    target: "tour-view-tabs",
    title: "4. Explorez les vues",
    description:
      "Cliquez sur l'onglet Dashboard pour voir les graphiques et KPIs.",
    waitFor: '[data-tour-active-view="dashboard"]',
  },
  {
    target: "tour-view-tabs",
    title: "5. Decouvrez les sources",
    description:
      "Maintenant cliquez sur l'onglet Sources pour voir les decisions citees.",
    waitFor: '[data-tour-active-view="sources"]',
  },
  {
    target: "tour-export-buttons",
    title: "6. Exportez votre travail",
    description:
      "Cliquez sur PDF ou DOCX pour telecharger votre rapport professionnel.",
  },
  {
    target: "nav-historique",
    title: "7. Historique",
    description:
      "Cliquez ici pour retrouver toutes vos analyses sauvegardees.",
    position: "right",
  },
  {
    target: "user-menu",
    title: "8. Parametres",
    description:
      "Cliquez pour acceder a vos parametres. Relancez ce tutoriel depuis Parametres > Aide & Tutoriel.",
  },
];

const LAUNCH_KEY = "datavocat_launch_tour";

export function useProductTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const shouldLaunch = localStorage.getItem(LAUNCH_KEY);
    if (shouldLaunch) {
      localStorage.removeItem(LAUNCH_KEY);
      const timer = setTimeout(() => setIsActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const goToStep = useCallback((idx: number) => {
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
    } else {
      setCurrentStep(nextIdx);
    }
  }, []);

  const next = useCallback(() => {
    goToStep(currentStep + 1);
  }, [currentStep, goToStep]);

  const skip = useCallback(() => {
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
