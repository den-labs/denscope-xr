import { describe, expect, it } from 'vitest'
import { eventsFromEdges } from '@/lib/firehose/fromEdges'
import type { TrustEdge } from '@/types/graph'

describe('eventsFromEdges', () => {
  it('maps feedback edges to DenEvents using ts fallback and dedup by stable id', () => {
    const nowMs = 1_700_000_000_000
    const chainId = 42220
    const edges: TrustEdge[] = [
      {
        source: '42220:0xabc0000000000000000000000000000000000123',
        target: '42220:23',
        kind: 'feedback',
        value: 0.72,
        timestamp: 1234,
      },
      {
        source: '42220:0xabc0000000000000000000000000000000000123',
        target: '42220:23',
        kind: 'feedback',
        value: 0.72,
      },
      {
        source: '42220:0xabc0000000000000000000000000000000000123',
        target: '42220:23',
        kind: 'validation',
        value: 1,
      },
      {
        source: '42220:0xaaa',
        target: '42220:42',
        kind: 'feedback',
        value: -1,
        timestamp: 777,
      },
      {
        source: '42220:0xaaa',
        target: '42220:42',
        kind: 'feedback',
        value: -1,
        timestamp: 777,
      },
    ]

    const events = eventsFromEdges(edges, chainId, nowMs)

    expect(events).toEqual([
      {
        id: '42220:23|42220:0xabc0000000000000000000000000000000000123|1234|feedback|0.72',
        ts: 1234,
        chainId: 42220,
        kind: 'feedback',
        sourceId: '42220:0xabc0000000000000000000000000000000000123',
        targetId: '42220:23',
        value: 0.72,
      },
      {
        id: `42220:23|42220:0xabc0000000000000000000000000000000000123|${nowMs}|feedback|0.72`,
        ts: nowMs,
        chainId: 42220,
        kind: 'feedback',
        sourceId: '42220:0xabc0000000000000000000000000000000000123',
        targetId: '42220:23',
        value: 0.72,
      },
      {
        id: '42220:42|42220:0xaaa|777|feedback|-1',
        ts: 777,
        chainId: 42220,
        kind: 'feedback',
        sourceId: '42220:0xaaa',
        targetId: '42220:42',
        value: -1,
      },
    ])
  })

  it('prefers txHash/logIndex as stable id when available', () => {
    const nowMs = 1_700_000_000_000
    const chainId = 44787
    const edges = [
      {
        source: '44787:0xabc',
        target: '44787:7',
        kind: 'feedback',
        value: 1,
        txHash: '0xdeadbeef',
        logIndex: 8,
      },
    ] as unknown as TrustEdge[]

    const [event] = eventsFromEdges(edges, chainId, nowMs)
    expect(event.id).toBe('0xdeadbeef:8:feedback')
    expect(event.ts).toBe(nowMs)
  })
})
