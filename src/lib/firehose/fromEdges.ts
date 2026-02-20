import type { TrustEdge } from '@/types/graph'
import type { DenEvent } from './types'

type EdgeWithOptionalMeta = TrustEdge & {
  ts?: number
  txHash?: string
  logIndex?: number
  eventId?: string
  id?: string
}

function resolveTs(edge: EdgeWithOptionalMeta, nowMs: number): number {
  if (typeof edge.ts === 'number') return edge.ts
  if (typeof edge.timestamp === 'number') return edge.timestamp
  return nowMs
}

function resolveStableId(
  edge: EdgeWithOptionalMeta,
  ts: number,
): string {
  if (edge.eventId) return edge.eventId
  if (edge.id) return edge.id
  if (edge.txHash && typeof edge.logIndex === 'number') {
    return `${edge.txHash}:${edge.logIndex}:feedback`
  }
  return `${edge.target}|${edge.source}|${ts}|feedback|${edge.value}`
}

export function eventsFromEdges(
  edges: TrustEdge[],
  chainId: number,
  nowMs: number,
): DenEvent[] {
  const ids = new Set<string>()
  const out: DenEvent[] = []

  for (const rawEdge of edges) {
    if (rawEdge.kind !== 'feedback') continue
    const edge = rawEdge as EdgeWithOptionalMeta
    const ts = resolveTs(edge, nowMs)
    const id = resolveStableId(edge, ts)
    if (ids.has(id)) continue

    ids.add(id)
    out.push({
      id,
      ts,
      chainId,
      kind: 'feedback',
      sourceId: edge.source,
      targetId: edge.target,
      value: edge.value,
    })
  }

  return out
}
