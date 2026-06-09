import { describe, expect, it } from 'vitest'
import type { DimensionKey, DimensionResult, OpenIncident } from '../types'
import { buildSummary, derivePrimaryWatchout } from '../summary'

const dim = (value: number): DimensionResult => ({
  value,
  rule: 'test',
  evidence: [],
  status: 'derived',
})

const radarHigh: Record<DimensionKey, DimensionResult> = {
  identity: dim(80),
  reliability: dim(80),
  reputation: dim(80),
  coordination: dim(80),
  safety: dim(80),
}

describe('derivePrimaryWatchout', () => {
  it('prioritizes open critical incident over everything', () => {
    const incidents: OpenIncident[] = [
      { id: 'i1', severity: 'critical', kind: 'sybil_cluster', openedAt: '2026-05-01' },
    ]
    const result = derivePrimaryWatchout({
      openIncidents: incidents,
      radar: { ...radarHigh, identity: dim(10) },
      confidence: 'low',
      feedbackCount: 0,
    })
    expect(result).toBe('Open critical incident (sybil_cluster)')
  })

  it('falls to warning incident when no critical exists', () => {
    const incidents: OpenIncident[] = [
      { id: 'i2', severity: 'warning', kind: 'reputation_drop', openedAt: '2026-05-01' },
    ]
    const result = derivePrimaryWatchout({
      openIncidents: incidents,
      radar: radarHigh,
      confidence: 'high',
      feedbackCount: 20,
    })
    expect(result).toBe('Open warning incident (reputation_drop)')
  })

  it('picks lowest radar dimension below 40 when no incidents', () => {
    const result = derivePrimaryWatchout({
      openIncidents: [],
      radar: { ...radarHigh, reputation: dim(25), coordination: dim(35) },
      confidence: 'high',
      feedbackCount: 20,
    })
    expect(result).toBe('Low Reputation quality score (25/100)')
  })

  it('uses canonical dimension order to break ties on equal value', () => {
    const result = derivePrimaryWatchout({
      openIncidents: [],
      radar: { ...radarHigh, identity: dim(30), reliability: dim(30) },
      confidence: 'high',
      feedbackCount: 20,
    })
    expect(result).toBe('Low Identity completeness score (30/100)')
  })

  it('flags insufficient feedback when confidence low and feedbackCount < 3', () => {
    const result = derivePrimaryWatchout({
      openIncidents: [],
      radar: radarHigh,
      confidence: 'low',
      feedbackCount: 2,
    })
    expect(result).toBe('Insufficient feedback to validate score')
  })

  it('returns null when nothing watchable exists', () => {
    const result = derivePrimaryWatchout({
      openIncidents: [],
      radar: radarHigh,
      confidence: 'high',
      feedbackCount: 10,
    })
    expect(result).toBeNull()
  })
})

describe('buildSummary', () => {
  it('ready template interpolates ageDays, feedback ratio, protocols', () => {
    expect(
      buildSummary({
        verdict: 'ready',
        score: 87,
        ageDays: 142,
        positiveCount: 18,
        feedbackCount: 21,
        connectedProtocols: 3,
        primaryWatchout: null,
      })
    ).toBe(
      'Active for 142d with 18/21 positive feedback and 3 protocols connected.'
    )
  })

  it('warming-up template handles singular feedback', () => {
    expect(
      buildSummary({
        verdict: 'warming-up',
        score: 60,
        ageDays: 14,
        positiveCount: 1,
        feedbackCount: 1,
        connectedProtocols: 1,
        primaryWatchout: null,
      })
    ).toBe('Newer agent (14d) with 1 feedback. Track record building.')
  })

  it('warming-up template handles plural feedback', () => {
    expect(
      buildSummary({
        verdict: 'warming-up',
        score: 65,
        ageDays: 30,
        positiveCount: 4,
        feedbackCount: 5,
        connectedProtocols: 2,
        primaryWatchout: null,
      })
    ).toBe('Newer agent (30d) with 5 feedbacks. Track record building.')
  })

  it('caution primary template uses primaryWatchout', () => {
    expect(
      buildSummary({
        verdict: 'caution',
        score: 35,
        ageDays: 60,
        positiveCount: 1,
        feedbackCount: 5,
        connectedProtocols: 0,
        primaryWatchout: 'Open critical incident (sybil_cluster)',
      })
    ).toBe(
      'Open critical incident (sybil_cluster). Recommend additional review before coordination.'
    )
  })

  it('caution fallback template when primaryWatchout is null (P0-4 fix)', () => {
    expect(
      buildSummary({
        verdict: 'caution',
        score: 42,
        ageDays: 60,
        positiveCount: 2,
        feedbackCount: 5,
        connectedProtocols: 1,
        primaryWatchout: null,
      })
    ).toBe('Trust score 42/100. Review evidence before coordination.')
  })

  it('caution fallback handles null score gracefully', () => {
    expect(
      buildSummary({
        verdict: 'caution',
        score: null,
        ageDays: 1,
        positiveCount: 0,
        feedbackCount: 0,
        connectedProtocols: 0,
        primaryWatchout: null,
      })
    ).toBe('Trust score —/100. Review evidence before coordination.')
  })

  it('insufficient-data template', () => {
    expect(
      buildSummary({
        verdict: 'insufficient-data',
        score: null,
        ageDays: 3,
        positiveCount: 0,
        feedbackCount: 0,
        connectedProtocols: 0,
        primaryWatchout: null,
      })
    ).toBe('Agent registered 3d ago. No feedback yet — too early to score.')
  })
})
