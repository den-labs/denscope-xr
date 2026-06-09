import { describe, expect, it } from 'vitest'
import type { AgentMetadata } from '@/types/agents'
import type { TrustScore } from '@/types/trust-score'
import { buildTrustSnapshot, type TrustSnapshotInputs } from '../build'

const NOW = new Date('2026-05-23T00:00:00Z').getTime()
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString()

const toppaMeta: AgentMetadata = {
  name: 'Toppa',
  description: 'Coordination-oriented agent',
  image: 'ipfs://toppa',
  services: [{ type: 'A2A' }, { type: 'MCP' }, { type: 'x402' }],
}

const toppaScore: TrustScore = {
  chainId: 42220,
  agentId: 1870,
  score: 87,
  positiveRatio: 0.85,
  activityScore: 0.7,
  ageScore: 0.9,
  incidentPenalty: 0,
  feedbackCount: 21,
  positiveCount: 18,
  negativeCount: 3,
  openIncidents: 0,
  confidence: 'high',
  updatedAt: '2026-05-23T00:00:00Z',
}

const toppaInputs: TrustSnapshotInputs = {
  trustScore: toppaScore,
  metadata: toppaMeta,
  uriPresent: true,
  ownerResolved: true,
  claimed: true,
  firstSeen: daysAgo(142),
  lastSeen: daysAgo(1),
  totalEvents: 250,
  uriUpdateCount: 1,
  feedbackCount: 21,
  positiveCount: 18,
  recentEventCount: 30,
  validationEventCount: 3,
  openIncidents: [],
  hasSybilHistory: false,
  hasRecentReputationDrop: false,
  now: NOW,
}

describe('buildTrustSnapshot — Toppa golden fixture', () => {
  const snapshot = buildTrustSnapshot(toppaInputs)

  it('verdict ready with high confidence', () => {
    expect(snapshot.verdict).toBe('ready')
    expect(snapshot.confidence).toBe('high')
  })

  it('summary uses ready template with real interpolations', () => {
    expect(snapshot.summary).toBe(
      'Active for 142d with 18/21 positive feedback and 3 protocols connected.'
    )
  })

  it('recommended action is primary "Pair on coordinated task"', () => {
    expect(snapshot.recommendedAction.label).toBe('Pair on coordinated task')
    expect(snapshot.recommendedAction.intent).toBe('primary')
  })

  it('all 5 radar dimensions exist and clamp to [0,100]', () => {
    for (const key of ['identity', 'reliability', 'reputation', 'coordination', 'safety'] as const) {
      const v = snapshot.radar[key].value
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('coordination matrix shows 5 derivable connected + 3 PENDING', () => {
    expect(snapshot.coordination.a2a.state).toBe('connected')
    expect(snapshot.coordination.mcp.state).toBe('connected')
    expect(snapshot.coordination.x402.state).toBe('connected')
    expect(snapshot.coordination.docs.state).toBe('connected')
    expect(snapshot.coordination.health.state).toBe('connected')
    expect(snapshot.coordination.oasf.state).toBe('pending')
    expect(snapshot.coordination.source.state).toBe('pending')
    expect(snapshot.coordination.auth.state).toBe('pending')
  })

  it('emits strengths but no watchouts', () => {
    expect(snapshot.strengths.length).toBeGreaterThan(0)
    expect(snapshot.watchouts).toHaveLength(0)
  })

  it('improvements list is empty for a healthy agent', () => {
    expect(snapshot.improvements).toEqual([])
  })
})

describe('buildTrustSnapshot — insufficient-data path', () => {
  const empty = buildTrustSnapshot({
    trustScore: null,
    metadata: null,
    uriPresent: false,
    ownerResolved: false,
    claimed: false,
    firstSeen: daysAgo(2),
    lastSeen: null,
    totalEvents: 0,
    uriUpdateCount: 0,
    feedbackCount: 0,
    positiveCount: 0,
    recentEventCount: 0,
    validationEventCount: 0,
    openIncidents: [],
    hasSybilHistory: false,
    hasRecentReputationDrop: false,
    now: NOW,
  })

  it('verdict is insufficient-data and score null', () => {
    expect(empty.verdict).toBe('insufficient-data')
    expect(empty.score).toBeNull()
  })

  it('summary uses insufficient-data template with real ageDays', () => {
    expect(empty.summary).toBe(
      'Agent registered 2d ago. No feedback yet — too early to score.'
    )
  })

  it('all metadata-dependent badges render as missing (N3)', () => {
    expect(empty.coordination.a2a.state).toBe('missing')
    expect(empty.coordination.docs.state).toBe('missing')
  })

  it('health badge is unknown when totalEvents < 5', () => {
    expect(empty.coordination.health.state).toBe('unknown')
  })
})

describe('buildTrustSnapshot — safety override (N1)', () => {
  it('verdict = caution when critical incident exists, even with null score', () => {
    const snap = buildTrustSnapshot({
      ...toppaInputs,
      trustScore: null,
      openIncidents: [
        { id: 'inc-1', severity: 'critical', kind: 'sybil_cluster', openedAt: daysAgo(1) },
      ],
    })
    expect(snap.verdict).toBe('caution')
  })

  it('improvements list a P1 to resolve open critical incident', () => {
    const snap = buildTrustSnapshot({
      ...toppaInputs,
      openIncidents: [
        { id: 'inc-2', severity: 'critical', kind: 'sybil_cluster', openedAt: daysAgo(1) },
      ],
    })
    expect(snap.improvements[0]?.priority).toBe('P1')
    expect(snap.improvements[0]?.affectsDimension).toBe('safety')
  })
})
