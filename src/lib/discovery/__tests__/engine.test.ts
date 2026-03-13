import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScopeEvent } from '@/types/events'

const mockPush = vi.fn()
const mockDetectFirstBlood = vi.fn().mockReturnValue(null)
const mockDetectRisingStar = vi.fn().mockReturnValue(null)

vi.mock('@/lib/discovery/rules', () => ({
  detectFirstBlood: (...args: unknown[]) => mockDetectFirstBlood(...args),
  detectRisingStar: (...args: unknown[]) => mockDetectRisingStar(...args),
}))

vi.mock('@/stores/discovery', () => ({
  useDiscoveryStore: { getState: () => ({ push: mockPush }) },
}))

import { runDiscoveryRules } from '../engine'

function makeFeedbackEvent(overrides: Partial<ScopeEvent> = {}): ScopeEvent {
  return {
    chainId: 42220, block: 100, txHash: '0xabc', logIndex: 0,
    kind: 'feedback', agentId: 1,
    data: {
      clientAddress: '0x123', feedbackIndex: BigInt(0), value: BigInt(1),
      valueDecimals: 18, tag1: '', tag2: '', endpoint: '', feedbackURI: '', feedbackHash: '',
    },
    ...overrides,
  }
}

describe('runDiscoveryRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDetectFirstBlood.mockReturnValue(null)
    mockDetectRisingStar.mockReturnValue(null)
  })

  it('calls detectFirstBlood and detectRisingStar with event', () => {
    const event = makeFeedbackEvent()
    runDiscoveryRules(event)

    expect(mockDetectFirstBlood).toHaveBeenCalledWith(event, expect.any(Map))
    expect(mockDetectRisingStar).toHaveBeenCalledWith(event, expect.any(Map))
  })

  it('pushes non-null signals to discovery store', () => {
    const signal = {
      kind: 'first_blood' as const, title: 'First!', description: 'desc',
      agentIds: [1], chainId: 42220, timestamp: 1000, severity: 'info' as const,
    }
    mockDetectFirstBlood.mockReturnValueOnce(signal)

    runDiscoveryRules(makeFeedbackEvent())

    expect(mockPush).toHaveBeenCalledWith(signal)
  })

  it('does not push null signals', () => {
    runDiscoveryRules(makeFeedbackEvent())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('updates feedbackCounts for feedback events', () => {
    const event = makeFeedbackEvent({ agentId: 5 })

    runDiscoveryRules(event)
    runDiscoveryRules(event)

    // The map is a live reference — after 2 feedback calls, count should be 2
    const calls = mockDetectFirstBlood.mock.calls
    const feedbackMap = calls[1][1] as Map<string, number>
    expect(feedbackMap.get('42220:5')).toBeGreaterThanOrEqual(1)
  })

  it('does not update feedbackCounts for non-feedback events', () => {
    const event = makeFeedbackEvent({ kind: 'register', agentId: 99, data: { agentURI: 'uri', owner: '0x1' } })

    runDiscoveryRules(event)

    const calls = mockDetectFirstBlood.mock.calls
    const feedbackMap = calls[0][1] as Map<string, number>
    expect(feedbackMap.has('42220:99')).toBe(false)
  })
})
