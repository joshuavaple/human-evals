import { useEffect, useState } from 'react'

import { applyTheme, getInitialTheme, saveTheme, type Theme } from '../lib/theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => applyTheme(theme), [theme])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    saveTheme(next)
    setTheme(next)
  }

  return { theme, toggleTheme }
}
