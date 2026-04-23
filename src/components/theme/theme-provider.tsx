"use client";

import { useEffect } from "react";

/**
 * ThemeProvider — version simplifiée : l'application utilise exclusivement
 * le thème « Greffe » (papier crème éditorial). Les variantes Nuit et Palais
 * ne sont plus exposées via l'UI ; le CSS correspondant reste dans globals.css
 * pour pouvoir les réactiver sans migration si besoin.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.remove("theme-jurimetrie", "theme-palais", "dark");
    document.body.classList.add("theme-greffe");
    // Nettoie une éventuelle clé legacy qui aurait forcé un autre thème.
    try {
      window.localStorage.removeItem("datavocat-theme");
    } catch {
      // ignore
    }
  }, []);
  return <>{children}</>;
}
