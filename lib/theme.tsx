'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }

const ThemeContext = createContext<Ctx | null>(null)

function apply(t: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', t === 'dark')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  useEffect(() => {
    const saved = (localStorage.getItem('byas_theme') as Theme | null) ?? 'dark'
    apply(saved)
    setThemeState(saved)
  }, [])
  function setTheme(t: Theme) {
    apply(t)
    try {
      localStorage.setItem('byas_theme', t)
    } catch {}
    setThemeState(t)
  }
  const value: Ctx = {
    theme,
    setTheme,
    toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Ctx {
  const c = useContext(ThemeContext)
  if (!c) return { theme: 'dark', setTheme: () => {}, toggle: () => {} }
  return c
}
