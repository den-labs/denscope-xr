// @vitest-environment node
//
// The same economic-safety claim as lifecycle.test.ts — money moves only after a
// result exists — asserted against the STELLAR rail rather than the EVM one.
//
// These run through the real route handler and the real middleware, so what is
// under test is the shipped lifecycle with a different rail plugged in. Nothing
// here touches a network, a chain or a facilitator: the facilitator client is
// mocked, and every Stellar envelope is a locally signed testnet fixture that is
// never submitted anywhere.

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

const PAY_TO = 'GDX6H6PL2DYMYW5UUZ6GGUD7UNCCHO6HNQMQDGQM4AMVP3LDGUZ2ZEMQ'
const BUYER = 'GA5QFL3M7DF3JVPZDBA7VPV6UWQ5274N4QJ6556GBORXDWMNY5BZR2US'

vi.mock('@/config/site', () => ({ siteUrl: () => 'https://www.denscope.xyz' }))

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
  // THE difference from lifecycle.test.ts.
  isStellarRailEnabled: () => true,
  stellarConfig: {
    payTo: 'GDX6H6PL2DYMYW5UUZ6GGUD7UNCCHO6HNQMQDGQM4AMVP3LDGUZ2ZEMQ',
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
  storeDeliveredResult: vi.fn(),
}))
vi.mock('@/lib/x402/payments', () => ({ recordX402Payment: vi.fn(async () => undefined) }))
vi.mock('@/lib/trustops/log', () => ({ recordEvaluation: vi.fn(async () => undefined) }))
vi.mock('@/lib/evaluation/compose', () => ({ composeEvaluation: vi.fn() }))

import { POST } from '../route'
import { consumeVerifyAttempt } from '@/lib/x402/verify-limit'
import { lookupDeliveredResult, storeDeliveredResult } from '@/lib/x402/idempotency'
import { composeEvaluation } from '@/lib/evaluation/compose'

/** Locally signed testnet envelope. Never submitted. */
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

const FIXED_ENVELOPE = envelope()

function paymentHeader(xdr = FIXED_ENVELOPE): string {
  return Buffer.from(
    JSON.stringify({ x402Version: 2, payload: { transaction: xdr } }),
  ).toString('base64')
}

function paidRequest(body: unknown, header = paymentHeader()): NextRequest {
  return new NextRequest('https://www.denscope.xyz/api/v1/trust/evaluate', {
    method: 'POST',
    headers: {
      'X-PAYMENT': header,
      'x-real-ip': '203.0.113.7',
      'content-type': 'application/json',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID_BODY = { chainId: 42220, agentId: 5, preset: 'defi_counterparty' }
const EVALUATION = { evaluation: { recommended_action: 'review', chainId: 42220, agentId: 5 } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consumeVerifyAttempt).mockResolvedValue({
    allowed: true,
    count: 1,
    limit: 30,
    retryAfterSeconds: 60,
    available: true,
  })
  vi.mocked(lookupDeliveredResult).mockResolvedValue({ available: true, result: null })
  vi.mocked(storeDeliveredResult).mockResolvedValue({ stored: true, duplicate: false })
  verify.mockResolvedValue({ isValid: true, payer: BUYER })
  settle.mockResolvedValue({ success: true, transaction: 'stellar-tx-hash', network: 'stellar:testnet' })
})

// ---------------------------------------------------------------------------
describe('S1 — unpaid request advertises the Stellar resource', () => {
  it('returns 402 with stellar:testnet requirements and no settlement', async () => {
    const res = await POST(
      new NextRequest('https://www.denscope.xyz/api/v1/trust/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nope: 1 }),
      }),
    )
    expect(res.status).toBe(402)
    const body = (await res.json()) as { accepts: Record<string, string>[] }
    expect(body.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: 'stellar:testnet',
      amount: '10000',
      payTo: PAY_TO,
    })
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy()
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('S2 — invalid body with a verified payment', () => {
  it.each([
    ['missing chainId/agentId', { preset: 'defi_counterparty' }],
    ['invalid preset', { chainId: 42220, agentId: 5, preset: 'nope' }],
    ['oversized context', { ...VALID_BODY, context: 'x'.repeat(513) }],
    ['unparseable JSON', '{not json'],
  ])('returns 400 for %s and settles nothing', async (_label, body) => {
    const res = await POST(paidRequest(body))
    expect(res.status).toBe(400)
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('S3 — verified payment, unknown agent', () => {
  it('returns 404 and settles nothing', async () => {
    vi.mocked(composeEvaluation).mockRejectedValue(new Error('Agent not found'))
    const res = await POST(paidRequest(VALID_BODY))
    expect(res.status).toBe(404)
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('S4 — verified payment, computation fails', () => {
  it('returns 500, settles nothing and leaks no internal detail', async () => {
    vi.mocked(composeEvaluation).mockRejectedValue(new Error('supabase exploded: dsn=secret'))
    const res = await POST(paidRequest(VALID_BODY))
    expect(res.status).toBe(500)
    expect(settle).not.toHaveBeenCalled()
    expect(JSON.stringify(await res.json())).not.toContain('secret')
  })
})

describe('S5 — successful paid lifecycle', () => {
  it('verifies, computes, settles, persists and returns the result IN THAT ORDER', async () => {
    const order: string[] = []
    verify.mockImplementation(async () => {
      order.push('verify')
      return { isValid: true, payer: BUYER }
    })
    vi.mocked(composeEvaluation).mockImplementation(async () => {
      order.push('compute')
      return EVALUATION as never
    })
    settle.mockImplementation(async () => {
      order.push('settle')
      return { success: true, transaction: 'stellar-tx-hash' }
    })
    vi.mocked(storeDeliveredResult).mockImplementation(async () => {
      order.push('persist')
      return { stored: true, duplicate: false }
    })

    const res = await POST(paidRequest(VALID_BODY))

    expect(res.status).toBe(200)
    expect(order).toEqual(['verify', 'compute', 'settle', 'persist'])
    expect(await res.json()).toEqual(EVALUATION)
  })

  it('persists the identity as network + CONFIRMED payer + canonical fingerprint', async () => {
    vi.mocked(composeEvaluation).mockResolvedValue(EVALUATION as never)
    await POST(paidRequest(VALID_BODY))

    const call = vi.mocked(storeDeliveredResult).mock.calls[0][0]
    expect(call.id.network).toBe('stellar:testnet')
    // Verbatim: `G…` strkeys are case-sensitive.
    expect(call.id.payer).toBe(BUYER)
    expect(call.id.paymentId).toMatch(/^[0-9a-f]{64}$/)
    // 7-decimal atomic units, taken from the advertised requirements.
    expect(call.amountMicro).toBe(10000)
  })

  it('returns 402 without a result when settlement itself fails', async () => {
    vi.mocked(composeEvaluation).mockResolvedValue(EVALUATION as never)
    settle.mockResolvedValue({ success: false, errorReason: 'insufficient_funds' })

    const res = await POST(paidRequest(VALID_BODY))
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ error: 'payment_failed' })
  })

  it('refuses when verification confirms no payer', async () => {
    // No claimed-payer fallback exists on this rail. Guessing here would key a
    // replay lookup on an address nobody confirmed.
    verify.mockResolvedValue({ isValid: true })
    const res = await POST(paidRequest(VALID_BODY))
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ error: 'payment_unattributable' })
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('S6 — replay', () => {
  it('serves the stored result and settles nothing a second time', async () => {
    vi.mocked(lookupDeliveredResult).mockResolvedValue({
      available: true,
      result: { status: 200, body: EVALUATION, txHash: 'stellar-tx-hash' },
    })

    const res = await POST(paidRequest(VALID_BODY))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(EVALUATION)
    expect(res.headers.get('X-Payment-Replay')).toBe('true')
    expect(settle).not.toHaveBeenCalled()
    expect(composeEvaluation).not.toHaveBeenCalled()
  })

  it('looks up the replay ONLY after verification has confirmed the payer', async () => {
    const order: string[] = []
    verify.mockImplementation(async () => {
      order.push('verify')
      return { isValid: true, payer: BUYER }
    })
    vi.mocked(lookupDeliveredResult).mockImplementation(async () => {
      order.push('lookup')
      return { available: true, result: null }
    })
    vi.mocked(composeEvaluation).mockResolvedValue(EVALUATION as never)

    await POST(paidRequest(VALID_BODY))

    expect(order).toEqual(['verify', 'lookup'])
  })

  it('fails closed with 503 when the result store cannot be consulted', async () => {
    vi.mocked(lookupDeliveredResult).mockResolvedValue({ available: false })
    const res = await POST(paidRequest(VALID_BODY))
    expect(res.status).toBe(503)
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('S7 — malformed payment never reaches the facilitator', () => {
  it('rejects locally with no verify call', async () => {
    const res = await POST(paidRequest(VALID_BODY, 'not-a-valid-payment-payload!!!'))
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ error: 'payment_malformed' })
    expect(verify).not.toHaveBeenCalled()
    expect(settle).not.toHaveBeenCalled()
  })

  it('sends the server-derived requirements to the facilitator, not the caller-supplied ones', async () => {
    vi.mocked(composeEvaluation).mockResolvedValue(EVALUATION as never)
    const hostile = Buffer.from(
      JSON.stringify({
        x402Version: 2,
        accepted: { amount: '1', payTo: 'GATTACKER', network: 'stellar:pubnet' },
        payload: { transaction: FIXED_ENVELOPE },
      }),
    ).toString('base64')

    await POST(paidRequest(VALID_BODY, hostile))

    const requirements = verify.mock.calls[0][1]
    expect(requirements).toMatchObject({
      amount: '10000',
      payTo: PAY_TO,
      network: 'stellar:testnet',
    })
  })
})
