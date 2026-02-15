// src/types/__tests__/events.test.ts
import { describe, it, expect } from 'vitest'
import type { ScopeEvent, RegisterData, FeedbackData } from '../events'

describe('ScopeEvent types', () => {
  it('accepts a valid register event', () => {
    const event: ScopeEvent = {
      chainId: 44787,
      block: 1000,
      txHash: '0xabc',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: {
        agentURI: 'https://example.com/agent.json',
        owner: '0x1234567890abcdef1234567890abcdef12345678',
      } satisfies RegisterData,
    }
    expect(event.kind).toBe('register')
  })

  it('accepts a feedback event with optional timestamp', () => {
    const event: ScopeEvent = {
      chainId: 44787,
      block: 1001,
      txHash: '0xdef',
      logIndex: 1,
      timestamp: 1707900000,
      kind: 'feedback',
      agentId: 2,
      data: {
        clientAddress: '0xabcdef',
        feedbackIndex: 0n,
        value: 92n,
        valueDecimals: 0,
        tag1: 'starred',
        tag2: '',
        endpoint: '',
        feedbackURI: '',
        feedbackHash: '0x0',
      } satisfies FeedbackData,
    }
    expect(event.timestamp).toBe(1707900000)
  })
})
