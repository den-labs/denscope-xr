import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '../ThemeToggle'

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({
    theme: 'dark',
    setTheme: vi.fn(),
    resolvedTheme: 'dark',
    themes: [],
    systemTheme: undefined,
    forcedTheme: undefined,
  })),
}))

import { useTheme } from 'next-themes'
const mockUseTheme = vi.mocked(useTheme)

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

describe('ThemeToggle', () => {
  it('renders a button with accessible label', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument()
  })

  it('calls setTheme("light") when currently dark', () => {
    const setTheme = vi.fn()
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme, resolvedTheme: 'dark', themes: [], systemTheme: undefined, forcedTheme: undefined })
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('calls setTheme("dark") when currently light', () => {
    const setTheme = vi.fn()
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme, resolvedTheme: 'light', themes: [], systemTheme: undefined, forcedTheme: undefined })
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})
