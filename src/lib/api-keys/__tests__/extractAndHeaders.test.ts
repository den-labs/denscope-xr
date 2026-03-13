import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {},
}))

import { extractApiKey, buildRateLimitHeaders } from '../authenticate'

describe('extractApiKey', () => {
  it('extracts key from Bearer authorization header', () => {
    const headers = new Headers({ Authorization: 'Bearer ds_test_key' })
    expect(extractApiKey(headers)).toBe('ds_test_key')
  })

  it('extracts key from X-API-Key header', () => {
    const headers = new Headers({ 'X-API-Key': 'ds_xapi_key' })
    expect(extractApiKey(headers)).toBe('ds_xapi_key')
  })

  it('returns null when neither header is present', () => {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    expect(extractApiKey(headers)).toBeNull()
  })
})

describe('buildRateLimitHeaders', () => {
  it('maps limit, remaining, and resetAt correctly', () => {
    const result = buildRateLimitHeaders({
      limited: false,
      limit: 100,
      remaining: 75,
      resetAt: '2026-03-14T00:00:00.000Z',
    })

    expect(result).toEqual({
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '75',
      'X-RateLimit-Reset': '2026-03-14T00:00:00.000Z',
    })
  })
})
