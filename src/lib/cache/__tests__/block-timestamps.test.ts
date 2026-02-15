import { describe, it, expect } from 'vitest'
import { createBlockTimestampCache } from '../block-timestamps'

describe('createBlockTimestampCache', () => {
  it('returns undefined for unknown block', () => {
    const cache = createBlockTimestampCache()
    expect(cache.get(1000)).toBeUndefined()
  })

  it('stores and retrieves timestamp', () => {
    const cache = createBlockTimestampCache()
    cache.set(1000, 1707900000)
    expect(cache.get(1000)).toBe(1707900000)
  })

  it('evicts oldest when over max size', () => {
    const cache = createBlockTimestampCache(2)
    cache.set(1, 100)
    cache.set(2, 200)
    cache.set(3, 300)
    expect(cache.get(1)).toBeUndefined()
    expect(cache.get(2)).toBe(200)
    expect(cache.get(3)).toBe(300)
  })

  it('extractUniqueBlocks returns only uncached blocks', () => {
    const cache = createBlockTimestampCache()
    cache.set(100, 1000)
    cache.set(200, 2000)
    const unique = cache.extractUniqueBlocks([100, 200, 300, 300, 400])
    expect(unique).toEqual([300, 400])
  })
})
