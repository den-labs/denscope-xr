import { describe, it, expect } from 'vitest'
import { isRateLimited } from '@/lib/api-keys/rate-limit'

describe('isRateLimited', () => {
  it('returns not limited when count is below limit', () => {
    const result = isRateLimited({ requestCount: 50, dailyLimit: 100 })
    expect(result.limited).toBe(false)
    expect(result.remaining).toBe(50)
  })

  it('returns limited when count meets limit', () => {
    const result = isRateLimited({ requestCount: 100, dailyLimit: 100 })
    expect(result.limited).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('returns limited when count exceeds limit', () => {
    const result = isRateLimited({ requestCount: 150, dailyLimit: 100 })
    expect(result.limited).toBe(true)
    expect(result.remaining).toBe(0)
  })
})
