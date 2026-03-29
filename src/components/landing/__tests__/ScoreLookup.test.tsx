import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScoreLookup } from '../ScoreLookup'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('ScoreLookup', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders chain select, agent input, and lookup button', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/agent id/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /lookup/i })).toBeInTheDocument()
  })

  it('disables lookup button when input is empty', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    expect(screen.getByRole('button', { name: /lookup/i })).toBeDisabled()
  })

  it('disables lookup button when input is non-numeric', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(screen.getByRole('button', { name: /lookup/i })).toBeDisabled()
  })

  it('shows inline error for non-numeric input', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.blur(input)
    expect(screen.getByText(/agent id must be a number/i)).toBeInTheDocument()
  })

  it('enables lookup button when chain selected and valid numeric input', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '5' } })
    expect(screen.getByRole('button', { name: /lookup/i })).toBeEnabled()
  })

  it('navigates to /agent/[chain]/[id] on submit', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '  005  ' } })
    fireEvent.click(screen.getByRole('button', { name: /lookup/i }))
    expect(mockPush).toHaveBeenCalledWith('/agent/42220/5')
  })

  it('submits on Enter key', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockPush).toHaveBeenCalledWith('/agent/42220/5')
  })

  it('renders example agent link', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    const link = screen.getByText(/try it/i).closest('a') ?? screen.getByRole('link', { name: /try it/i })
    expect(link).toHaveAttribute('href', '/agent/42220/5')
  })

  it('trims whitespace and strips leading zeros from input', () => {
    render(<ScoreLookup exampleChain={42220} exampleAgentId={5} />)
    const select = screen.getByRole('combobox')
    const input = screen.getByPlaceholderText(/agent id/i)
    fireEvent.change(select, { target: { value: '42220' } })
    fireEvent.change(input, { target: { value: '  0042  ' } })
    fireEvent.click(screen.getByRole('button', { name: /lookup/i }))
    expect(mockPush).toHaveBeenCalledWith('/agent/42220/42')
  })
})
