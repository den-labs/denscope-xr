export function createDeduplicator(maxSize = 10_000) {
  const seen = new Map<string, true>()

  return {
    isNew(event: { txHash: string; logIndex: number }): boolean {
      const key = `${event.txHash}:${event.logIndex}`
      if (seen.has(key)) return false
      seen.set(key, true)
      if (seen.size > maxSize) {
        const first = seen.keys().next().value!
        seen.delete(first)
      }
      return true
    },
    clear() {
      seen.clear()
    },
  }
}
