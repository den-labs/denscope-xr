import { describe, it, expect, vi } from 'vitest'
import type { GatheredEvidence } from '@/types/evaluation'

// Mock gatherEvidence — it hits Supabase
vi.mock('@/lib/evaluation/gather', () => ({
  gatherEvidence: vi.fn(),
}))

import { composeEvaluation } from '@/lib/evaluation/compose'
import { gatherEvidence } from '@/lib/evaluation/gather'

const mockGather = vi.mocked(gatherEvidence)

function makeEvidence(overrides: Partial<GatheredEvidence> = {}): GatheredEvidence {
  return {
    score: 78, scoreConfidence: 'high', positiveRatio: 0.88,
    feedbackCount: 42, positiveCount: 37, negativeCount: 5,
    openIncidents: 0, openCriticalIncidents: 0, openWarningIncidents: 0,
    hasSybilIncident: false, resolvedSybilCount: 0,
    ageDays: 120, lastActivityDays: 3, agentExists: true,
    dataAsOf: '2026-08-19T00:00:00.000Z',
    ...overrides,
  }
}

describe('composeEvaluation', () => {
  it('returns full evaluation for healthy agent', async () => {
    mockGather.mockResolvedValue(makeEvidence())
    const result = await composeEvaluation({
      chainId: 42220, agentId: 5, preset: 'default_safety',
    })
    expect(result.evaluation.trust_band).toBe('high')
    expect(result.evaluation.recommended_action).toBe('allow')
    expect(result.evaluation.preset).toBe('default_safety')
    expect(result.evaluation.chainId).toBe(42220)
    expect(result.evaluation.agentId).toBe(5)
    expect(result.evaluation.rationale).toBeTruthy()
    expect(result.evaluation.evidence.score).toBe(78)
    expect(result.evaluation.evaluatedAt).toBeTruthy()
  })

  it('returns not-found error for non-existent agent', async () => {
    mockGather.mockResolvedValue(makeEvidence({ agentExists: false }))
    await expect(
      composeEvaluation({ chainId: 42220, agentId: 999, preset: 'default_safety' }),
    ).rejects.toThrow('Agent not found')
  })

  it('defi_counterparty is stricter than default_safety for same evidence', async () => {
    const evidence = makeEvidence({ score: 65, feedbackCount: 15 })
    mockGather.mockResolvedValue(evidence)

    const safe = await composeEvaluation({ chainId: 42220, agentId: 5, preset: 'default_safety' })
    const defi = await composeEvaluation({ chainId: 42220, agentId: 5, preset: 'defi_counterparty' })

    expect(safe.evaluation.trust_band).toBe('high')
    expect(defi.evaluation.trust_band).toBe('medium')
  })

  it('includes correct evidence summary', async () => {
    mockGather.mockResolvedValue(makeEvidence())
    const result = await composeEvaluation({
      chainId: 42220, agentId: 5, preset: 'default_safety',
    })
    expect(result.evaluation.evidence).toEqual({
      score: 78,
      score_confidence: 'high',
      feedbackCount: 42,
      positiveRatio: 0.88,
      openIncidents: 0,
      lastActivityDays: 3,
      ageDays: 120,
    })
  })
})
