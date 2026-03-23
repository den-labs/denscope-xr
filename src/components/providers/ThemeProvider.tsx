'use client'

import { createContext, useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
}>({
  theme: 'dark',
  toggleTheme: () => {},
})

const STORAGE_KEY = 'denscope-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  // Read persisted theme on mount (prevents flash for returning users)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored)
    }
    // Enable smooth transitions after initial theme is applied
    const timeout = setTimeout(() => {
      document.documentElement.classList.add('theme-transition')
    }, 100)
    return () => clearTimeout(timeout)
  }, [])

  // Sync class to html element
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
