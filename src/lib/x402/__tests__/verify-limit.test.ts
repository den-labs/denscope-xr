import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { rpc: (...a: unknown[]) => rpc(...a) } }))

import {
  consumeVerifyAttempt,
  windowStart,
  VERIFY_ATTEMPT_LIMIT,
  VERIFY_WINDOW_SECONDS,
} from '../verify-limit'

const NOW = Date.parse('2026-08-17T12:34:56.789Z')

beforeEach(() => {
  rpc.mockReset()
})

describe('windowStart', () => {
  it('floors to the window boundary', () => {
    expect(windowStart(NOW)).toBe('2026-08-17T12:34:00.000Z')
  })

  it('is stable within a window and advances between windows', () => {
    expect(windowStart(NOW)).toBe(windowStart(NOW + 1000))
    expect(windowStart(NOW)).not.toBe(windowStart(NOW + VERIFY_WINDOW_SECONDS * 1000))
  })
})

describe('consumeVerifyAttempt', () => {
  it('allows an attempt inside the limit', async () => {
    rpc.mockResolvedValue({ data: 1, error: null })

    const result = await consumeVerifyAttempt('203.0.113.7', NOW)

    expect(result).toMatchObject({ allowed: true, count: 1, limit: VERIFY_ATTEMPT_LIMIT, available: true })
    expect(rpc).toHaveBeenCalledWith('increment_x402_verify_attempts', {
      p_bucket: '203.0.113.7',
      p_window_start: '2026-08-17T12:34:00.000Z',
    })
  })

  it('allows exactly the limit and refuses the next attempt', async () => {
    rpc.mockResolvedValue({ data: VERIFY_ATTEMPT_LIMIT, error: null })
    await expect(consumeVerifyAttempt('ip', NOW)).resolves.toMatchObject({ allowed: true })

    rpc.mockResolvedValue({ data: VERIFY_ATTEMPT_LIMIT + 1, error: null })
    await expect(consumeVerifyAttempt('ip', NOW)).resolves.toMatchObject({ allowed: false })
  })

  it('reports seconds until the window rolls over', async () => {
    rpc.mockResolvedValue({ data: 1, error: null })
    // 12:34:56.789 -> 4 seconds (rounded up) remain in the minute.
    const result = await consumeVerifyAttempt('ip', NOW)
    expect(result.retryAfterSeconds).toBe(4)
  })

  it('fails closed when the counter errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const result = await consumeVerifyAttempt('ip', NOW)

    expect(result.allowed).toBe(false)
    expect(result.available).toBe(false)
  })

  it('fails closed when the counter throws', async () => {
    rpc.mockRejectedValue(new Error('connection refused'))

    const result = await consumeVerifyAttempt('ip', NOW)

    expect(result).toMatchObject({ allowed: false, available: false })
  })

  it('separates buckets so one abuser cannot exhaust another caller', async () => {
    rpc.mockResolvedValue({ data: 1, error: null })

    await consumeVerifyAttempt('203.0.113.7', NOW)
    await consumeVerifyAttempt('198.51.100.2', NOW)

    expect(rpc.mock.calls[0][1].p_bucket).toBe('203.0.113.7')
    expect(rpc.mock.calls[1][1].p_bucket).toBe('198.51.100.2')
  })
})
