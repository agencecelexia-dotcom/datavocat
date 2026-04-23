"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type DatavocatTheme = "greffe" | "jurimetrie" | "palais";

const THEMES: DatavocatTheme[] = ["greffe", "jurimetrie", "palais"];
const STORAGE_KEY = "datavocat-theme";

interface ThemeContextValue {
  theme: DatavocatTheme;
  setTheme: (t: DatavocatTheme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: DatavocatTheme) {
  if (typeof document === "undefined") return;
  document.body.classList.remove("theme-greffe", "theme-jurimetrie", "theme-palais", "dark");
  document.body.classList.add(`theme-${theme}`);
  if (theme === "jurimetrie") document.body.classList.add("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<DatavocatTheme>("greffe");

  useEffect(() => {
    let stored: DatavocatTheme | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw && THEMES.includes(raw as DatavocatTheme)) stored = raw as DatavocatTheme;
    } catch {
      // ignore
    }
    const initial = stored ?? "greffe";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (t: DatavocatTheme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
  };

  const cycleTheme = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback silencieux pour les pages qui appellent le hook avant l'hydratation
    return {
      theme: "greffe",
      setTheme: () => {},
      cycleTheme: () => {},
    };
  }
  return ctx;
}
