import { describe, it, expect } from 'vitest'
import { createDeduplicator } from '../reconcile'

const makeEvent = (txHash: string, logIndex: number) => ({ txHash, logIndex })

describe('createDeduplicator', () => {
  it('allows first occurrence', () => {
    const dedup = createDeduplicator()
    expect(dedup.isNew(makeEvent('0xabc', 0))).toBe(true)
  })

  it('rejects duplicate txHash + logIndex', () => {
    const dedup = createDeduplicator()
    dedup.isNew(makeEvent('0xabc', 0))
    expect(dedup.isNew(makeEvent('0xabc', 0))).toBe(false)
  })

  it('allows same txHash with different logIndex', () => {
    const dedup = createDeduplicator()
    dedup.isNew(makeEvent('0xabc', 0))
    expect(dedup.isNew(makeEvent('0xabc', 1))).toBe(true)
  })

  it('respects max size (evicts oldest)', () => {
    const dedup = createDeduplicator(2)
    dedup.isNew(makeEvent('0x1', 0))
    dedup.isNew(makeEvent('0x2', 0))
    dedup.isNew(makeEvent('0x3', 0))
    expect(dedup.isNew(makeEvent('0x1', 0))).toBe(true)
  })
})
