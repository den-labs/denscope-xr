import { describe, it, expect } from 'vitest'
import { eventsFromEdges } from '@/lib/firehose/fromEdges'
import type { TrustEdge } from '@/types/graph'

const CELO = 42220
const SKALE = 1187947933

function makeFeedbackEdge(chainId: number, agentId: number, from: string, value = 1): TrustEdge {
  return {
    source: `${chainId}:${from}`,
    target: `${chainId}:${agentId}`,
    kind: 'feedback',
    value,
    timestamp: 1_700_000_000,
  }
}

const mixedEdges: TrustEdge[] = [
  makeFeedbackEdge(CELO, 1, '0xaaa'),
  makeFeedbackEdge(CELO, 2, '0xbbb', -1),
  makeFeedbackEdge(SKALE, 10, '0xccc'),
  makeFeedbackEdge(SKALE, 11, '0xddd', -1),
]

const nowMs = 1_700_000_000_000

describe('eventsFromEdges chain filtering', () => {
  it('returns only SKALE edges when chainId = SKALE', () => {
    const events = eventsFromEdges(mixedEdges, SKALE, nowMs)

    expect(events).toHaveLength(2)
    expect(events.every((e) => e.chainId === SKALE)).toBe(true)
    expect(events.map((e) => e.targetId)).toEqual([
      `${SKALE}:10`,
      `${SKALE}:11`,
    ])
  })

  it('returns only Celo edges when chainId = Celo', () => {
    const events = eventsFromEdges(mixedEdges, CELO, nowMs)

    expect(events).toHaveLength(2)
    expect(events.every((e) => e.chainId === CELO)).toBe(true)
  })

  it('returns all edges when chainId = null (no filter)', () => {
    const events = eventsFromEdges(mixedEdges, null, nowMs)

    expect(events).toHaveLength(4)
    const chainIds = new Set(events.map((e) => e.chainId))
    expect(chainIds.has(CELO)).toBe(true)
    expect(chainIds.has(SKALE)).toBe(true)
  })

  it('returns all edges when chainId = 0 (legacy compat)', () => {
    const events = eventsFromEdges(mixedEdges, 0, nowMs)

    expect(events).toHaveLength(4)
  })

  it('extracts chainId from edge keys correctly', () => {
    const events = eventsFromEdges(mixedEdges, null, nowMs)

    const celoEvents = events.filter((e) => e.chainId === CELO)
    const skaleEvents = events.filter((e) => e.chainId === SKALE)

    expect(celoEvents).toHaveLength(2)
    expect(skaleEvents).toHaveLength(2)

    // Verify source/target preserve chain prefix
    for (const e of celoEvents) {
      expect(e.sourceId).toMatch(new RegExp(`^${CELO}:`))
      expect(e.targetId).toMatch(new RegExp(`^${CELO}:`))
    }
    for (const e of skaleEvents) {
      expect(e.sourceId).toMatch(new RegExp(`^${SKALE}:`))
      expect(e.targetId).toMatch(new RegExp(`^${SKALE}:`))
    }
  })

  it('skips non-feedback edges regardless of chain filter', () => {
    const edges: TrustEdge[] = [
      { source: `${CELO}:0xabc`, target: `${CELO}:1`, kind: 'validation', value: 1 },
      makeFeedbackEdge(CELO, 1, '0xdef'),
    ]

    const events = eventsFromEdges(edges, null, nowMs)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('feedback')
  })
})
