import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectTrustOpsOverview } from '../collect'

const mockSelect = vi.fn()

vi.mock('@/lib/supabase/admin', () => {
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  return { supabaseAdmin: { from: mockFrom } }
})

function chainable(data: unknown, count?: number) {
  const obj: Record<string, unknown> = {
    eq: () => obj,
    is: () => obj,
    like: () => obj,
    order: () => obj,
    limit: () => obj,
    then: (resolve: (v: unknown) => void) => resolve({ data, count }),
  }
  // Make it thenable for await
  return obj
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('collectTrustOpsOverview', () => {
  it('returns overview with trust band distribution', async () => {
    // Mock 4 Supabase queries
    mockSelect
      .mockReturnValueOnce(chainable(null, 10)) // agents count
      .mockReturnValueOnce(chainable([
        { score: 75, feedback_count: 20, confidence: 'high' },
        { score: 45, feedback_count: 8, confidence: 'medium' },
        { score: 20, feedback_count: 5, confidence: 'low' },
        { score: 50, feedback_count: 1, confidence: 'low' },
      ])) // trust_scores
      .mockReturnValueOnce(chainable([
        { id: 1, severity: 'critical' },
        { id: 2, severity: 'warning' },
      ], 2)) // incidents
      .mockReturnValueOnce(chainable([])) // api_usage_log

    const result = await collectTrustOpsOverview()

    expect(result.totalAgents).toBe(10)
    expect(result.trustBands.high).toBe(1)
    expect(result.trustBands.medium).toBe(1)
    expect(result.trustBands.low).toBe(1)
    expect(result.trustBands.insufficient).toBe(1)
    expect(result.openIncidents).toBe(2)
    expect(result.criticalRiskCount).toBe(1)
    expect(result.elevatedRiskCount).toBe(1)
    expect(result.recentEvaluations).toEqual([])
    expect(result.collectedAt).toBeTruthy()
  })

  it('handles empty database', async () => {
    mockSelect
      .mockReturnValueOnce(chainable(null, 0))
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(chainable([], 0))
      .mockReturnValueOnce(chainable([]))

    const result = await collectTrustOpsOverview()

    expect(result.totalAgents).toBe(0)
    expect(result.trustBands).toEqual({ high: 0, medium: 0, low: 0, insufficient: 0 })
    expect(result.openIncidents).toBe(0)
    expect(result.recentEvaluations).toEqual([])
  })

  it('maps evaluation log entries', async () => {
    mockSelect
      .mockReturnValueOnce(chainable(null, 5))
      .mockReturnValueOnce(chainable([]))
      .mockReturnValueOnce(chainable([], 0))
      .mockReturnValueOnce(chainable([
        { chain_id: 42220, agent_id: 5, endpoint: '/api/v1/trust/evaluate', called_at: '2026-03-31T10:00:00Z' },
        { chain_id: 1187947933, agent_id: 1, endpoint: '/api/v1/trust/evaluate', called_at: '2026-03-31T09:00:00Z' },
      ]))

    const result = await collectTrustOpsOverview()

    expect(result.recentEvaluations).toHaveLength(2)
    expect(result.recentEvaluations[0]).toEqual({
      chainId: 42220,
      agentId: 5,
      endpoint: '/api/v1/trust/evaluate',
      calledAt: '2026-03-31T10:00:00Z',
    })
  })

  it('classifies high trust correctly at threshold boundary', async () => {
    mockSelect
      .mockReturnValueOnce(chainable(null, 2))
      .mockReturnValueOnce(chainable([
        { score: 60, feedback_count: 10, confidence: 'high' },
        { score: 59, feedback_count: 10, confidence: 'medium' },
      ]))
      .mockReturnValueOnce(chainable([], 0))
      .mockReturnValueOnce(chainable([]))

    const result = await collectTrustOpsOverview()

    expect(result.trustBands.high).toBe(1)
    expect(result.trustBands.medium).toBe(1)
  })
})
