import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentStore } from '../agents'
import type { ScopeEvent } from '@/types/events'

describe('useAgentStore', () => {
  beforeEach(() => {
    useAgentStore.getState().clear()
  })

  it('starts with empty map', () => {
    expect(useAgentStore.getState().agents.size).toBe(0)
  })

  it('upserts agent on register', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 100,
      txHash: '0x1',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: { agentURI: 'https://example.com', owner: '0xabc' },
    })
    const agent = useAgentStore.getState().agents.get('44787:1')
    expect(agent).toBeDefined()
    expect(agent!.owner).toBe('0xabc')
    expect(agent!.agentURI).toBe('https://example.com')
  })

  it('updates URI on uri_update event', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 100,
      txHash: '0x1',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: { agentURI: 'https://old.com', owner: '0xabc' },
    })
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 101,
      txHash: '0x2',
      logIndex: 0,
      kind: 'uri_update',
      agentId: 1,
      data: { newURI: 'https://new.com', updatedBy: '0xabc' },
    })
    const agent = useAgentStore.getState().agents.get('44787:1')
    expect(agent!.agentURI).toBe('https://new.com')
    expect(agent!.lastEventBlock).toBe(101)
  })

  it('increments feedback count on positive feedback', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 100,
      txHash: '0x1',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: { agentURI: 'https://example.com', owner: '0xabc' },
    })
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 101,
      txHash: '0x2',
      logIndex: 0,
      kind: 'feedback',
      agentId: 1,
      data: {
        clientAddress: '0xdef',
        feedbackIndex: 0n,
        value: 50n,
        valueDecimals: 0,
        tag1: '',
        tag2: '',
        endpoint: '',
        feedbackURI: '',
        feedbackHash: '0x0',
      },
    })
    const agent = useAgentStore.getState().agents.get('44787:1')
    expect(agent!.feedbackCount).toBe(1)
    expect(agent!.positiveFeedback).toBe(1)
    expect(agent!.negativeFeedback).toBe(0)
  })

  it('increments negative feedback count on negative value', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 100,
      txHash: '0x1',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: { agentURI: 'https://example.com', owner: '0xabc' },
    })
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 101,
      txHash: '0x2',
      logIndex: 0,
      kind: 'feedback',
      agentId: 1,
      data: {
        clientAddress: '0xdef',
        feedbackIndex: 1n,
        value: -10n,
        valueDecimals: 0,
        tag1: '',
        tag2: '',
        endpoint: '',
        feedbackURI: '',
        feedbackHash: '0x0',
      },
    })
    const agent = useAgentStore.getState().agents.get('44787:1')
    expect(agent!.feedbackCount).toBe(1)
    expect(agent!.positiveFeedback).toBe(0)
    expect(agent!.negativeFeedback).toBe(1)
  })

  it('creates agent on feedback if not registered yet', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 101,
      txHash: '0x2',
      logIndex: 0,
      kind: 'feedback',
      agentId: 99,
      data: {
        clientAddress: '0xdef',
        feedbackIndex: 0n,
        value: 10n,
        valueDecimals: 0,
        tag1: '',
        tag2: '',
        endpoint: '',
        feedbackURI: '',
        feedbackHash: '0x0',
      },
    })
    const agent = useAgentStore.getState().agents.get('44787:99')
    expect(agent).toBeDefined()
    expect(agent!.feedbackCount).toBe(1)
    expect(agent!.owner).toBe('')
  })

  it('accepts feedback values from Supabase as strings', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 200,
      txHash: '0x3',
      logIndex: 0,
      kind: 'feedback',
      agentId: 7,
      data: {
        clientAddress: '0xbeef',
        feedbackIndex: 0n,
        value: '12' as unknown as bigint,
        valueDecimals: 0,
        tag1: '',
        tag2: '',
        endpoint: '',
        feedbackURI: '',
        feedbackHash: '0x0',
      },
    })

    const agent = useAgentStore.getState().agents.get('44787:7')
    expect(agent).toBeDefined()
    expect(agent!.feedbackCount).toBe(1)
    expect(agent!.positiveFeedback).toBe(1)
    expect(agent!.negativeFeedback).toBe(0)
  })

  it('clear resets agents map', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 100,
      txHash: '0x1',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: { agentURI: 'https://example.com', owner: '0xabc' },
    })
    useAgentStore.getState().clear()
    expect(useAgentStore.getState().agents.size).toBe(0)
  })
})
