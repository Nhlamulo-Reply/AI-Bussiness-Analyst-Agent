export type Theme = "light" | "dark";

const themeStorageKey = "clarity-theme";

export function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem(themeStorageKey);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function setThemePreference(theme: Theme) {
  applyTheme(theme);
  window.localStorage.setItem(themeStorageKey, theme);
}
