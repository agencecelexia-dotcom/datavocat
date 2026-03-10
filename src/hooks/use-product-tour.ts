"use client";

import { useState, useCallback, useEffect } from "react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "query-input",
    title: "Decrivez votre affaire",
    description:
      "Saisissez la situation juridique de votre client en langage naturel. Datavocat interroge automatiquement Judilibre (Cour de cassation, Cours d'appel) et data.gouv.fr pour trouver la jurisprudence pertinente.",
  },
  {
    target: "examples",
    title: "Exemples pour demarrer",
    description:
      "Cliquez sur un exemple pour pre-remplir votre demande. Ces cas couvrent differents domaines du droit : social, commercial, immobilier...",
  },
  {
    target: "sidebar",
    title: "Votre espace de travail",
    description:
      "Naviguez entre vos analyses, l'historique et le comparateur. Utilisez Ctrl+K pour la palette de commandes rapide.",
    position: "right",
  },
  {
    target: "nav-historique",
    title: "Historique des analyses",
    description:
      "Retrouvez toutes vos analyses precedentes ici. Chaque analyse est sauvegardee avec son rapport, dashboard et sources.",
    position: "right",
  },
  {
    target: "tour-results",
    title: "4 vues de resultats",
    description:
      "Apres l'analyse, basculez entre Rapport (texte), Dashboard (graphiques et KPIs), Tableau de preuve et Sources (annexe des decisions). Chaque vue est exportable en PDF ou DOCX.",
    position: "center",
  },
  {
    target: "tour-exports",
    title: "Exports professionnels",
    description:
      "Generez un rapport PDF ou DOCX complet avec toutes les decisions, statistiques et recommandations, pret a integrer dans votre dossier client.",
    position: "center",
  },
  {
    target: "user-menu",
    title: "Parametres & tutoriel",
    description:
      "Cliquez ici pour acceder a vos Parametres : profil, securite, mode sombre, et preferences. Vous pouvez relancer ce tutoriel a tout moment depuis Parametres > Preferences > Aide & Tutoriel.",
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
