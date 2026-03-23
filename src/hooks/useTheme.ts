'use client'

import { useContext } from 'react'
import { ThemeContext } from '@/components/providers/ThemeProvider'

export function useTheme() {
  return useContext(ThemeContext)
}
