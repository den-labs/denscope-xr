import { describe, it, expect, beforeEach } from 'vitest'
import { useEventStore } from '../events'
import { useAgentStore } from '../agents'
import { useGraphStore } from '../graph'
import type { ScopeEvent } from '@/types/events'

const CELO = 42220
const SKALE = 1187947933

function makeRegister(chainId: number, agentId: number): ScopeEvent {
  return {
    chainId,
    block: 100,
    txHash: `0x${chainId}-${agentId}-reg`,
    logIndex: 0,
    kind: 'register',
    agentId,
    data: { agentURI: `https://agent-${chainId}-${agentId}.com`, owner: `0xowner${agentId}` },
  }
}

function makeFeedback(chainId: number, agentId: number, value: bigint, block = 200): ScopeEvent {
  return {
    chainId,
    block,
    txHash: `0x${chainId}-${agentId}-fb`,
    logIndex: 0,
    kind: 'feedback',
    agentId,
    data: {
      clientAddress: '0xuser1',
      feedbackIndex: BigInt(0),
      value,
      valueDecimals: 0,
      tag1: '',
      tag2: '',
      endpoint: '',
      feedbackURI: '',
      feedbackHash: '0x0',
    },
  }
}

describe('store chain isolation', () => {
  beforeEach(() => {
    useEventStore.getState().clear()
    useAgentStore.getState().clear()
    useGraphStore.getState().clear()
  })

  describe('useEventStore', () => {
    it('stores events from both chains', () => {
      const celoEvent = makeRegister(CELO, 1)
      const skaleEvent = makeRegister(SKALE, 1)

      useEventStore.getState().push(celoEvent)
      useEventStore.getState().push(skaleEvent)

      const events = useEventStore.getState().events
      expect(events).toHaveLength(2)

      const chainIds = events.map((e) => e.chainId)
      expect(chainIds).toContain(CELO)
      expect(chainIds).toContain(SKALE)
    })
  })

  describe('useAgentStore', () => {
    it('keys agents as chainId:agentId with no collision across chains', () => {
      useAgentStore.getState().upsertFromEvent(makeRegister(CELO, 1))
      useAgentStore.getState().upsertFromEvent(makeRegister(SKALE, 1))

      const agents = useAgentStore.getState().agents
      expect(agents.size).toBe(2)
      expect(agents.has(`${CELO}:1`)).toBe(true)
      expect(agents.has(`${SKALE}:1`)).toBe(true)

      const celoAgent = agents.get(`${CELO}:1`)!
      const skaleAgent = agents.get(`${SKALE}:1`)!

      expect(celoAgent.chainId).toBe(CELO)
      expect(skaleAgent.chainId).toBe(SKALE)
      expect(celoAgent.agentURI).not.toBe(skaleAgent.agentURI)
    })

    it('feedback for agent 1 on Celo does not affect agent 1 on SKALE', () => {
      useAgentStore.getState().upsertFromEvent(makeRegister(CELO, 1))
      useAgentStore.getState().upsertFromEvent(makeRegister(SKALE, 1))

      useAgentStore.getState().upsertFromEvent(makeFeedback(CELO, 1, BigInt(10)))

      const celoAgent = useAgentStore.getState().agents.get(`${CELO}:1`)!
      const skaleAgent = useAgentStore.getState().agents.get(`${SKALE}:1`)!

      expect(celoAgent.feedbackCount).toBe(1)
      expect(celoAgent.positiveFeedback).toBe(1)

      expect(skaleAgent.feedbackCount).toBe(0)
      expect(skaleAgent.positiveFeedback).toBe(0)
    })

    it('handles same agentId on three different chains without collision', () => {
      const CELO_SEPOLIA = 11142220

      useAgentStore.getState().upsertFromEvent(makeRegister(CELO, 5))
      useAgentStore.getState().upsertFromEvent(makeRegister(SKALE, 5))
      useAgentStore.getState().upsertFromEvent(makeRegister(CELO_SEPOLIA, 5))

      const agents = useAgentStore.getState().agents
      expect(agents.size).toBe(3)
      expect(agents.has(`${CELO}:5`)).toBe(true)
      expect(agents.has(`${SKALE}:5`)).toBe(true)
      expect(agents.has(`${CELO_SEPOLIA}:5`)).toBe(true)
    })
  })

  describe('useGraphStore', () => {
    it('stores graph edges with chainId-prefixed source/target', () => {
      useGraphStore.getState().addEdge({
        source: `${CELO}:0xaaa`,
        target: `${CELO}:1`,
        kind: 'feedback',
        value: 1,
      })
      useGraphStore.getState().addEdge({
        source: `${SKALE}:0xbbb`,
        target: `${SKALE}:1`,
        kind: 'feedback',
        value: -1,
      })

      const edges = useGraphStore.getState().edges
      expect(edges).toHaveLength(2)

      const celoEdge = edges.find((e) => e.source.startsWith(`${CELO}:`))!
      const skaleEdge = edges.find((e) => e.source.startsWith(`${SKALE}:`))!

      expect(celoEdge.target).toBe(`${CELO}:1`)
      expect(skaleEdge.target).toBe(`${SKALE}:1`)
      expect(celoEdge.target).not.toBe(skaleEdge.target)
    })

    it('graph nodes keyed by chainId:id do not collide', () => {
      useGraphStore.getState().addNode({
        id: `${CELO}:1`,
        agentId: 1,
        chainId: CELO,
        label: 'Celo Agent 1',
        feedbackCount: 5,
      })
      useGraphStore.getState().addNode({
        id: `${SKALE}:1`,
        agentId: 1,
        chainId: SKALE,
        label: 'SKALE Agent 1',
        feedbackCount: 3,
      })

      const nodes = useGraphStore.getState().nodes
      expect(nodes.size).toBe(2)
      expect(nodes.get(`${CELO}:1`)!.label).toBe('Celo Agent 1')
      expect(nodes.get(`${SKALE}:1`)!.label).toBe('SKALE Agent 1')
    })
  })
})
