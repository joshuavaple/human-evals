// Light/dark mode. The choice is saved in the browser (localStorage); until the
// user picks one, we follow the operating system's setting.
//
// Dark mode works by putting class="dark" on <html>. Tailwind's `dark:` classes
// (e.g. `dark:bg-slate-900`) only apply while that class is present; see the
// `@custom-variant dark` line in src/index.css.
//
// index.html has a tiny inline script doing the same as getInitialTheme() +
// applyTheme() before React loads, so the page doesn't flash white. Keep the
// two in sync (same storage key).

export type Theme = 'light' | 'dark'

export const STORAGE_KEY = 'theme'

export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be blocked (e.g. private browsing); fall back to the OS setting.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Not saved; the theme still applies for this visit.
  }
}
