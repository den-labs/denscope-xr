import { describe, expect, it } from 'vitest'
import { feedbackStatsForTarget } from '@/lib/firehose/feedbackStats'
import type { DenEvent } from '@/lib/firehose/types'
import type { TrustEdge } from '@/types/graph'

describe('feedbackStatsForTarget', () => {
  it('computes total, split counts and positive percent for mixed values', () => {
    const items: DenEvent[] = [
      { id: '1', ts: 1, chainId: 42220, kind: 'feedback', sourceId: '42220:a', targetId: '42220:7', value: 1 },
      { id: '2', ts: 2, chainId: 42220, kind: 'feedback', sourceId: '42220:b', targetId: '42220:7', value: -0.2 },
      { id: '3', ts: 3, chainId: 42220, kind: 'feedback', sourceId: '42220:c', targetId: '42220:7', value: 0 },
      { id: '4', ts: 4, chainId: 42220, kind: 'feedback', sourceId: '42220:d', targetId: '42220:9', value: 1 },
    ]

    expect(feedbackStatsForTarget(items, '42220:7')).toEqual({
      total: 3,
      posCount: 1,
      negCount: 1,
      neutralCount: 1,
      positivePct: 33,
    })
  })

  it('works with TrustEdge input', () => {
    const edges: TrustEdge[] = [
      { source: '44787:a', target: '44787:11', kind: 'feedback', value: 1 },
      { source: '44787:b', target: '44787:11', kind: 'feedback', value: 2 },
      { source: '44787:c', target: '44787:11', kind: 'feedback', value: -1 },
      { source: '44787:d', target: '44787:11', kind: 'feedback', value: 0 },
    ]

    expect(feedbackStatsForTarget(edges, '44787:11')).toEqual({
      total: 4,
      posCount: 2,
      negCount: 1,
      neutralCount: 1,
      positivePct: 50,
    })
  })

  it('returns zeros when target has no feedback', () => {
    const edges: TrustEdge[] = [
      { source: '44787:a', target: '44787:11', kind: 'feedback', value: 1 },
    ]

    expect(feedbackStatsForTarget(edges, '44787:404')).toEqual({
      total: 0,
      posCount: 0,
      negCount: 0,
      neutralCount: 0,
      positivePct: 0,
    })
  })
})
