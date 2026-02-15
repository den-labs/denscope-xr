import { describe, it, expect } from 'vitest'
import { detectFirstBlood, detectRisingStar } from '../rules'
import type { ScopeEvent } from '@/types/events'

const makeFeedbackEvent = (agentId: number): ScopeEvent => ({
  chainId: 44787, block: 100, txHash: '0x1', logIndex: 0,
  kind: 'feedback', agentId,
  data: {
    clientAddress: '0xabc', feedbackIndex: BigInt(0), value: BigInt(80),
    valueDecimals: 0, tag1: 'starred', tag2: '', endpoint: '',
    feedbackURI: '', feedbackHash: '0x0',
  },
})

describe('detectFirstBlood', () => {
  it('fires when agent gets first feedback', () => {
    const counts = new Map<string, number>()
    const signal = detectFirstBlood(makeFeedbackEvent(42), counts)
    expect(signal).not.toBeNull()
    expect(signal!.kind).toBe('first_blood')
  })

  it('does NOT fire on second feedback', () => {
    const counts = new Map<string, number>([['44787:42', 1]])
    const signal = detectFirstBlood(makeFeedbackEvent(42), counts)
    expect(signal).toBeNull()
  })

  it('ignores non-feedback events', () => {
    const counts = new Map<string, number>()
    const event: ScopeEvent = {
      chainId: 44787, block: 100, txHash: '0x1', logIndex: 0,
      kind: 'register', agentId: 42,
      data: { agentURI: 'https://example.com', owner: '0x1' },
    }
    expect(detectFirstBlood(event, counts)).toBeNull()
  })
})

describe('detectRisingStar', () => {
  it('fires when agent has 5+ feedbacks in under 24h', () => {
    const recent = new Map([['44787:42', { count: 5, since: Date.now() - 3600000 }]])
    const signal = detectRisingStar(makeFeedbackEvent(42), recent)
    expect(signal).not.toBeNull()
    expect(signal!.kind).toBe('rising_star')
  })

  it('does NOT fire with fewer than 5 feedbacks', () => {
    const recent = new Map([['44787:42', { count: 3, since: Date.now() - 3600000 }]])
    expect(detectRisingStar(makeFeedbackEvent(42), recent)).toBeNull()
  })
})
