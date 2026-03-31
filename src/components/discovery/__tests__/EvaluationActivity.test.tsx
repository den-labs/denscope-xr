import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvaluationActivity } from '../EvaluationActivity'
import type { EvaluationLogEntry } from '@/lib/trustops/collect'

describe('EvaluationActivity', () => {
  it('renders empty state when no evaluations', () => {
    render(<EvaluationActivity evaluations={[]} />)

    expect(screen.getByText('No evaluations yet')).toBeTruthy()
    expect(screen.getByText(/POST \/api\/v1\/trust\/evaluate/)).toBeTruthy()
  })

  it('renders evaluation entries', () => {
    const evaluations: EvaluationLogEntry[] = [
      { chainId: 42220, agentId: 5, endpoint: '/api/v1/trust/evaluate', calledAt: new Date().toISOString() },
      { chainId: 1187947933, agentId: 1, endpoint: '/api/v1/trust/evaluate', calledAt: new Date().toISOString() },
    ]

    render(<EvaluationActivity evaluations={evaluations} />)

    expect(screen.getByText('Agent #5')).toBeTruthy()
    expect(screen.getByText('Agent #1')).toBeTruthy()
    expect(screen.getByText('Chain 42220')).toBeTruthy()
    expect(screen.getByText('Chain 1187947933')).toBeTruthy()
  })

  it('shows time ago for recent evaluations', () => {
    const evaluations: EvaluationLogEntry[] = [
      { chainId: 42220, agentId: 5, endpoint: '/api/v1/trust/evaluate', calledAt: new Date().toISOString() },
    ]

    render(<EvaluationActivity evaluations={evaluations} />)

    expect(screen.getByText('just now')).toBeTruthy()
  })

  it('renders section heading', () => {
    render(<EvaluationActivity evaluations={[]} />)

    expect(screen.getByText('Recent Evaluations')).toBeTruthy()
  })

  it('links to agent dossier', () => {
    const evaluations: EvaluationLogEntry[] = [
      { chainId: 42220, agentId: 5, endpoint: '/api/v1/trust/evaluate', calledAt: new Date().toISOString() },
    ]

    render(<EvaluationActivity evaluations={evaluations} />)

    const link = screen.getByText('Agent #5')
    expect(link.closest('a')?.getAttribute('href')).toBe('/agent/42220/5')
  })
})
