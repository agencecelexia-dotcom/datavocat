"use client";

import { useState, useCallback, useEffect } from "react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  /** "info" = just show tooltip, "interact" = allow clicks through overlay, "wait" = non-blocking wait */
  type?: "info" | "interact" | "wait";
  /** Custom event name to dispatch when entering this step */
  action?: string;
  /** CSS selector — auto-advance when this element appears in DOM */
  waitFor?: string;
  /** CSS selector — skip this step immediately if condition already met */
  skipIf?: string;
  /** Override the "Suivant" button text */
  buttonLabel?: string;
  /** Hide the next button (user must complete action to advance) */
  hideNext?: boolean;
}

/** Example query pre-filled during the interactive tour */
export const TOUR_QUERY =
  "Mon client est un salarie licencie pour faute grave apres 15 ans d'anciennete dans une entreprise de BTP. Il conteste le motif. Quelles sont ses chances devant le CPH de Paris ?";

const TOUR_STEPS: TourStep[] = [
  {
    target: "tour-welcome",
    title: "Bienvenue sur Datavocat !",
    description:
      "Ce tutoriel vous guide a travers une analyse juridique complete en situation reelle. Vous allez utiliser la plateforme comme un avocat le ferait au quotidien.",
    position: "center",
    buttonLabel: "C'est parti !",
  },
  {
    target: "query-input",
    title: "Decrivez votre affaire",
    description:
      "Un cas a ete pre-rempli : un licenciement pour faute grave conteste. Cliquez sur le bouton 'Analyser' pour lancer la recherche dans 500 000+ decisions.",
    type: "interact",
    action: "tour:fill-query",
    waitFor: '[data-tour-phase="clarify"],[data-tour-phase="analyzing"]',
    hideNext: true,
  },
  {
    target: "tour-page",
    title: "Questions de clarification",
    description:
      "L'IA pose des questions pour affiner l'analyse : juridiction, anciennete, type de contrat... Repondez a celles que vous souhaitez, puis cliquez 'Lancer l'analyse' ou 'Passer et analyser'.",
    type: "interact",
    waitFor: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
    hideNext: true,
    position: "center",
  },
  {
    target: "tour-page",
    title: "Analyse en cours",
    description:
      "Datavocat recherche dans Judilibre (Cour de cassation + Cours d'appel) et data.gouv.fr. L'IA Claude analyse les decisions trouvees et redige votre rapport. Patientez environ 30 a 60 secondes.",
    type: "wait",
    waitFor: '[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="done"]',
    hideNext: true,
    position: "center",
  },
  {
    target: "tour-view-tabs",
    title: "Quatre vues de resultats",
    description:
      "Votre analyse est prete ! Basculez entre : Rapport (texte detaille), Dashboard (graphiques et KPIs), Tableau de preuve et Sources (annexe des decisions). Essayez de cliquer sur chaque onglet.",
    type: "interact",
  },
  {
    target: "tour-export-buttons",
    title: "Exportez votre travail",
    description:
      "Generez un PDF ou DOCX professionnel avec decisions, statistiques et recommandations. Le document est pret a integrer dans votre dossier client.",
  },
  {
    target: "nav-historique",
    title: "Historique des analyses",
    description:
      "Toutes vos analyses sont sauvegardees automatiquement ici. Retrouvez-les a tout moment pour les relire, exporter ou comparer entre elles.",
    position: "right",
  },
  {
    target: "user-menu",
    title: "Parametres & tutoriel",
    description:
      "Accedez a vos parametres : profil, mode sombre, preferences. Vous pouvez relancer ce tutoriel a tout moment depuis Parametres > Preferences > Aide & Tutoriel.",
    buttonLabel: "Terminer",
  },
];

// This key triggers the tour on next page load — set by Settings or Registration
const LAUNCH_KEY = "datavocat_launch_tour";

export function useProductTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Only launch if explicitly requested (via settings or registration)
  useEffect(() => {
    const shouldLaunch = localStorage.getItem(LAUNCH_KEY);
    if (shouldLaunch) {
      localStorage.removeItem(LAUNCH_KEY);
      const timer = setTimeout(() => setIsActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const goToStep = useCallback((idx: number) => {
    // Skip steps whose skipIf condition is already met
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

  const prev = useCallback(() => {
    if (currentStep > 0) {
      // Go back, but skip interact/wait steps (can't redo them)
      let prevIdx = currentStep - 1;
      while (prevIdx > 0 && (TOUR_STEPS[prevIdx].type === "wait" || TOUR_STEPS[prevIdx].type === "interact")) {
        prevIdx--;
      }
      setCurrentStep(prevIdx);
    }
  }, [currentStep]);

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
    prev,
    skip,
  };
}

/** Call this to schedule the tour on next page load */
export function scheduleTour() {
  localStorage.setItem(LAUNCH_KEY, "true");
}
