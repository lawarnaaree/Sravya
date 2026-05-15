import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "sravya-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark";
  });

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  return { theme, setTheme };
}

// Call once at app start so the theme is applied before first paint
export function initTheme() {
  const saved = (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark";
  applyTheme(saved);
}
