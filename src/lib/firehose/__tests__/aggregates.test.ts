import { describe, expect, it } from 'vitest'
import { buildFeedbackAggregates } from '@/lib/firehose/aggregates'
import type { DenEvent } from '@/lib/firehose/types'

function feedbackEvent(
  id: string,
  ts: number,
  targetId: string,
  value: number,
): DenEvent {
  return {
    id,
    ts,
    chainId: 42220,
    kind: 'feedback',
    sourceId: '42220:0xabc',
    targetId,
    value,
  }
}

describe('buildFeedbackAggregates', () => {
  it('computes sums, count and rate in rolling window', () => {
    const nowMs = 1_700_000_000_000
    const windowMs = 10 * 60 * 1000
    const events: DenEvent[] = [
      feedbackEvent('a', nowMs - 1_000, '42220:7', 1.5),
      feedbackEvent('b', nowMs - 2_000, '42220:7', -2),
      feedbackEvent('c', nowMs - 3_000, '42220:7', 0),
      feedbackEvent('d', nowMs - 11 * 60 * 1000, '42220:7', 5), // out of window
    ]

    const agg = buildFeedbackAggregates(events, { nowMs, windowMs })
    expect(agg.agents).toHaveLength(1)
    expect(agg.agents[0]).toEqual({
      targetId: '42220:7',
      posSum: 1.5,
      negSum: -2,
      count: 3,
      ratePerMin: 0.3,
    })
  })

  it('sorts selectors correctly', () => {
    const nowMs = 1_700_000_000_000
    const events: DenEvent[] = [
      feedbackEvent('a1', nowMs - 1_000, '42220:1', 2),
      feedbackEvent('a2', nowMs - 2_000, '42220:1', 1),
      feedbackEvent('b1', nowMs - 1_500, '42220:2', -5),
      feedbackEvent('b2', nowMs - 2_500, '42220:2', -1),
      feedbackEvent('c1', nowMs - 900, '42220:3', 0),
      feedbackEvent('c2', nowMs - 800, '42220:3', 0),
      feedbackEvent('c3', nowMs - 700, '42220:3', 0),
    ]

    const agg = buildFeedbackAggregates(events, { nowMs })
    expect(agg.topLiked(1)[0].targetId).toBe('42220:1')
    expect(agg.topDisliked(1)[0].targetId).toBe('42220:2')
    expect(agg.mostReviewed(1)[0].targetId).toBe('42220:3')
    expect(agg.hotAgents(1)[0].targetId).toBe('42220:3')
  })
})
