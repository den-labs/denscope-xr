import { describe, it, expect, beforeEach } from 'vitest'
import { useGraphStore } from '../graph'
import { MAX_GRAPH_EDGES } from '@/config/constants'
import type { GraphNode, TrustEdge } from '@/types/graph'

function node(id: string): GraphNode {
  return { id, agentId: Number(id.split(':')[1]), chainId: Number(id.split(':')[0]), label: id, feedbackCount: 0 }
}

function edge(source: string, target: string): TrustEdge {
  return {
    source,
    target,
    kind: 'feedback',
    value: 1,
    timestamp: 1,
    ts: 1,
    txHash: `${source}:${target}`,
    logIndex: 0,
    eventId: `${source}:${target}:feedback`,
  }
}

describe('useGraphStore.addBatch', () => {
  beforeEach(() => {
    useGraphStore.getState().clear()
  })

  it('applies nodes and edges in one update', () => {
    useGraphStore.getState().addBatch({
      nodes: [node('42220:1'), node('42220:2'), node('42220:1')],
      edges: [edge('42220:A', '42220:1'), edge('42220:B', '42220:2')],
    })
    const state = useGraphStore.getState()
    expect(state.nodes.size).toBe(2)
    expect(state.edges).toHaveLength(2)
  })

  it('no-op on empty payload', () => {
    const before = useGraphStore.getState()
    useGraphStore.getState().addBatch({ nodes: [], edges: [] })
    const after = useGraphStore.getState()
    expect(after.nodes).toBe(before.nodes)
    expect(after.edges).toBe(before.edges)
  })

  it('respects MAX_GRAPH_EDGES cap', () => {
    const batch: TrustEdge[] = []
    for (let i = 0; i < MAX_GRAPH_EDGES + 25; i++) {
      batch.push(edge(`42220:S${i}`, `42220:1`))
    }
    useGraphStore.getState().addBatch({ edges: batch })
    expect(useGraphStore.getState().edges).toHaveLength(MAX_GRAPH_EDGES)
  })
})
