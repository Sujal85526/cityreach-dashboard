import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'cityreach-theme'
const CHANGE_EVENT = 'cityreach-theme-change'

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be unavailable (private mode); fall back to light.
  }
  // Light by default; dark only when the person picks it (top bar or Settings).
  return 'light'
}

/** Applies the saved theme before React renders, so every page (incl. login) starts right. */
export function applyInitialTheme() {
  document.documentElement.classList.toggle('dark', readTheme() === 'dark')
}

/** Theme state shared by every caller (top bar button and Settings → Theme stay in sync). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    const sync = (e: Event) => setTheme((e as CustomEvent<Theme>).detail)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => window.removeEventListener(CHANGE_EVENT, sync)
  }, [])

  const set = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not critical: the theme just won't be remembered.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }))
  }, [])

  const toggle = useCallback(() => set(readTheme() === 'dark' ? 'light' : 'dark'), [set])
  return { theme, toggle, set }
}
