import { describe, it, expect } from 'vitest'
import { generateRationale } from '@/lib/evaluation/rationale'
import type { GatheredEvidence, InterpretationResult } from '@/types/evaluation'

function makeEvidence(overrides: Partial<GatheredEvidence> = {}): GatheredEvidence {
  return {
    score: 78, scoreConfidence: 'high', positiveRatio: 0.88,
    feedbackCount: 42, positiveCount: 37, negativeCount: 5,
    openIncidents: 0, openCriticalIncidents: 0, openWarningIncidents: 0,
    hasSybilIncident: false, resolvedSybilCount: 0,
    ageDays: 120, lastActivityDays: 3, agentExists: true,
    ...overrides,
  }
}

function makeInterpretation(overrides: Partial<InterpretationResult> = {}): InterpretationResult {
  return {
    trust_band: 'high', status: 'active', signal_strength: 'strong',
    risk_level: 'minimal', decision_confidence: 'high',
    recommended_action: 'allow', flags: [],
    ...overrides,
  }
}

describe('generateRationale', () => {
  it('generates rationale for high-trust agent', () => {
    const rationale = generateRationale(makeEvidence(), makeInterpretation())
    expect(rationale).toContain('78/100')
    expect(rationale).toContain('42 feedbacks')
    expect(rationale).toContain('88%')
    expect(rationale).toContain('allow')
  })

  it('generates rationale for insufficient signal', () => {
    const rationale = generateRationale(
      makeEvidence({ feedbackCount: 2 }),
      makeInterpretation({
        trust_band: 'insufficient_signal',
        recommended_action: 'limit',
        flags: ['insufficient_signal'],
      }),
    )
    expect(rationale).toContain('insufficient')
    expect(rationale).toContain('limit')
  })

  it('mentions open incidents when present', () => {
    const rationale = generateRationale(
      makeEvidence({ openIncidents: 2, openCriticalIncidents: 1 }),
      makeInterpretation({ risk_level: 'critical', flags: ['incident_open_critical'] }),
    )
    expect(rationale).toContain('incident')
  })

  it('mentions dormant status', () => {
    const rationale = generateRationale(
      makeEvidence({ lastActivityDays: 100 }),
      makeInterpretation({ status: 'dormant', flags: ['dormant'] }),
    )
    expect(rationale).toContain('dormant')
  })
})
