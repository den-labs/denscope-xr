import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config', () => ({
  x402Config: {
    payTo: '0xPAYTO',
    network: 'eip155:42220',
    assetAddress: '0xUSDC',
    assetName: 'USD Coin',
    resourceBaseUrl: () => 'https://www.denscope.xyz',
    facilitatorUrl: 'https://facilitator.test',
    pricing: { score: 0.001, signals: 0.0005, evaluate: 0.001 },
  },
  isX402Enabled: () => true,
}))

vi.mock('@/lib/api-keys/authenticate', () => ({
  extractApiKey: vi.fn(),
  authenticateApiKey: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({ 'X-RateLimit-Limit': '100' })),
}))

vi.mock('../facilitator', () => ({
  verifyX402Payment: vi.fn(),
  settleX402Payment: vi.fn(),
}))

vi.mock('../verify-limit', () => ({
  consumeVerifyAttempt: vi.fn(),
}))

vi.mock('../idempotency', () => ({
  lookupDeliveredResult: vi.fn(),
  storeDeliveredResult: vi.fn(),
}))

vi.mock('../payments', () => ({
  recordX402Payment: vi.fn(async () => undefined),
}))

import { authorizePaidRequest, deliverPaidResult, respondWithReplay } from '../middleware'
import { extractApiKey, authenticateApiKey } from '@/lib/api-keys/authenticate'
import { verifyX402Payment, settleX402Payment } from '../facilitator'
import { consumeVerifyAttempt } from '../verify-limit'
import { lookupDeliveredResult, storeDeliveredResult } from '../idempotency'
import { recordX402Payment } from '../payments'

const endpoint = {
  path: '/api/v1/trust/evaluate',
  priceKey: 'evaluate',
  description: 'Contextual trust evaluation',
}

const PAYER = `0x${'1'.repeat(40)}`
const NONCE = `0x${'f'.repeat(64)}`

function paymentHeader(): string {
  return Buffer.from(
    JSON.stringify({
      x402Version: 2,
      payload: {
        signature: `0x${'a'.repeat(130)}`,
        authorization: {
          from: PAYER,
          to: `0x${'2'.repeat(40)}`,
          value: '1000',
          validAfter: '0',
          validBefore: String(Math.floor(Date.now() / 1000) + 3600),
          nonce: NONCE,
        },
      },
    }),
  ).toString('base64')
}

function paidHeaders(): Headers {
  return new Headers({ 'X-PAYMENT': paymentHeader(), 'x-real-ip': '203.0.113.7' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(extractApiKey).mockReturnValue(null)
  vi.mocked(consumeVerifyAttempt).mockResolvedValue({
    allowed: true, count: 1, limit: 30, retryAfterSeconds: 42, available: true,
  })
  vi.mocked(verifyX402Payment).mockResolvedValue({ valid: true, payer: PAYER })
  vi.mocked(lookupDeliveredResult).mockResolvedValue({ available: true, result: null })
  vi.mocked(storeDeliveredResult).mockResolvedValue({ stored: true, duplicate: false })
  vi.mocked(settleX402Payment).mockResolvedValue({ success: true, transaction: '0xTX', payer: PAYER })
})

describe('authorizePaidRequest — settles nothing (SEC-01)', () => {
  it('never settles while merely authorising a valid payment', async () => {
    const result = await authorizePaidRequest(paidHeaders(), endpoint)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.method).toBe('x402')
    expect(settleX402Payment).not.toHaveBeenCalled()
  })

  it('delegates to API key auth when a key is present', async () => {
    vi.mocked(extractApiKey).mockReturnValue('ds_abc123')
    vi.mocked(authenticateApiKey).mockResolvedValue({
      ok: true,
      keyId: 'key-1',
      rateLimit: { limited: false, remaining: 99, limit: 100, resetAt: 'x' },
    })

    const result = await authorizePaidRequest(new Headers({ Authorization: 'Bearer ds_abc' }), endpoint)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.method).toBe('api-key')
    expect(verifyX402Payment).not.toHaveBeenCalled()
    expect(settleX402Payment).not.toHaveBeenCalled()
  })

  it('returns 402 with PAYMENT-REQUIRED when no credentials are supplied', async () => {
    const result = await authorizePaidRequest(new Headers(), endpoint)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.status).toBe(402)
    expect(result.error.headers.get('PAYMENT-REQUIRED')).toBeTruthy()
    expect(consumeVerifyAttempt).not.toHaveBeenCalled()
  })

  it('returns 402 and does not settle when verification fails', async () => {
    vi.mocked(verifyX402Payment).mockResolvedValue({ valid: false, error: 'bad sig' })

    const result = await authorizePaidRequest(paidHeaders(), endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.status).toBe(402)
    expect(settleX402Payment).not.toHaveBeenCalled()
  })
})

// R6 — malformed X-PAYMENT never reaches the facilitator
describe('authorizePaidRequest — local rejection (SEC-04, R6)', () => {
  it('rejects obvious garbage without calling verify or the limiter', async () => {
    const result = await authorizePaidRequest(new Headers({ 'X-PAYMENT': '!!!not-base64!!!' }), endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.status).toBe(402)
    expect(verifyX402Payment).not.toHaveBeenCalled()
    expect(consumeVerifyAttempt).not.toHaveBeenCalled()
  })

  it('rejects an expired authorization without calling verify', async () => {
    const expired = Buffer.from(
      JSON.stringify({
        x402Version: 2,
        payload: {
          signature: `0x${'a'.repeat(130)}`,
          authorization: {
            from: PAYER, to: `0x${'2'.repeat(40)}`, value: '1000',
            validAfter: '0', validBefore: '1', nonce: NONCE,
          },
        },
      }),
    ).toString('base64')

    const result = await authorizePaidRequest(new Headers({ 'X-PAYMENT': expired }), endpoint)

    expect(result.ok).toBe(false)
    expect(verifyX402Payment).not.toHaveBeenCalled()
  })
})

// R7 — abuse limit
describe('authorizePaidRequest — abuse limiter (SEC-04, R7)', () => {
  it('returns 429 and does not call the facilitator when the limit is exceeded', async () => {
    vi.mocked(consumeVerifyAttempt).mockResolvedValue({
      allowed: false, count: 31, limit: 30, retryAfterSeconds: 17, available: true,
    })

    const result = await authorizePaidRequest(paidHeaders(), endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.status).toBe(429)
      expect(result.error.headers.get('Retry-After')).toBe('17')
    }
    expect(verifyX402Payment).not.toHaveBeenCalled()
  })

  it('fails closed with 503 when the limiter itself is unavailable', async () => {
    vi.mocked(consumeVerifyAttempt).mockResolvedValue({
      allowed: false, count: 0, limit: 30, retryAfterSeconds: 5, available: false,
    })

    const result = await authorizePaidRequest(paidHeaders(), endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.status).toBe(503)
    expect(verifyX402Payment).not.toHaveBeenCalled()
  })

  it('keys the limiter on the resolved client IP', async () => {
    await authorizePaidRequest(paidHeaders(), endpoint)
    expect(consumeVerifyAttempt).toHaveBeenCalledWith('203.0.113.7')
  })
})

// R5 — replay
describe('authorizePaidRequest — replay (SEC-02, R5)', () => {
  it('returns the stored result without recomputing or re-settling', async () => {
    vi.mocked(lookupDeliveredResult).mockResolvedValue({
      available: true,
      result: { status: 200, body: { evaluation: { recommended_action: 'review' } }, txHash: '0xTX' },
    })

    const result = await authorizePaidRequest(paidHeaders(), endpoint)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.method).toBe('x402-replay')
    expect(settleX402Payment).not.toHaveBeenCalled()
  })

  it('marks a replayed response so the caller can tell it was not recomputed', async () => {
    const delivered = { status: 200, body: { ok: 1 }, txHash: '0xTX' }
    const response = respondWithReplay(delivered)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Payment-Replay')).toBe('true')
    expect(response.headers.get('X-Payment-Tx')).toBe('0xTX')
    await expect(response.json()).resolves.toEqual({ ok: 1 })
  })

  it('keys replay on the CONFIRMED payer, not the address claimed in the payload', async () => {
    const confirmed = `0x${'9'.repeat(40)}`
    vi.mocked(verifyX402Payment).mockResolvedValue({ valid: true, payer: confirmed })

    await authorizePaidRequest(paidHeaders(), endpoint)

    expect(lookupDeliveredResult).toHaveBeenCalledWith({
      network: 'eip155:42220',
      payer: confirmed,
      nonce: NONCE,
    })
  })

  it('fails closed with 503 when the result store cannot be consulted', async () => {
    // Reading an unavailable store as "nothing stored" would recompute and
    // re-settle an already-paid request.
    vi.mocked(lookupDeliveredResult).mockResolvedValue({ available: false })

    const result = await authorizePaidRequest(paidHeaders(), endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.status).toBe(503)
    expect(settleX402Payment).not.toHaveBeenCalled()
  })
})

// R4 — successful paid lifecycle
describe('deliverPaidResult — settlement and persistence (R4)', () => {
  async function pending() {
    const auth = await authorizePaidRequest(paidHeaders(), endpoint)
    if (!auth.ok || auth.method !== 'x402') throw new Error('expected a pending payment')
    return auth
  }

  it('settles, then persists, then returns the computed body', async () => {
    const auth = await pending()
    const body = { evaluation: { recommended_action: 'allow' } }

    const delivery = await deliverPaidResult(auth, body, { chainId: 42220, agentId: 5 })

    expect(delivery.ok).toBe(true)
    if (!delivery.ok) return
    expect(delivery.body).toBe(body)
    expect(delivery.headers['X-Payment-Tx']).toBe('0xTX')

    // Ordering: verify happened during authorisation, settle only now, and the
    // durable binding strictly after settlement.
    const settleOrder = vi.mocked(settleX402Payment).mock.invocationCallOrder[0]
    const storeOrder = vi.mocked(storeDeliveredResult).mock.invocationCallOrder[0]
    const verifyOrder = vi.mocked(verifyX402Payment).mock.invocationCallOrder[0]
    expect(verifyOrder).toBeLessThan(settleOrder)
    expect(settleOrder).toBeLessThan(storeOrder)
  })

  it('persists the ledger row with the confirmed payer and tx', async () => {
    const auth = await pending()
    await deliverPaidResult(auth, { ok: 1 }, { chainId: 42220, agentId: 5 })

    expect(recordX402Payment).toHaveBeenCalledWith(
      expect.objectContaining({ payer: PAYER, transaction: '0xTX', priceKey: 'evaluate' }),
    )
  })

  it('returns 402 and never persists when settlement fails', async () => {
    const auth = await pending()
    vi.mocked(settleX402Payment).mockResolvedValue({ success: false, error: 'no funds' })

    const delivery = await deliverPaidResult(auth, { ok: 1 }, { chainId: 42220, agentId: 5 })

    expect(delivery.ok).toBe(false)
    if (!delivery.ok) expect(delivery.error.status).toBe(402)
    expect(storeDeliveredResult).not.toHaveBeenCalled()
    expect(recordX402Payment).not.toHaveBeenCalled()
  })

  it('serves the winner’s stored result when a concurrent request settled first', async () => {
    const auth = await pending()
    vi.mocked(storeDeliveredResult).mockResolvedValue({ stored: false, duplicate: true })
    vi.mocked(lookupDeliveredResult).mockResolvedValue({
      available: true,
      result: { status: 200, body: { winner: true }, txHash: '0xWIN' },
    })

    const delivery = await deliverPaidResult(auth, { loser: true }, { chainId: 42220, agentId: 5 })

    expect(delivery.ok).toBe(true)
    if (delivery.ok) expect(delivery.body).toEqual({ winner: true })
  })

  it('flags a delivered result whose replay binding could not be stored', async () => {
    const auth = await pending()
    vi.mocked(storeDeliveredResult).mockResolvedValue({ stored: false, duplicate: false })

    const delivery = await deliverPaidResult(auth, { ok: 1 }, { chainId: 42220, agentId: 5 })

    expect(delivery.ok).toBe(true)
    if (delivery.ok) expect(delivery.headers['X-Payment-Replayable']).toBe('false')
  })

  it('does not settle for an API-key caller', async () => {
    const auth = {
      ok: true as const,
      method: 'api-key' as const,
      keyId: 'k1',
      rateLimit: { limited: false, remaining: 99, limit: 100, resetAt: 'x' },
    }

    const delivery = await deliverPaidResult(auth, { ok: 1 }, { chainId: 42220, agentId: 5 })

    expect(delivery.ok).toBe(true)
    if (delivery.ok) expect(delivery.headers['X-RateLimit-Limit']).toBe('100')
    expect(settleX402Payment).not.toHaveBeenCalled()
  })
})
