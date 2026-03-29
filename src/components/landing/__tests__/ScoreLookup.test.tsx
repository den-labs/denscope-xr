import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScoreLookup } from '../ScoreLookup'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const exampleAgents = [
  { chainId: 42220, agentId: 5 },
  { chainId: 1187947933, agentId: 1 },
]

describe('ScoreLookup', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders chain select, agent input, and lookup button', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/agent id/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lookup/i })).toBeInTheDocument()
  })

  it('disables lookup button when input is empty', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    expect(screen.getByRole('button', { name: /lookup/i })).toBeDisabled()
  })

  it('disables lookup button when input is non-numeric', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(screen.getByRole('button', { name: /lookup/i })).toBeDisabled()
  })

  it('shows inline error for non-numeric input', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.blur(input)
    expect(screen.getByText(/agent id must be a number/i)).toBeInTheDocument()
  })

  it('enables lookup button when chain selected and valid numeric input', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '5' } })
    expect(screen.getByRole('button', { name: /lookup/i })).toBeEnabled()
  })

  it('navigates to /agent/[chain]/[id] on submit', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '  005  ' } })
    fireEvent.click(screen.getByRole('button', { name: /lookup/i }))
    expect(mockPush).toHaveBeenCalledWith('/agent/42220/5')
  })

  it('submits on Enter key', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockPush).toHaveBeenCalledWith('/agent/42220/5')
  })

  it('renders example agent links for all chains', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    expect(screen.getByText(/try high-trust agents/i)).toBeInTheDocument()
    const celoLink = screen.getByText(/agent #5 on celo/i)
    expect(celoLink.closest('a')).toHaveAttribute('href', '/agent/42220/5')
    const skaleLink = screen.getByText(/agent #1 on skale base/i)
    expect(skaleLink.closest('a')).toHaveAttribute('href', '/agent/1187947933/1')
  })

  it('shows supported chains badges', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    expect(screen.getByText('Supported chains')).toBeInTheDocument()
    // "Celo" appears in both the select options and the badge — use getAllByText
    expect(screen.getAllByText('Celo').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('SKALE Base').length).toBeGreaterThanOrEqual(2)
  })

  it('trims whitespace and strips leading zeros from input', () => {
    render(<ScoreLookup exampleAgents={exampleAgents} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '  0042  ' } })
    fireEvent.click(screen.getByRole('button', { name: /lookup/i }))
    expect(mockPush).toHaveBeenCalledWith('/agent/42220/42')
  })
})
