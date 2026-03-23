import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { ThemeProvider } from '../ThemeProvider'
import { useTheme } from '@/hooks/useTheme'

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('defaults to dark theme', () => {
    const { getByTestId } = render(
      <ThemeProvider><ThemeConsumer /></ThemeProvider>,
    )
    expect(getByTestId('theme').textContent).toBe('dark')
  })

  it('adds dark class to documentElement', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggles to light theme', async () => {
    const { getByTestId, getByText } = render(
      <ThemeProvider><ThemeConsumer /></ThemeProvider>,
    )
    await act(() => getByText('toggle').click())
    expect(getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists theme to localStorage', async () => {
    const { getByText } = render(
      <ThemeProvider><ThemeConsumer /></ThemeProvider>,
    )
    await act(() => getByText('toggle').click())
    expect(localStorage.getItem('denscope-theme')).toBe('light')
  })

  it('reads persisted theme on mount', async () => {
    localStorage.setItem('denscope-theme', 'light')
    const { getByTestId } = render(
      <ThemeProvider><ThemeConsumer /></ThemeProvider>,
    )
    // useEffect runs async — wait for it
    await act(() => Promise.resolve())
    expect(getByTestId('theme').textContent).toBe('light')
  })
})
