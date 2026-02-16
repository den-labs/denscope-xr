// src/lib/signals/__tests__/detect.test.ts
import { describe, it, expect } from 'vitest'
import {
  detectFirstInteraction,
  detectValidationComplete,
  detectFeedbackSpike,
  detectReputationDrop,
  detectSybilCluster,
} from '@/lib/signals/detect'

describe('detectFirstInteraction', () => {
  it('fires when feedback_count goes from 0 to 1', () => {
    const result = detectFirstInteraction(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { feedbackCount: 0 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('first_interaction')
    expect(result!.severity).toBe('info')
  })

  it('does not fire when feedback_count > 0', () => {
    const result = detectFirstInteraction(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { feedbackCount: 3 }
    )
    expect(result).toBeNull()
  })

  it('does not fire for non-feedback events', () => {
    const result = detectFirstInteraction(
      { kind: 'register', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { feedbackCount: 0 }
    )
    expect(result).toBeNull()
  })
})

describe('detectValidationComplete', () => {
  it('fires on validation_res event', () => {
    const result = detectValidationComplete(
      { kind: 'validation_res', chainId: 42220, agentId: 5, txHash: '0xabc' }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('validation_complete')
  })

  it('does not fire for other events', () => {
    const result = detectValidationComplete(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' }
    )
    expect(result).toBeNull()
  })
})

describe('detectFeedbackSpike', () => {
  it('fires when recent feedback count exceeds threshold', () => {
    const result = detectFeedbackSpike(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { recentFeedbackCount: 6, windowHours: 1 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('feedback_spike')
  })

  it('does not fire below threshold', () => {
    const result = detectFeedbackSpike(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { recentFeedbackCount: 2, windowHours: 1 }
    )
    expect(result).toBeNull()
  })
})

describe('detectReputationDrop', () => {
  it('fires when negative ratio exceeds 50%', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 2, negativeCount: 4, feedbackCount: 6 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('reputation_drop')
    expect(result!.severity).toBe('warning')
  })

  it('returns critical when negative ratio > 80%', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 1, negativeCount: 9, feedbackCount: 10 }
    )
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('critical')
  })

  it('does not fire when ratio is healthy', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 8, negativeCount: 2, feedbackCount: 10 }
    )
    expect(result).toBeNull()
  })

  it('needs at least 3 feedbacks to fire', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 0, negativeCount: 2, feedbackCount: 2 }
    )
    expect(result).toBeNull()
  })
})

describe('detectSybilCluster', () => {
  it('fires when unique addresses exceed threshold in window', () => {
    const result = detectSybilCluster(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { uniqueAddressesInWindow: 4, windowHours: 1 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('sybil_cluster')
    expect(result!.severity).toBe('critical')
  })

  it('does not fire below threshold', () => {
    const result = detectSybilCluster(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { uniqueAddressesInWindow: 2, windowHours: 1 }
    )
    expect(result).toBeNull()
  })
})
