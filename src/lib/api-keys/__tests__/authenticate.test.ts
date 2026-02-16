import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {},
}))

import { extractApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

describe('extractApiKey', () => {
  it('extracts key from Authorization Bearer header', () => {
    const headers = new Headers({ Authorization: 'Bearer ds_abc123' })
    expect(extractApiKey(headers)).toBe('ds_abc123')
  })

  it('extracts key from X-API-Key header', () => {
    const headers = new Headers({ 'X-API-Key': 'ds_abc123' })
    expect(extractApiKey(headers)).toBe('ds_abc123')
  })

  it('prefers Authorization over X-API-Key', () => {
    const headers = new Headers({
      Authorization: 'Bearer ds_from_auth',
      'X-API-Key': 'ds_from_header',
    })
    expect(extractApiKey(headers)).toBe('ds_from_auth')
  })

  it('returns null if no key present', () => {
    expect(extractApiKey(new Headers())).toBeNull()
  })
})

describe('buildRateLimitHeaders', () => {
  it('includes standard rate limit headers', () => {
    const headers = buildRateLimitHeaders({
      limited: false,
      remaining: 90,
      limit: 100,
      resetAt: '2026-02-17T00:00:00.000Z',
    })
    expect(headers['X-RateLimit-Limit']).toBe('100')
    expect(headers['X-RateLimit-Remaining']).toBe('90')
    expect(headers['X-RateLimit-Reset']).toBe('2026-02-17T00:00:00.000Z')
  })
})
