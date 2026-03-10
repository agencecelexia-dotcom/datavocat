"use client";

import { useState, useCallback, useEffect } from "react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  /** "info" = just show tooltip, "interact" = allow clicks through overlay */
  type?: "info" | "interact";
  /** Custom event name to dispatch when entering this step */
  action?: string;
  /** CSS selector — auto-advance when this element appears in DOM */
  waitFor?: string;
  /** Override the "Suivant" button text */
  buttonLabel?: string;
}

/** Example query pre-filled during the interactive tour */
export const TOUR_QUERY =
  "Mon client est un salarie licencie pour faute grave apres 15 ans d'anciennete dans une entreprise de BTP. Il conteste le motif. Quelles sont ses chances devant le CPH de Paris ?";

const TOUR_STEPS: TourStep[] = [
  {
    target: "tour-welcome",
    title: "Bienvenue sur Datavocat !",
    description:
      "Decouvrez les fonctionnalites de la plateforme etape par etape. A la fin du tutoriel, vous pourrez lancer votre premiere analyse.",
    position: "center",
    buttonLabel: "C'est parti !",
  },
  {
    target: "query-input",
    title: "1. Saisissez votre affaire",
    description:
      "Decrivez la situation juridique en langage naturel. Un exemple a ete pre-rempli pour vous. Cliquez 'Analyser' pour tester, ou passez a l'etape suivante.",
    type: "interact",
    action: "tour:fill-query",
    waitFor: '[data-tour="clarify-section"],[data-tour-phase="analyzing"]',
  },
  {
    target: "examples",
    title: "2. Exemples de demandes",
    description:
      "Pas d'inspiration ? Cliquez sur un exemple pour pre-remplir votre demande. Droit social, commercial, immobilier — tous les domaines sont couverts.",
  },
  {
    target: "sidebar",
    title: "3. Navigation",
    description:
      "La barre laterale vous donne acces a : Nouvelle analyse, Historique de vos analyses passees, et Comparateur pour croiser plusieurs dossiers.",
    position: "right",
  },
  {
    target: "nav-historique",
    title: "4. Historique",
    description:
      "Toutes vos analyses sont sauvegardees automatiquement. Retrouvez rapport, dashboard et sources de chaque analyse a tout moment.",
    position: "right",
  },
  {
    target: "tour-results-info",
    title: "5. Resultats en 4 vues",
    description:
      "Apres chaque analyse, basculez entre : Rapport (texte detaille), Dashboard (graphiques et KPIs), Tableau de preuve et Sources (decisions citees avec liens Legifrance).",
    position: "center",
  },
  {
    target: "tour-exports-info",
    title: "6. Exports professionnels",
    description:
      "Generez un PDF ou DOCX complet avec decisions, statistiques et recommandations strategiques. Pret a integrer dans votre dossier client.",
    position: "center",
  },
  {
    target: "user-menu",
    title: "7. Parametres",
    description:
      "Accedez a votre profil, mode sombre, et preferences. Vous pouvez relancer ce tutoriel a tout moment depuis Parametres > Preferences > Aide & Tutoriel.",
    buttonLabel: "Terminer et essayer !",
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

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsActive(false);
      setCurrentStep(0);
    }
  }, [currentStep]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
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
