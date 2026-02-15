import { BLOCK_TIMESTAMP_CACHE_SIZE } from '@/config/constants'

export function createBlockTimestampCache(maxSize = BLOCK_TIMESTAMP_CACHE_SIZE) {
  const cache = new Map<number, number>()

  return {
    get(blockNumber: number): number | undefined {
      return cache.get(blockNumber)
    },
    set(blockNumber: number, timestamp: number) {
      cache.set(blockNumber, timestamp)
      if (cache.size > maxSize) {
        const first = cache.keys().next().value!
        cache.delete(first)
      }
    },
    extractUniqueBlocks(blockNumbers: number[]): number[] {
      const unique = new Set<number>()
      for (const b of blockNumbers) {
        if (!cache.has(b)) unique.add(b)
      }
      return Array.from(unique)
    },
  }
}
