import { describe, it, expect } from 'vitest'
import { interpretEvidence } from '@/lib/evaluation/interpret'
import { getPreset } from '@/lib/evaluation/presets'
import type { GatheredEvidence } from '@/types/evaluation'

function makeEvidence(overrides: Partial<GatheredEvidence> = {}): GatheredEvidence {
  return {
    score: 78,
    scoreConfidence: 'high',
    positiveRatio: 0.88,
    feedbackCount: 42,
    positiveCount: 37,
    negativeCount: 5,
    openIncidents: 0,
    openCriticalIncidents: 0,
    openWarningIncidents: 0,
    hasSybilIncident: false,
    resolvedSybilCount: 0,
    ageDays: 120,
    lastActivityDays: 3,
    agentExists: true,
    dataAsOf: '2026-08-19T00:00:00.000Z',
    ...overrides,
  }
}

describe('interpretEvidence', () => {
  describe('trust_band', () => {
    it('returns high for score above high threshold', () => {
      const result = interpretEvidence(makeEvidence({ score: 78 }), getPreset('default_safety'))
      expect(result.trust_band).toBe('high')
    })

    it('returns medium for score between medium and high', () => {
      const result = interpretEvidence(makeEvidence({ score: 45 }), getPreset('default_safety'))
      expect(result.trust_band).toBe('medium')
    })

    it('returns low for score between low and medium', () => {
      const result = interpretEvidence(makeEvidence({ score: 20 }), getPreset('default_safety'))
      expect(result.trust_band).toBe('low')
    })

    it('returns insufficient_signal when below minFeedbacks', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 2, score: 50 }),
        getPreset('default_safety'),
      )
      expect(result.trust_band).toBe('insufficient_signal')
    })
  })

  describe('status', () => {
    it('returns active when recent activity', () => {
      const result = interpretEvidence(makeEvidence({ lastActivityDays: 3 }), getPreset('default_safety'))
      expect(result.status).toBe('active')
    })

    it('returns stale when past staleDays', () => {
      const result = interpretEvidence(makeEvidence({ lastActivityDays: 35 }), getPreset('default_safety'))
      expect(result.status).toBe('stale')
    })

    it('returns dormant when past dormantDays', () => {
      const result = interpretEvidence(makeEvidence({ lastActivityDays: 100 }), getPreset('default_safety'))
      expect(result.status).toBe('dormant')
    })

    it('returns anomalous when critical incidents exist', () => {
      const result = interpretEvidence(
        makeEvidence({ openCriticalIncidents: 1, lastActivityDays: 1 }),
        getPreset('default_safety'),
      )
      expect(result.status).toBe('anomalous')
    })
  })

  describe('signal_strength', () => {
    it('returns strong for 20+ feedbacks with high confidence', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 25, scoreConfidence: 'high' }),
        getPreset('default_safety'),
      )
      expect(result.signal_strength).toBe('strong')
    })

    it('returns none when below minFeedbacks', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 1, scoreConfidence: 'low' }),
        getPreset('default_safety'),
      )
      expect(result.signal_strength).toBe('none')
    })
  })

  describe('recommended_action', () => {
    it('hard gate: insufficient signal → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 2, score: 80 }),
        getPreset('default_safety'),
      )
      expect(result.recommended_action).toBe('limit')
    })

    it('hard gate: sybil critical + high risk → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ hasSybilIncident: true }),
        getPreset('defi_counterparty'),
      )
      expect(result.recommended_action).toBe('limit')
    })

    it('hard gate: defi_counterparty with any open critical incident → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ openCriticalIncidents: 1, score: 80 }),
        getPreset('defi_counterparty'),
      )
      expect(result.recommended_action).toBe('limit')
    })

    it('preset threshold: high score → allow', () => {
      const result = interpretEvidence(makeEvidence({ score: 78 }), getPreset('default_safety'))
      expect(result.recommended_action).toBe('allow')
    })

    it('preset threshold: mid score → review', () => {
      const result = interpretEvidence(makeEvidence({ score: 45 }), getPreset('default_safety'))
      expect(result.recommended_action).toBe('review')
    })

    it('preset threshold: low score → limit', () => {
      const result = interpretEvidence(makeEvidence({ score: 10 }), getPreset('default_safety'))
      expect(result.recommended_action).toBe('limit')
    })

    it('freshness modifier: dormant downgrades allow → review', () => {
      const result = interpretEvidence(
        makeEvidence({ score: 78, lastActivityDays: 100 }),
        getPreset('default_safety'),
      )
      expect(result.recommended_action).toBe('review')
    })

    it('freshness modifier: anomalous downgrades review → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ score: 45, openCriticalIncidents: 1, lastActivityDays: 1 }),
        getPreset('default_safety'),
      )
      expect(result.recommended_action).toBe('limit')
    })
  })

  describe('decision_confidence', () => {
    it('high when strong signal and consistent indicators', () => {
      const result = interpretEvidence(makeEvidence(), getPreset('default_safety'))
      expect(result.decision_confidence).toBe('high')
    })

    it('low when insufficient signal', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 1 }),
        getPreset('default_safety'),
      )
      expect(result.decision_confidence).toBe('low')
    })
  })

  describe('flags', () => {
    it('flags insufficient_signal', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 1 }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('insufficient_signal')
    })

    it('flags sybil_risk_high', () => {
      const result = interpretEvidence(
        makeEvidence({ hasSybilIncident: true }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('sybil_risk_high')
    })

    it('flags dormant', () => {
      const result = interpretEvidence(
        makeEvidence({ lastActivityDays: 100 }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('dormant')
    })

    it('flags newly_registered', () => {
      const result = interpretEvidence(
        makeEvidence({ ageDays: 3 }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('newly_registered')
    })

    it('no flags for clean agent', () => {
      const result = interpretEvidence(makeEvidence(), getPreset('default_safety'))
      expect(result.flags).toEqual([])
    })
  })

  describe('presets produce different outputs', () => {
    it('same agent gets allow in default_safety but review in defi_counterparty', () => {
      const evidence = makeEvidence({ score: 65, feedbackCount: 12 })
      const safe = interpretEvidence(evidence, getPreset('default_safety'))
      const defi = interpretEvidence(evidence, getPreset('defi_counterparty'))
      // default_safety: 65 >= allowThreshold 60 → allow
      // defi_counterparty: 65 < allowThreshold 75 but >= reviewThreshold 55 → review
      expect(safe.recommended_action).toBe('allow')
      expect(defi.recommended_action).toBe('review')
    })

    it('defi_counterparty requires higher score for high trust_band', () => {
      const evidence = makeEvidence({ score: 65, feedbackCount: 15 })
      const safe = interpretEvidence(evidence, getPreset('default_safety'))
      const defi = interpretEvidence(evidence, getPreset('defi_counterparty'))
      expect(safe.trust_band).toBe('high')
      expect(defi.trust_band).toBe('medium')
    })
  })
})
