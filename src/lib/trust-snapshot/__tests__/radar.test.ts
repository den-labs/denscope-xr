import { describe, expect, it } from 'vitest'
import type { AgentMetadata } from '@/types/agents'
import type { TrustScore } from '@/types/trust-score'
import type {
  BadgeKey,
  BadgeState,
  CoordinationMatrix,
  OpenIncident,
} from '../types'
import {
  deriveCoordinationDim,
  deriveIdentityDim,
  deriveReliabilityDim,
  deriveReputationDim,
  deriveSafetyDim,
  type RadarInput,
} from '../radar'

const baseMeta: AgentMetadata = {
  name: 'Test',
  description: 'Agent description',
  image: 'ipfs://image',
  services: [{ type: 'A2A' }, { type: 'MCP' }, { type: 'x402' }],
}

const baseScore: TrustScore = {
  chainId: 42220,
  agentId: 1,
  score: 80,
  positiveRatio: 0.85,
  activityScore: 0.7,
  ageScore: 0.9,
  incidentPenalty: 0,
  feedbackCount: 20,
  positiveCount: 17,
  negativeCount: 3,
  openIncidents: 0,
  confidence: 'high',
  updatedAt: '2026-05-23T00:00:00Z',
}

const allConnectedBadges = (): CoordinationMatrix => {
  const connected: BadgeState = { state: 'connected', evidence: 'test' }
  const pending: BadgeState = { state: 'pending', reason: 'test' }
  const keys: BadgeKey[] = ['a2a', 'mcp', 'x402', 'docs', 'health']
  const matrix = {
    oasf: pending,
    source: pending,
    auth: pending,
  } as CoordinationMatrix
  for (const k of keys) (matrix as Record<BadgeKey, BadgeState>)[k] = connected
  return matrix
}

const emptyBadges = (): CoordinationMatrix => {
  const missing: BadgeState = { state: 'missing' }
  const pending: BadgeState = { state: 'pending', reason: 'test' }
  return {
    a2a: missing,
    mcp: missing,
    x402: missing,
    docs: missing,
    health: missing,
    oasf: pending,
    source: pending,
    auth: pending,
  }
}

const baseInput: RadarInput = {
  trustScore: baseScore,
  metadata: baseMeta,
  uriPresent: true,
  ownerResolved: true,
  claimed: true,
  feedbackCount: 20,
  totalEvents: 100,
  uriUpdateCount: 0,
  ageDays: 142,
  recentEventCount: 30,
  validationEventCount: 3,
  openIncidents: [],
  hasSybilHistory: false,
  hasRecentReputationDrop: false,
  coordinationBadges: allConnectedBadges(),
}

describe('deriveIdentityDim', () => {
  it('returns 100 when all 7 components are satisfied', () => {
    expect(deriveIdentityDim(baseInput).value).toBe(100)
  })

  it('returns 0 when nothing is satisfied', () => {
    const r = deriveIdentityDim({
      ...baseInput,
      metadata: null,
      uriPresent: false,
      ownerResolved: false,
      claimed: false,
    })
    expect(r.value).toBe(0)
  })

  it('partial: only URI + resolves + name+desc → 50', () => {
    const r = deriveIdentityDim({
      ...baseInput,
      metadata: { name: 'X', description: 'Y', services: [] },
      uriPresent: true,
      ownerResolved: false,
      claimed: false,
    })
    expect(r.value).toBe(50) // 20 + 15 + 15
  })

  it('handles null metadata as missing URI-resolves', () => {
    const r = deriveIdentityDim({
      ...baseInput,
      metadata: null,
      uriPresent: true,
      ownerResolved: true,
      claimed: false,
    })
    // 20 (uri) + 10 (owner) = 30
    expect(r.value).toBe(30)
  })
})

describe('deriveReliabilityDim', () => {
  it('returns ≤ 100 for ideal inputs', () => {
    expect(deriveReliabilityDim(baseInput).value).toBe(100)
  })

  it('returns 0 for brand-new agent with no events and no validation', () => {
    const r = deriveReliabilityDim({
      ...baseInput,
      ageDays: 0,
      uriUpdateCount: 0,
      recentEventCount: 0,
      validationEventCount: 0,
    })
    // age=0, stability=25 (no updates), recency=0, validation=0 → 25
    expect(r.value).toBe(25)
  })

  it('penalizes URI churn', () => {
    const r = deriveReliabilityDim({ ...baseInput, uriUpdateCount: 10 })
    // stability = 0
    expect(r.value).toBeLessThan(100)
  })

  it('clamps to 0-100 range', () => {
    const r = deriveReliabilityDim({
      ...baseInput,
      ageDays: 1000,
      uriUpdateCount: 0,
      recentEventCount: 100,
      validationEventCount: 100,
    })
    expect(r.value).toBeGreaterThanOrEqual(0)
    expect(r.value).toBeLessThanOrEqual(100)
  })
})

describe('deriveReputationDim', () => {
  it('returns 100 with perfect ratio + ample feedback + high confidence', () => {
    const r = deriveReputationDim({
      ...baseInput,
      trustScore: { ...baseScore, positiveRatio: 1.0, confidence: 'high' },
      feedbackCount: 20,
    })
    // 60 + 25 + 15 = 100
    expect(r.value).toBe(100)
  })

  it('returns 0-status unavailable when no trustScore', () => {
    const r = deriveReputationDim({ ...baseInput, trustScore: null })
    expect(r.value).toBe(0)
    expect(r.status).toBe('unavailable')
  })

  it('penalizes low feedback volume', () => {
    const r = deriveReputationDim({
      ...baseInput,
      trustScore: { ...baseScore, positiveRatio: 1.0, confidence: 'low' },
      feedbackCount: 2,
    })
    // 60 + 5 + 0 = 65
    expect(r.value).toBe(65)
  })
})

describe('deriveCoordinationDim', () => {
  it('returns 100 when all 5 derivable badges connected', () => {
    expect(deriveCoordinationDim(baseInput).value).toBe(100)
  })

  it('returns 0 when none connected', () => {
    expect(
      deriveCoordinationDim({ ...baseInput, coordinationBadges: emptyBadges() })
    ).toMatchObject({ value: 0 })
  })

  it('A2A only = 25', () => {
    const badges = emptyBadges()
    badges.a2a = { state: 'connected', evidence: 'A2A' }
    expect(
      deriveCoordinationDim({ ...baseInput, coordinationBadges: badges }).value
    ).toBe(25)
  })

  it('badge in pending state does not count', () => {
    const badges = emptyBadges()
    badges.oasf = { state: 'pending', reason: 'no convention' }
    expect(
      deriveCoordinationDim({ ...baseInput, coordinationBadges: badges }).value
    ).toBe(0)
  })
})

describe('deriveSafetyDim', () => {
  it('returns 100 when no incidents or sybil history', () => {
    expect(deriveSafetyDim(baseInput).value).toBe(100)
  })

  it('subtracts 40 per critical incident, capped at 80', () => {
    const incidents: OpenIncident[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      severity: 'critical' as const,
      kind: 'sybil',
      openedAt: '2026-05-01',
    }))
    const r = deriveSafetyDim({ ...baseInput, openIncidents: incidents })
    expect(r.value).toBe(20) // 100 - 80 (cap)
  })

  it('subtracts 15 per warning incident, capped at 45', () => {
    const incidents: OpenIncident[] = Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`,
      severity: 'warning' as const,
      kind: 'drop',
      openedAt: '2026-05-01',
    }))
    const r = deriveSafetyDim({ ...baseInput, openIncidents: incidents })
    expect(r.value).toBe(55) // 100 - 45 (cap)
  })

  it('penalty for sybil history and recent reputation drop combine', () => {
    const r = deriveSafetyDim({
      ...baseInput,
      hasSybilHistory: true,
      hasRecentReputationDrop: true,
    })
    expect(r.value).toBe(55) // 100 - 20 - 25
  })

  it('clamps to 0 when penalties exceed 100', () => {
    const incidents: OpenIncident[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        severity: 'critical' as const,
        kind: 'sybil',
        openedAt: '2026-05-01',
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `w${i}`,
        severity: 'warning' as const,
        kind: 'drop',
        openedAt: '2026-05-01',
      })),
    ]
    const r = deriveSafetyDim({
      ...baseInput,
      openIncidents: incidents,
      hasSybilHistory: true,
      hasRecentReputationDrop: true,
    })
    // 100 - 80 - 45 - 20 - 25 = -70 → clamped to 0
    expect(r.value).toBe(0)
  })
})
