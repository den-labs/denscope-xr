// @vitest-environment node
//
// Stellar replay recovery (R1-R7).
//
// The payable testnet E2E settled correctly but could not RECOVER: re-sending
// the exact already-settled payment returned 402 instead of the result it had
// bought, because the facilitator re-simulates a transaction whose
// authorisation has been spent and verification refuses before the keyed lookup
// is reached. These tests pin the fix and the safety limits around it.
//
// R8-R10 are database properties and are proven against real PostgreSQL in
// docs/audits/2026-08-20-stellar-replay-migration-review.md.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  Keypair,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  Networks,
} from '@stellar/stellar-sdk'

const BUYER = 'GBNFR7NL4IZ2HNDKGYE7YYY4R4ULODIQQAFWYZUIRLAQVCUUJEZI3QOD'
const CONSUMED = 'invalid_exact_stellar_payload_simulation_failed'

vi.mock('@/config/site', () => ({ siteUrl: () => 'https://www.denscope.xyz' }))

vi.mock('@/lib/x402/config', () => ({
  x402Config: {
    payTo: '0xPAYTO',
    network: 'eip155:42220',
    assetAddress: '0xUSDC',
    assetName: 'USD Coin',
    resourceBaseUrl: () => 'https://www.denscope.xyz',
    facilitatorUrl: 'https://facilitator.ultravioletadao.xyz',
    pricing: { evaluate: 0.001, score: 0.001, signals: 0.0005 },
  },
  isX402Enabled: () => true,
  isStellarRailEnabled: () => true,
  stellarConfig: {
    payTo: 'GC4I5CKZ2MLRSMTHOEHVYMFDYVTKEQ3LCUKXCJ7ZWL43PKRSOCFHO4XP',
    network: 'stellar:testnet',
    facilitatorUrl: 'https://facilitator.testnet.x402seek.xyz',
    price: 0.001,
  },
  facilitatorGuard: () => ({
    ok: true,
    url: 'https://facilitator.testnet.x402seek.xyz',
    host: 'facilitator.testnet.x402seek.xyz',
  }),
  FACILITATOR_TIMEOUT_MS: 15_000,
}))

const verify = vi.hoisted(() => vi.fn())
const settle = vi.hoisted(() => vi.fn())

vi.mock('@x402/core/server', () => ({
  HTTPFacilitatorClient: class {
    verify = verify
    settle = settle
  },
}))

vi.mock('@/lib/api-keys/authenticate', () => ({
  extractApiKey: vi.fn(() => null),
  authenticateApiKey: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/x402/verify-limit', () => ({ consumeVerifyAttempt: vi.fn() }))
vi.mock('@/lib/x402/idempotency', () => ({
  lookupDeliveredResult: vi.fn(),
  lookupDeliveredByPayment: vi.fn(),
  storeDeliveredResult: vi.fn(),
}))
vi.mock('@/lib/x402/payments', () => ({ recordX402Payment: vi.fn(async () => undefined) }))
vi.mock('@/lib/trustops/log', () => ({ recordEvaluation: vi.fn(async () => undefined) }))
vi.mock('@/lib/evaluation/compose', () => ({ composeEvaluation: vi.fn() }))

import { POST } from '@/app/api/v1/trust/evaluate/route'
import { consumeVerifyAttempt } from '@/lib/x402/verify-limit'
import {
  lookupDeliveredResult,
  lookupDeliveredByPayment,
  storeDeliveredResult,
} from '@/lib/x402/idempotency'
import { composeEvaluation } from '@/lib/evaluation/compose'

function envelope(seq = '1'): string {
  const kp = Keypair.random()
  const tx = new TransactionBuilder(new Account(kp.publicKey(), seq), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: '0.001',
      }),
    )
    .setTimeout(300)
    .build()
  tx.sign(kp)
  return tx.toEnvelope().toXDR('base64')
}

const FIXED = envelope()
const paymentHeader = Buffer.from(
  JSON.stringify({ x402Version: 2, payload: { transaction: FIXED } }),
).toString('base64')

function request(header: string = paymentHeader): NextRequest {
  return new NextRequest('https://www.denscope.xyz/api/v1/trust/evaluate', {
    method: 'POST',
    headers: {
      'X-PAYMENT': header,
      'x-real-ip': '203.0.113.7',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ chainId: 42220, agentId: 1, preset: 'default_safety' }),
  })
}

const STORED = { evaluation: { recommended_action: 'allow', chainId: 42220, agentId: 1 } }

beforeEach(() => {
  vi.clearAllMocks()
  // mockReset, not just clear: a test that queues two mockResolvedValueOnce but
  // consumes one would otherwise leak the leftover into the next test as a
  // phantom replay HIT.
  vi.mocked(lookupDeliveredByPayment).mockReset()
  vi.mocked(consumeVerifyAttempt).mockResolvedValue({
    allowed: true, count: 1, limit: 30, retryAfterSeconds: 60, available: true,
  })
  vi.mocked(lookupDeliveredByPayment).mockResolvedValue({ available: true, result: null })
  vi.mocked(lookupDeliveredResult).mockResolvedValue({ available: true, result: null })
  vi.mocked(storeDeliveredResult).mockResolvedValue({ stored: true, duplicate: false })
  verify.mockResolvedValue({ isValid: true, payer: BUYER })
  settle.mockResolvedValue({ success: true, transaction: 'tx' })
  vi.mocked(composeEvaluation).mockResolvedValue(STORED as never)
})

describe('R1 — pre-verify replay HIT', () => {
  it('returns the stored result without verifying, computing or settling', async () => {
    vi.mocked(lookupDeliveredByPayment).mockResolvedValue({
      available: true,
      result: { status: 200, body: STORED, txHash: 'tx' },
    })

    const res = await POST(request())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(STORED)
    expect(res.headers.get('X-Payment-Replay')).toBe('true')
    expect(verify).not.toHaveBeenCalled()
    expect(settle).not.toHaveBeenCalled()
    expect(composeEvaluation).not.toHaveBeenCalled()
  })

  it('looks up by configured network + fingerprint + endpoint, and no payer', async () => {
    vi.mocked(lookupDeliveredByPayment).mockResolvedValue({
      available: true,
      result: { status: 200, body: STORED, txHash: 'tx' },
    })
    await POST(request())

    const key = vi.mocked(lookupDeliveredByPayment).mock.calls[0][0]
    expect(key.network).toBe('stellar:testnet')
    expect(key.endpoint).toBe('/api/v1/trust/evaluate')
    expect(key.paymentId).toMatch(/^[0-9a-f]{64}$/)
    expect(key).not.toHaveProperty('payer')
  })
})

describe('R2 — pre-verify replay MISS', () => {
  it('falls through to the normal first-payment path', async () => {
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(consumeVerifyAttempt).toHaveBeenCalled()
    expect(verify).toHaveBeenCalled()
    expect(composeEvaluation).toHaveBeenCalled()
    expect(settle).toHaveBeenCalled()
  })

  it('still fails closed when the verified-path store is unavailable', async () => {
    vi.mocked(lookupDeliveredResult).mockResolvedValue({ available: false })
    const res = await POST(request())
    expect(res.status).toBe(503)
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('R3 — endpoint binding', () => {
  it('scopes the lookup to the endpoint being requested', async () => {
    // A fingerprint that bought a different resource must not satisfy this one.
    // The endpoint travels in the query, so a mismatch is a miss at the DB.
    await POST(request())
    expect(vi.mocked(lookupDeliveredByPayment).mock.calls[0][0].endpoint).toBe(
      '/api/v1/trust/evaluate',
    )
  })

  it('treats a mismatch as a miss rather than serving the other result', async () => {
    vi.mocked(lookupDeliveredByPayment).mockResolvedValue({ available: true, result: null })
    const res = await POST(request())
    // Falls through to the paid path; it does not hand back someone else's result.
    expect(res.status).toBe(200)
    expect(verify).toHaveBeenCalled()
  })
})

describe('R4 — malformed payload dies locally', () => {
  it('never reaches the DB lookup or the facilitator', async () => {
    const res = await POST(request('not-a-valid-payment-payload!!!'))
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ error: 'payment_malformed' })
    expect(lookupDeliveredByPayment).not.toHaveBeenCalled()
    expect(verify).not.toHaveBeenCalled()
    expect(settle).not.toHaveBeenCalled()
  })

  it('rejects an unparseable envelope before any lookup', async () => {
    const bad = Buffer.from(
      JSON.stringify({ x402Version: 2, payload: { transaction: 'AAAA-nope' } }),
    ).toString('base64')
    const res = await POST(request(bad))
    expect(res.status).toBe(402)
    expect(lookupDeliveredByPayment).not.toHaveBeenCalled()
  })
})

describe('R6 — lost-response race recovery', () => {
  it('recovers when verification reports the payment as already consumed', async () => {
    // Pre-verify missed; a concurrent request settled in the meantime.
    vi.mocked(lookupDeliveredByPayment)
      .mockResolvedValueOnce({ available: true, result: null })
      .mockResolvedValueOnce({ available: true, result: { status: 200, body: STORED, txHash: 'tx' } })
    verify.mockResolvedValue({ isValid: false, invalidReason: CONSUMED })

    const res = await POST(request())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(STORED)
    expect(res.headers.get('X-Payment-Replay')).toBe('true')
    expect(settle).not.toHaveBeenCalled()
    expect(composeEvaluation).not.toHaveBeenCalled()
    expect(lookupDeliveredByPayment).toHaveBeenCalledTimes(2)
  })

  it('does NOT treat an unrelated verification failure as a replay', async () => {
    // Only the consumed-payment reason is eligible. Anything else must refuse,
    // or an unsettled payment could collect someone's stored result.
    vi.mocked(lookupDeliveredByPayment)
      .mockResolvedValueOnce({ available: true, result: null })
      .mockResolvedValueOnce({ available: true, result: { status: 200, body: STORED, txHash: 'tx' } })
    verify.mockResolvedValue({ isValid: false, invalidReason: 'insufficient_funds' })

    const res = await POST(request())

    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ error: 'payment_invalid' })
    expect(lookupDeliveredByPayment).toHaveBeenCalledTimes(1)
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('R7 — eligible failure, no stored result', () => {
  it('fails closed and settles nothing', async () => {
    vi.mocked(lookupDeliveredByPayment).mockResolvedValue({ available: true, result: null })
    verify.mockResolvedValue({ isValid: false, invalidReason: CONSUMED })

    const res = await POST(request())

    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ error: 'payment_invalid', reason: CONSUMED })
    expect(settle).not.toHaveBeenCalled()
    expect(composeEvaluation).not.toHaveBeenCalled()
  })

  it('does not retry settlement when the recovery store is unavailable', async () => {
    vi.mocked(lookupDeliveredByPayment).mockResolvedValue({ available: false })
    verify.mockResolvedValue({ isValid: false, invalidReason: CONSUMED })

    const res = await POST(request())
    expect(res.status).toBe(402)
    expect(settle).not.toHaveBeenCalled()
  })
})
