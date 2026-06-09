import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StrengthsWatchouts } from '../StrengthsWatchouts'

describe('StrengthsWatchouts', () => {
  it('renders both columns when populated', () => {
    render(
      <StrengthsWatchouts
        strengths={['Strong Reputation quality (89/100)']}
        watchouts={['Open warning incident: feedback_spike']}
      />
    )
    expect(screen.getByText('Strengths')).toBeInTheDocument()
    expect(screen.getByText('Watchouts')).toBeInTheDocument()
    expect(screen.getByText(/Strong Reputation quality/)).toBeInTheDocument()
    expect(screen.getByText(/Open warning incident/)).toBeInTheDocument()
  })

  it('hides the strengths container when empty (P1-1)', () => {
    render(<StrengthsWatchouts strengths={[]} watchouts={['Low Safety / integrity (20/100)']} />)
    expect(screen.queryByText('Strengths')).not.toBeInTheDocument()
    expect(screen.getByText('Watchouts')).toBeInTheDocument()
  })

  it('hides the watchouts container when empty (P1-1)', () => {
    render(<StrengthsWatchouts strengths={['Strong Identity completeness (92/100)']} watchouts={[]} />)
    expect(screen.getByText('Strengths')).toBeInTheDocument()
    expect(screen.queryByText('Watchouts')).not.toBeInTheDocument()
  })

  it('renders nothing when both are empty', () => {
    const { container } = render(<StrengthsWatchouts strengths={[]} watchouts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
