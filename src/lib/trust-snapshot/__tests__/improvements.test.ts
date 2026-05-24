import { describe, expect, it } from 'vitest'
import type {
  BadgeKey,
  BadgeState,
  CoordinationMatrix,
  DimensionKey,
  DimensionResult,
  OpenIncident,
} from '../types'
import { suggestImprovements, type ImprovementInput } from '../improvements'

const dim = (value: number): DimensionResult => ({
  value,
  rule: 't',
  evidence: [],
  status: 'derived',
})

const radarHigh: Record<DimensionKey, DimensionResult> = {
  identity: dim(90),
  reliability: dim(90),
  reputation: dim(90),
  coordination: dim(90),
  safety: dim(90),
}

const connectedBadges = (): CoordinationMatrix => {
  const conn: BadgeState = { state: 'connected', evidence: 't' }
  const pending: BadgeState = { state: 'pending', reason: 't' }
  const keys: BadgeKey[] = ['a2a', 'mcp', 'x402', 'docs', 'health']
  const m: Partial<CoordinationMatrix> = { oasf: pending, source: pending, auth: pending }
  for (const k of keys) (m as Record<BadgeKey, BadgeState>)[k] = conn
  return m as CoordinationMatrix
}

const emptyBadges = (): CoordinationMatrix => {
  const missing: BadgeState = { state: 'missing' }
  const pending: BadgeState = { state: 'pending', reason: 't' }
  return {
    a2a: missing, mcp: missing, x402: missing, docs: missing, health: missing,
    oasf: pending, source: pending, auth: pending,
  }
}

const baseInput: ImprovementInput = {
  radar: radarHigh,
  coordinationBadges: connectedBadges(),
  metadata: { name: 'Test', description: 'desc', services: [] },
  claimed: true,
  openIncidents: [],
  feedbackCount: 20,
}

describe('suggestImprovements', () => {
  it('returns empty list when everything is healthy', () => {
    expect(suggestImprovements(baseInput)).toEqual([])
  })

  it('emits P1 for open critical incident with id reference (P1-2 fix)', () => {
    const incident: OpenIncident = {
      id: 'abc-123',
      severity: 'critical',
      kind: 'sybil_cluster',
      openedAt: '2026-05-01',
    }
    const out = suggestImprovements({
      ...baseInput,
      openIncidents: [incident],
    })
    expect(out).toHaveLength(1)
    expect(out[0].priority).toBe('P1')
    expect(out[0].affectsDimension).toBe('safety')
    expect(out[0].body).toContain('abc-123')
  })

  it('emits P1 to claim when identity weak and unclaimed', () => {
    const out = suggestImprovements({
      ...baseInput,
      radar: { ...radarHigh, identity: dim(50) },
      claimed: false,
    })
    const claim = out.find((s) => s.title.toLowerCase().includes('claim'))
    expect(claim?.priority).toBe('P1')
  })

  it('emits P2 for missing A2A and MCP', () => {
    const out = suggestImprovements({
      ...baseInput,
      coordinationBadges: emptyBadges(),
    })
    expect(out.some((s) => s.title.includes('A2A'))).toBe(true)
    expect(out.some((s) => s.title.includes('MCP'))).toBe(true)
  })

  it('emits P3 for low feedback', () => {
    const out = suggestImprovements({ ...baseInput, feedbackCount: 2 })
    expect(out).toHaveLength(1)
    expect(out[0].priority).toBe('P3')
  })

  it('sorts by priority P1 → P2 → P3', () => {
    const out = suggestImprovements({
      ...baseInput,
      radar: { ...radarHigh, identity: dim(40) },
      claimed: false,
      coordinationBadges: emptyBadges(),
      feedbackCount: 1,
    })
    const priorities = out.map((s) => s.priority)
    expect(priorities).toEqual([...priorities].sort((a, b) =>
      a.localeCompare(b)
    ))
  })

  it('emits P1 add-name when identity weak and name missing', () => {
    const out = suggestImprovements({
      ...baseInput,
      radar: { ...radarHigh, identity: dim(40) },
      metadata: { name: '', description: '', services: [] },
      claimed: true,
    })
    expect(out.some((s) => s.title.includes('human-readable name'))).toBe(true)
  })
})
