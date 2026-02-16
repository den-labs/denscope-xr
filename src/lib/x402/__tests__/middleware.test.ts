import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../config', () => ({
  x402Config: {
    payTo: '0xPAYTO',
    network: 'eip155:42220',
    assetAddress: '0xUSDC',
    assetName: 'USD Coin',
    baseUrl: 'https://denscope.vercel.app',
    facilitatorUrl: 'https://facilitator.test',
    pricing: { score: 0.001, signals: 0.0005 },
  },
  isX402Enabled: () => true,
}))

vi.mock('@/lib/api-keys/authenticate', () => ({
  extractApiKey: vi.fn(),
  authenticateApiKey: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': '2026-02-17T00:00:00.000Z',
  })),
}))

vi.mock('../facilitator', () => ({
  verifyX402Payment: vi.fn(),
  settleX402Payment: vi.fn(),
}))

import { authenticateHybrid, buildHybridHeaders } from '../middleware'
import { extractApiKey, authenticateApiKey } from '@/lib/api-keys/authenticate'
import { verifyX402Payment, settleX402Payment } from '../facilitator'

const endpoint = { path: '/api/v1/agent/42220/5/score', priceKey: 'score', description: 'Trust score' }

describe('authenticateHybrid', () => {
  beforeEach(() => {
    vi.mocked(extractApiKey).mockReturnValue(null)
  })

  it('delegates to API key auth when key is present', async () => {
    vi.mocked(extractApiKey).mockReturnValue('ds_abc123')
    vi.mocked(authenticateApiKey).mockResolvedValue({
      ok: true,
      keyId: 'key-1',
      rateLimit: { limited: false, remaining: 99, limit: 100, resetAt: '2026-02-17T00:00:00.000Z' },
    })

    const headers = new Headers({ Authorization: 'Bearer ds_abc123' })
    const result = await authenticateHybrid(headers, endpoint)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.method).toBe('api-key')
    }
  })

  it('processes x402 payment when X-PAYMENT header is present', async () => {
    const fakePayload = { x402Version: 2, payload: {} }
    const paymentHeader = Buffer.from(JSON.stringify(fakePayload)).toString('base64')

    vi.mocked(verifyX402Payment).mockResolvedValue({ valid: true, payer: '0xAGENT' })
    vi.mocked(settleX402Payment).mockResolvedValue({ success: true, transaction: '0xTX', payer: '0xAGENT' })

    const headers = new Headers({ 'X-PAYMENT': paymentHeader })
    const result = await authenticateHybrid(headers, endpoint)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.method).toBe('x402')
      expect((result as { ok: true; method: 'x402'; x402: { payer: string } }).x402.payer).toBe('0xAGENT')
    }
  })

  it('returns 402 with PAYMENT-REQUIRED header when no auth provided', async () => {
    const headers = new Headers()
    const result = await authenticateHybrid(headers, endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.status).toBe(402)
      expect(result.error.headers.get('PAYMENT-REQUIRED')).toBeTruthy()
    }
  })

  it('returns 402 when x402 verification fails', async () => {
    const fakePayload = { x402Version: 2, payload: {} }
    const paymentHeader = Buffer.from(JSON.stringify(fakePayload)).toString('base64')

    vi.mocked(verifyX402Payment).mockResolvedValue({ valid: false, error: 'bad sig' })

    const headers = new Headers({ 'X-PAYMENT': paymentHeader })
    const result = await authenticateHybrid(headers, endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.status).toBe(402)
    }
  })

  it('returns 402 when x402 settlement fails', async () => {
    const fakePayload = { x402Version: 2, payload: {} }
    const paymentHeader = Buffer.from(JSON.stringify(fakePayload)).toString('base64')

    vi.mocked(verifyX402Payment).mockResolvedValue({ valid: true, payer: '0xAGENT' })
    vi.mocked(settleX402Payment).mockResolvedValue({ success: false, error: 'no funds' })

    const headers = new Headers({ 'X-PAYMENT': paymentHeader })
    const result = await authenticateHybrid(headers, endpoint)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.status).toBe(402)
    }
  })
})

describe('buildHybridHeaders', () => {
  it('returns rate limit headers for API key auth', () => {
    const h = buildHybridHeaders({
      ok: true,
      method: 'api-key',
      keyId: 'k1',
      rateLimit: { limited: false, remaining: 99, limit: 100, resetAt: '2026-02-17T00:00:00.000Z' },
    })
    expect(h['X-RateLimit-Limit']).toBe('100')
  })

  it('returns payment headers for x402 auth', () => {
    const h = buildHybridHeaders({
      ok: true,
      method: 'x402',
      x402: { payer: '0xAGENT', transaction: '0xTX', authMethod: 'x402' },
    })
    expect(h['X-Payment-Method']).toBe('x402')
    expect(h['X-Payment-Tx']).toBe('0xTX')
  })
})
