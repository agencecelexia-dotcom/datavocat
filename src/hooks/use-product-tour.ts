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
      "L'IA affine l'analyse. Certaines questions acceptent plusieurs reponses (cochez-en plusieurs). Puis cliquez 'Lancer l'analyse' ou 'Passer'.",
    waitFor: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="analyzing"],[data-tour-phase="done"]',
    noOverlay: true,
    waitHint: "Interagissez avec la page",
  },
  {
    target: "analyzing-screen",
    title: "3. Analyse en cours",
    description:
      "Recherche dans Judilibre + data.gouv.fr puis redaction par l'IA. Les etapes s'eclairent au fur et a mesure, avec un decompte en temps reel.",
    waitFor: '[data-tour-phase="done"]',
    skipIf: '[data-tour-phase="done"]',
    waitHint: "Veuillez patienter...",
  },
  {
    target: "fiabilite-badge",
    title: "4. Indice de fiabilite",
    description:
      "Cet indice evalue la qualite des sources. Cliquez sur le (i) pour voir les 7 criteres du calcul.",
    showButton: true,
    buttonLabel: "Compris",
  },
  {
    target: "tour-view-tabs",
    title: "5. Explorez les vues",
    description:
      "Cliquez sur l'onglet Dashboard pour voir les graphiques, le taux de succes et le risque d'echec en miroir.",
    waitFor: '[data-tour-active-view="dashboard"]',
  },
  {
    target: "tour-view-tabs",
    title: "6. Filtrez les decisions",
    description:
      "Passez sur l'onglet Tableau puis filtrez par Favorables / Defavorables / Nuancees pour trier les preuves pertinentes.",
    waitFor: '[data-tour-active-view="tableau"]',
  },
  {
    target: "tour-view-tabs",
    title: "7. Decouvrez les sources",
    description:
      "Maintenant cliquez sur l'onglet Sources pour voir les decisions citees, avec liens vers Legifrance ou Judilibre selon la reference.",
    waitFor: '[data-tour-active-view="sources"]',
  },
  {
    target: "tour-export-buttons",
    title: "8. Exportez votre travail",
    description:
      "Quatre formats disponibles : PDF, DOCX (rapport complet), CSV (tableau de preuve), JSON (analyse complete pour outils externes).",
    showButton: true,
    buttonLabel: "Suivant",
  },
  {
    target: "nav-historique",
    title: "9. Historique",
    description:
      "Cliquez ici pour retrouver toutes vos analyses sauvegardees.",
    position: "right",
  },
  {
    target: "user-menu",
    title: "10. Parametres",
    description:
      "Cliquez pour acceder a vos parametres. Relancez ce tutoriel depuis Parametres > Aide & Tutoriel.",
  },
];

const LAUNCH_KEY = "datavocat_launch_tour";
const SEEN_KEY = "datavocat_tour_seen";

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
    const val = localStorage.getItem(LAUNCH_KEY);
    if (val) {
      localStorage.removeItem(LAUNCH_KEY);
      _pendingLaunch = true;
    }
    // Auto-démarrage à la toute première visite (pas encore vu).
    const alreadySeen = localStorage.getItem(SEEN_KEY);
    if (!alreadySeen && !val) {
      _pendingLaunch = true;
      localStorage.setItem(SEEN_KEY, "true");
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
