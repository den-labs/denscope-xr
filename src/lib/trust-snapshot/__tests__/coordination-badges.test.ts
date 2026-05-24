import { describe, expect, it } from 'vitest'
import type { AgentMetadata } from '@/types/agents'
import { deriveCoordinationBadges } from '../coordination-badges'

const NOW = new Date('2026-05-23T00:00:00Z').getTime()
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString()

const baseMeta: AgentMetadata = {
  name: 'Test',
  description: 'A test agent',
  services: [],
}

describe('deriveCoordinationBadges', () => {
  it('renders A2A/MCP/x402 connected when services declare them', () => {
    const meta: AgentMetadata = {
      ...baseMeta,
      services: [
        { type: 'A2A' },
        { type: 'mcp' },
        { type: 'x402' },
      ],
    }
    const badges = deriveCoordinationBadges({
      metadata: meta,
      lastSeen: daysAgo(1),
      totalEvents: 50,
      now: NOW,
    })
    expect(badges.a2a.state).toBe('connected')
    expect(badges.mcp.state).toBe('connected')
    expect(badges.x402.state).toBe('connected')
  })

  it('renders A2A/MCP/x402 missing when services do not declare them', () => {
    const badges = deriveCoordinationBadges({
      metadata: { ...baseMeta, services: [] },
      lastSeen: daysAgo(1),
      totalEvents: 50,
      now: NOW,
    })
    expect(badges.a2a.state).toBe('missing')
    expect(badges.mcp.state).toBe('missing')
    expect(badges.x402.state).toBe('missing')
  })

  it('docs connected when description present', () => {
    const badges = deriveCoordinationBadges({
      metadata: { ...baseMeta, description: 'short desc' },
      lastSeen: daysAgo(1),
      totalEvents: 50,
      now: NOW,
    })
    expect(badges.docs.state).toBe('connected')
  })

  it('docs missing when description empty', () => {
    const badges = deriveCoordinationBadges({
      metadata: { ...baseMeta, description: '' },
      lastSeen: daysAgo(1),
      totalEvents: 50,
      now: NOW,
    })
    expect(badges.docs.state).toBe('missing')
  })

  it('renders all metadata-dependent badges as missing when metadata is null (N3)', () => {
    const badges = deriveCoordinationBadges({
      metadata: null,
      lastSeen: daysAgo(1),
      totalEvents: 50,
      now: NOW,
    })
    expect(badges.a2a.state).toBe('missing')
    expect(badges.mcp.state).toBe('missing')
    expect(badges.x402.state).toBe('missing')
    expect(badges.docs.state).toBe('missing')
  })

  describe('Health tri-state (N2 fix)', () => {
    it('unknown when totalEvents < 5', () => {
      const badges = deriveCoordinationBadges({
        metadata: baseMeta,
        lastSeen: daysAgo(1),
        totalEvents: 4,
        now: NOW,
      })
      expect(badges.health.state).toBe('unknown')
    })

    it('connected when lastSeen within 7 days', () => {
      const badges = deriveCoordinationBadges({
        metadata: baseMeta,
        lastSeen: daysAgo(3),
        totalEvents: 20,
        now: NOW,
      })
      expect(badges.health.state).toBe('connected')
    })

    it('detected when lastSeen between 8 and 30 days', () => {
      const badges = deriveCoordinationBadges({
        metadata: baseMeta,
        lastSeen: daysAgo(20),
        totalEvents: 20,
        now: NOW,
      })
      expect(badges.health.state).toBe('detected')
    })

    it('detected when lastSeen between 31 and 90 days (the N2 gap)', () => {
      const badges = deriveCoordinationBadges({
        metadata: baseMeta,
        lastSeen: daysAgo(60),
        totalEvents: 20,
        now: NOW,
      })
      expect(badges.health.state).toBe('detected')
    })

    it('missing when lastSeen > 90 days', () => {
      const badges = deriveCoordinationBadges({
        metadata: baseMeta,
        lastSeen: daysAgo(120),
        totalEvents: 20,
        now: NOW,
      })
      expect(badges.health.state).toBe('missing')
    })

    it('missing when lastSeen is null but totalEvents >= 5', () => {
      const badges = deriveCoordinationBadges({
        metadata: baseMeta,
        lastSeen: null,
        totalEvents: 20,
        now: NOW,
      })
      expect(badges.health.state).toBe('missing')
    })
  })

  it('OASF, Source, Auth always render as pending (no invented detection)', () => {
    const meta: AgentMetadata = {
      ...baseMeta,
      services: [
        { type: 'A2A' },
        { type: 'MCP' },
        { type: 'x402' },
      ],
    }
    const badges = deriveCoordinationBadges({
      metadata: meta,
      lastSeen: daysAgo(1),
      totalEvents: 50,
      now: NOW,
    })
    expect(badges.oasf.state).toBe('pending')
    expect(badges.source.state).toBe('pending')
    expect(badges.auth.state).toBe('pending')
  })
})
