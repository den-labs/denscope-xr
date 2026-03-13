import { describe, it, expect } from 'vitest'
import { createDeduplicator } from '../reconcile'

const makeEvent = (txHash: string, logIndex: number) => ({ txHash, logIndex })

describe('createDeduplicator', () => {
  it('returns true for first-time event', () => {
    const dedup = createDeduplicator()
    expect(dedup.isNew(makeEvent('0xaaa', 0))).toBe(true)
  })

  it('returns false for duplicate event', () => {
    const dedup = createDeduplicator()
    dedup.isNew(makeEvent('0xaaa', 0))
    expect(dedup.isNew(makeEvent('0xaaa', 0))).toBe(false)
  })

  it('handles different logIndex as different events', () => {
    const dedup = createDeduplicator()
    dedup.isNew(makeEvent('0xaaa', 0))
    expect(dedup.isNew(makeEvent('0xaaa', 1))).toBe(true)
  })

  it('evicts oldest when exceeding maxSize', () => {
    const dedup = createDeduplicator(2)
    dedup.isNew(makeEvent('0x1', 0))
    dedup.isNew(makeEvent('0x2', 0))
    // Adding a third should evict 0x1:0
    dedup.isNew(makeEvent('0x3', 0))
    // 0x1 was evicted, so it's new again
    expect(dedup.isNew(makeEvent('0x1', 0))).toBe(true)
    // 0x3 should still be tracked (most recent)
    expect(dedup.isNew(makeEvent('0x3', 0))).toBe(false)
  })

  it('clear() resets dedup state', () => {
    const dedup = createDeduplicator()
    dedup.isNew(makeEvent('0xaaa', 0))
    dedup.clear()
    expect(dedup.isNew(makeEvent('0xaaa', 0))).toBe(true)
  })
})
