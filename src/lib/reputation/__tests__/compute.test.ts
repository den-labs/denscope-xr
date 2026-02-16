import { describe, it, expect } from 'vitest'
import { computeTrustScore } from '@/lib/reputation/compute'

describe('computeTrustScore', () => {
  it('returns score 0 with low confidence for no feedback', () => {
    const result = computeTrustScore({
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      firstSeen: null,
      lastSeen: null,
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(result.score).toBe(0)
    expect(result.confidence).toBe('low')
  })

  it('returns high score for all-positive agent', () => {
    const result = computeTrustScore({
      feedbackCount: 20,
      positiveCount: 20,
      negativeCount: 0,
      firstSeen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.confidence).toBe('high')
  })

  it('penalizes negative feedback', () => {
    const good = computeTrustScore({
      feedbackCount: 10, positiveCount: 10, negativeCount: 0,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    const bad = computeTrustScore({
      feedbackCount: 10, positiveCount: 3, negativeCount: 7,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    expect(good.score).toBeGreaterThan(bad.score)
  })

  it('penalizes open critical incidents', () => {
    const clean = computeTrustScore({
      feedbackCount: 10, positiveCount: 8, negativeCount: 2,
      firstSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    const flagged = computeTrustScore({
      feedbackCount: 10, positiveCount: 8, negativeCount: 2,
      firstSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 2, openWarningIncidents: 0, hasSybilIncident: false,
    })
    expect(clean.score).toBeGreaterThan(flagged.score)
  })

  it('applies sybil penalty', () => {
    const normal = computeTrustScore({
      feedbackCount: 10, positiveCount: 9, negativeCount: 1,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    const sybil = computeTrustScore({
      feedbackCount: 10, positiveCount: 9, negativeCount: 1,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: true,
    })
    expect(normal.score).toBeGreaterThan(sybil.score)
  })

  it('returns medium confidence for 3-9 feedbacks', () => {
    const result = computeTrustScore({
      feedbackCount: 5, positiveCount: 4, negativeCount: 1,
      firstSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    expect(result.confidence).toBe('medium')
  })

  it('returns high confidence for 10+ feedbacks', () => {
    const result = computeTrustScore({
      feedbackCount: 15, positiveCount: 12, negativeCount: 3,
      firstSeen: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    expect(result.confidence).toBe('high')
  })

  it('clamps score between 0 and 100', () => {
    const result = computeTrustScore({
      feedbackCount: 5, positiveCount: 0, negativeCount: 5,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 5, openWarningIncidents: 5, hasSybilIncident: true,
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('rewards agent age up to 90 days', () => {
    const young = computeTrustScore({
      feedbackCount: 10, positiveCount: 10, negativeCount: 0,
      firstSeen: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    const old = computeTrustScore({
      feedbackCount: 10, positiveCount: 10, negativeCount: 0,
      firstSeen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0, openWarningIncidents: 0, hasSybilIncident: false,
    })
    expect(old.score).toBeGreaterThan(young.score)
  })
})
