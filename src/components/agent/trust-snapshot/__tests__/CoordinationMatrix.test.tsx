import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoordinationMatrix } from '../CoordinationMatrix'
import type { CoordinationMatrix as Matrix } from '@/lib/trust-snapshot/types'

const matrix: Matrix = {
  a2a: { state: 'connected', evidence: 'services[].type=A2A' },
  mcp: { state: 'connected', evidence: 'services[].type=MCP' },
  x402: { state: 'missing' },
  docs: { state: 'connected', evidence: 'description present' },
  health: { state: 'unknown', reason: 'Not enough activity to assess' },
  oasf: { state: 'pending', reason: 'Convention pending — not yet derivable' },
  source: { state: 'pending', reason: 'Convention pending — not yet derivable' },
  auth: { state: 'pending', reason: 'Convention pending — not yet derivable' },
}

describe('CoordinationMatrix', () => {
  it('renders all eight badges', () => {
    render(<CoordinationMatrix coordination={matrix} />)
    for (const label of ['A2A', 'MCP', 'x402', 'Docs', 'Health', 'OASF', 'Source', 'Auth']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('lives under the #coordination anchor', () => {
    const { container } = render(<CoordinationMatrix coordination={matrix} />)
    expect(container.querySelector('#coordination')).not.toBeNull()
  })

  it('renders PENDING badges with a dashed border (N7)', () => {
    render(<CoordinationMatrix coordination={matrix} />)
    const oasf = screen.getByText('OASF').closest('[data-badge]')
    expect(oasf?.className).toContain('border-dashed')
  })

  it('renders unknown (Health) as solid muted, not dashed (N7)', () => {
    render(<CoordinationMatrix coordination={matrix} />)
    const health = screen.getByText('Health').closest('[data-badge]')
    expect(health?.className).not.toContain('border-dashed')
  })

  it('shows the legend and canonicality copy', () => {
    render(<CoordinationMatrix coordination={matrix} />)
    expect(screen.getByText(/convention pending/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Dimensions interpret the score above — they do not replace it\./)
    ).toBeInTheDocument()
  })
})
