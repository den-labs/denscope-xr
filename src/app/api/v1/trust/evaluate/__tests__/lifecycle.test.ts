/**
 * Economic safety regressions for the paid evaluate resource.
 *
 * These run against the real route handler, not a reimplementation of it, so
 * they assert the lifecycle that actually ships. The single claim they defend:
 *
 *   money moves only after a result exists.
 *
 * Before this remediation, `authenticateHybrid` settled as the first statement
 * of the handler, so every case below took real USDC on Celo mainnet and
 * returned an error (SEC-01). No test here touches a network or a chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/x402/config', () => ({
  x402Config: {
    payTo: '0xPAYTO',
    network: 'eip155:42220',
    assetAddress: '0xUSDC',
    assetName: 'USD Coin',
    resourceBaseUrl: () => 'https://www.denscope.xyz',
    facilitatorUrl: 'https://facilitator.test',
    pricing: { evaluate: 0.001, score: 0.001, signals: 0.0005 },
  },
  isX402Enabled: () => true,
}))

vi.mock('@/lib/api-keys/authenticate', () => ({
  extractApiKey: vi.fn(() => null),
  authenticateApiKey: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))

vi.mock('@/lib/x402/facilitator', () => ({
  verifyX402Payment: vi.fn(),
  settleX402Payment: vi.fn(),
}))

vi.mock('@/lib/x402/verify-limit', () => ({ consumeVerifyAttempt: vi.fn() }))

vi.mock('@/lib/x402/idempotency', () => ({
  lookupDeliveredResult: vi.fn(),
  storeDeliveredResult: vi.fn(),
}))

vi.mock('@/lib/x402/payments', () => ({ recordX402Payment: vi.fn(async () => undefined) }))
vi.mock('@/lib/trustops/log', () => ({ recordEvaluation: vi.fn(async () => undefined) }))
vi.mock('@/lib/evaluation/compose', () => ({ composeEvaluation: vi.fn() }))

import { POST } from '../route'
import { verifyX402Payment, settleX402Payment } from '@/lib/x402/facilitator'
import { consumeVerifyAttempt } from '@/lib/x402/verify-limit'
import { lookupDeliveredResult, storeDeliveredResult } from '@/lib/x402/idempotency'
import { composeEvaluation } from '@/lib/evaluation/compose'

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

function paidRequest(body: unknown): NextRequest {
  return new NextRequest('https://www.denscope.xyz/api/v1/trust/evaluate', {
    method: 'POST',
    headers: {
      'X-PAYMENT': paymentHeader(),
      'x-real-ip': '203.0.113.7',
      'content-type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID_BODY = { chainId: 42220, agentId: 5, preset: 'defi_counterparty' }

const EVALUATION = {
  evaluation: {
    recommended_action: 'review',
    trust_band: 'medium',
    risk_level: 'moderate',
    rationale: 'Agent scores 58/100 …',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consumeVerifyAttempt).mockResolvedValue({
    allowed: true, count: 1, limit: 30, retryAfterSeconds: 60, available: true,
  })
  vi.mocked(verifyX402Payment).mockResolvedValue({ valid: true, payer: PAYER })
  vi.mocked(lookupDeliveredResult).mockResolvedValue({ available: true, result: null })
  vi.mocked(storeDeliveredResult).mockResolvedValue({ stored: true, duplicate: false })
  vi.mocked(settleX402Payment).mockResolvedValue({ success: true, transaction: '0xTX', payer: PAYER })
  vi.mocked(composeEvaluation).mockResolvedValue(EVALUATION as never)
})

// R1 — malformed body
describe('R1 — malformed request with a valid payment', () => {
  it('returns 400 for unparseable JSON and settles nothing', async () => {
    const response = await POST(paidRequest('{not json'))

    expect(response.status).toBe(400)
    expect(settleX402Payment).not.toHaveBeenCalled()
    expect(composeEvaluation).not.toHaveBeenCalled()
  })

  it('returns 400 for a body missing chainId/agentId and settles nothing', async () => {
    const response = await POST(paidRequest({ nope: 1 }))

    expect(response.status).toBe(400)
    expect(settleX402Payment).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid preset and settles nothing', async () => {
    const response = await POST(paidRequest({ chainId: 42220, agentId: 5, preset: 'made_up' }))

    expect(response.status).toBe(400)
    expect(settleX402Payment).not.toHaveBeenCalled()
  })

  it('returns 400 for an oversized context hint and settles nothing', async () => {
    const response = await POST(paidRequest({ ...VALID_BODY, context: 'x'.repeat(513) }))

    expect(response.status).toBe(400)
    expect(settleX402Payment).not.toHaveBeenCalled()
  })
})

// R2 — invalid business target
describe('R2 — valid payment against an unknown agent', () => {
  it('returns 404 and settles nothing', async () => {
    vi.mocked(composeEvaluation).mockRejectedValue(new Error('Agent not found'))

    const response = await POST(paidRequest(VALID_BODY))

    expect(response.status).toBe(404)
    expect(settleX402Payment).not.toHaveBeenCalled()
    expect(storeDeliveredResult).not.toHaveBeenCalled()
  })
})

// R3 — computation failure
describe('R3 — valid payment, computation fails', () => {
  it('returns 500 and settles nothing', async () => {
    vi.mocked(composeEvaluation).mockRejectedValue(new Error('supabase timeout'))

    const response = await POST(paidRequest(VALID_BODY))

    expect(response.status).toBe(500)
    expect(settleX402Payment).not.toHaveBeenCalled()
    expect(storeDeliveredResult).not.toHaveBeenCalled()
  })

  it('does not leak the internal failure message to the caller', async () => {
    vi.mocked(composeEvaluation).mockRejectedValue(new Error('supabase timeout at 10.0.0.4'))

    const response = await POST(paidRequest(VALID_BODY))

    await expect(response.json()).resolves.toEqual({ error: 'Evaluation failed' })
  })
})

// R4 — successful paid lifecycle
describe('R4 — successful paid lifecycle', () => {
  it('verifies, computes, settles, persists and returns the result in that order', async () => {
    const response = await POST(paidRequest(VALID_BODY))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(EVALUATION)
    expect(response.headers.get('X-Payment-Tx')).toBe('0xTX')

    const order = (m: { mock: { invocationCallOrder: number[] } }) => m.mock.invocationCallOrder[0]
    expect(order(vi.mocked(verifyX402Payment))).toBeLessThan(order(vi.mocked(composeEvaluation)))
    expect(order(vi.mocked(composeEvaluation))).toBeLessThan(order(vi.mocked(settleX402Payment)))
    expect(order(vi.mocked(settleX402Payment))).toBeLessThan(order(vi.mocked(storeDeliveredResult)))
  })

  it('returns 402 without a result when settlement itself fails', async () => {
    vi.mocked(settleX402Payment).mockResolvedValue({ success: false, error: 'no funds' })

    const response = await POST(paidRequest(VALID_BODY))

    expect(response.status).toBe(402)
    expect(storeDeliveredResult).not.toHaveBeenCalled()
  })
})

// R5 — replay at the route boundary
describe('R5 — replayed payment', () => {
  it('returns the stored result without recomputing or re-settling', async () => {
    vi.mocked(lookupDeliveredResult).mockResolvedValue({
      available: true,
      result: { status: 200, body: EVALUATION, txHash: '0xTX' },
    })

    const response = await POST(paidRequest(VALID_BODY))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Payment-Replay')).toBe('true')
    await expect(response.json()).resolves.toEqual(EVALUATION)
    expect(composeEvaluation).not.toHaveBeenCalled()
    expect(settleX402Payment).not.toHaveBeenCalled()
  })
})

// R6/R7 at the route boundary
describe('R6/R7 — abuse controls reach the route', () => {
  it('rejects a malformed X-PAYMENT without calling the facilitator', async () => {
    const request = new NextRequest('https://www.denscope.xyz/api/v1/trust/evaluate', {
      method: 'POST',
      headers: { 'X-PAYMENT': 'garbage!!', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })

    const response = await POST(request)

    expect(response.status).toBe(402)
    expect(verifyX402Payment).not.toHaveBeenCalled()
    expect(consumeVerifyAttempt).not.toHaveBeenCalled()
  })

  it('returns 429 when the verification limit is exceeded', async () => {
    vi.mocked(consumeVerifyAttempt).mockResolvedValue({
      allowed: false, count: 31, limit: 30, retryAfterSeconds: 12, available: true,
    })

    const response = await POST(paidRequest(VALID_BODY))

    expect(response.status).toBe(429)
    expect(verifyX402Payment).not.toHaveBeenCalled()
  })
})

// R10 — no payment parameter is caller-controlled
describe('R10 — payment parameters are server-derived', () => {
  it('ignores amount, payTo, network, asset and facilitator supplied by the caller', async () => {
    const request = new NextRequest(
      'https://www.denscope.xyz/api/v1/trust/evaluate?payTo=0xATTACKER&amount=1',
      {
        method: 'POST',
        headers: {
          'X-PAYMENT': paymentHeader(),
          'x-real-ip': '203.0.113.7',
          'content-type': 'application/json',
          'X-Payment-PayTo': '0xATTACKER',
          'X-Payment-Amount': '1',
          'X-Payment-Network': 'eip155:1',
          'X-Payment-Asset': '0xATTACKERTOKEN',
          'X-Payment-Facilitator': 'https://facilitator.attacker.example',
        },
        body: JSON.stringify({
          ...VALID_BODY,
          payTo: '0xATTACKER',
          amount: '1',
          network: 'eip155:1',
          asset: '0xATTACKERTOKEN',
          facilitatorUrl: 'https://facilitator.attacker.example',
        }),
      },
    )

    await POST(request)

    const requirements = vi.mocked(verifyX402Payment).mock.calls[0][1]
    expect(requirements).toMatchObject({
      payTo: '0xPAYTO',
      amount: '1000',
      network: 'eip155:42220',
      asset: '0xUSDC',
      scheme: 'exact',
    })
    expect(vi.mocked(settleX402Payment).mock.calls[0][1]).toMatchObject({
      payTo: '0xPAYTO',
      amount: '1000',
    })
  })
})
