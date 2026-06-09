import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImprovementList } from '../ImprovementList'
import type { ImprovementSuggestion } from '@/lib/trust-snapshot/types'

const make = (n: number): ImprovementSuggestion[] =>
  Array.from({ length: n }, (_, i) => ({
    priority: i === 0 ? 'P1' : i < 3 ? 'P2' : 'P3',
    title: `Improvement ${i + 1}`,
    body: `Body ${i + 1}`,
    affectsDimension: 'identity' as const,
  }))

describe('ImprovementList', () => {
  it('renders nothing when there are no suggestions', () => {
    const { container } = render(<ImprovementList improvements={[]} claimed={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('expands by default for non-claimed agents (M-3)', () => {
    render(<ImprovementList improvements={make(2)} claimed={false} />)
    expect(screen.getByText('Improvement 1')).toBeInTheDocument()
    expect(screen.getByText('Improvement 2')).toBeInTheDocument()
  })

  it('is collapsed by default for claimed agents and toggles open', () => {
    render(<ImprovementList improvements={make(2)} claimed />)
    expect(screen.queryByText('Improvement 1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /suggestion/i }))
    expect(screen.getByText('Improvement 1')).toBeInTheDocument()
  })

  it('caps visible suggestions at 5 and reveals the rest via Show all', () => {
    render(<ImprovementList improvements={make(7)} claimed={false} />)
    expect(screen.getByText('Improvement 5')).toBeInTheDocument()
    expect(screen.queryByText('Improvement 6')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show all/i }))
    expect(screen.getByText('Improvement 6')).toBeInTheDocument()
    expect(screen.getByText('Improvement 7')).toBeInTheDocument()
  })
})
