import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskOverview } from '../RiskOverview'
import type { TrustOpsOverview } from '@/lib/trustops/collect'

function makeOverview(overrides: Partial<TrustOpsOverview> = {}): TrustOpsOverview {
  return {
    totalAgents: 10,
    trustBands: { high: 5, medium: 3, low: 1, insufficient: 1 },
    elevatedRiskCount: 2,
    criticalRiskCount: 1,
    openIncidents: 3,
    recentEvaluations: [],
    collectedAt: '2026-03-31T10:00:00Z',
    ...overrides,
  }
}

describe('RiskOverview', () => {
  it('renders trust band distribution', () => {
    render(<RiskOverview overview={makeOverview()} />)

    expect(screen.getByText('High Trust')).toBeTruthy()
    expect(screen.getByText('Medium Trust')).toBeTruthy()
    expect(screen.getByText('Low Trust')).toBeTruthy()
    expect(screen.getByText('Insufficient')).toBeTruthy()
  })

  it('renders band counts', () => {
    render(<RiskOverview overview={makeOverview()} />)

    // High trust count = 5, medium trust count = 3
    // Use getAllByText since numbers may appear in multiple contexts
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
  })

  it('renders stat cards', () => {
    render(<RiskOverview overview={makeOverview()} />)

    expect(screen.getByText('Total Agents')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('Open Incidents')).toBeTruthy()
    expect(screen.getByText('Elevated Risk')).toBeTruthy()
    expect(screen.getByText('Critical Risk')).toBeTruthy()
  })

  it('renders percentage for bands', () => {
    render(<RiskOverview overview={makeOverview()} />)

    // 5/10 = 50%
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('handles zero total agents', () => {
    const overview = makeOverview({
      totalAgents: 0,
      trustBands: { high: 0, medium: 0, low: 0, insufficient: 0 },
      openIncidents: 0,
      elevatedRiskCount: 0,
      criticalRiskCount: 0,
    })
    render(<RiskOverview overview={overview} />)

    // All percentages should be 0%
    const zeros = screen.getAllByText('0%')
    expect(zeros.length).toBe(4)
  })
})
