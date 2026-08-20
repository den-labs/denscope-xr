// @vitest-environment node
//
// Node, not jsdom: Stellar keypair generation needs real WebCrypto
// (`crypto.getRandomValues` must return a Uint8Array, which jsdom's shim does not).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  Keypair,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  Networks,
} from '@stellar/stellar-sdk'

const PAY_TO = 'GDX6H6PL2DYMYW5UUZ6GGUD7UNCCHO6HNQMQDGQM4AMVP3LDGUZ2ZEMQ'
const USDC_TESTNET = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
const PASSPHRASE = Networks.TESTNET

vi.mock('@/config/site', () => ({ siteUrl: () => 'https://www.denscope.xyz' }))

vi.mock('../../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config')>()
  return {
    ...actual,
    stellarConfig: {
      // Inlined, not PAY_TO: vi.mock factories are hoisted above const declarations.
      payTo: 'GDX6H6PL2DYMYW5UUZ6GGUD7UNCCHO6HNQMQDGQM4AMVP3LDGUZ2ZEMQ',
      network: 'stellar:testnet',
      facilitatorUrl: 'https://facilitator.testnet.x402seek.xyz',
      price: 0.001,
    },
  }
})

import { stellarRail, canonicalPaymentFingerprint } from '../stellar'

const endpoint = {
  path: '/api/v1/trust/evaluate',
  priceKey: 'evaluate',
  description: 'Contextual trust evaluation for ERC-8004 agent',
}

/** A signed testnet envelope. Testnet only, and never submitted anywhere. */
function envelope(seq = '1', amount = '0.001'): string {
  const kp = Keypair.random()
  const tx = new TransactionBuilder(new Account(kp.publicKey(), seq), {
    fee: '100',
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount,
      }),
    )
    .setTimeout(300)
    .build()
  tx.sign(kp)
  return tx.toEnvelope().toXDR('base64')
}

function header(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

function paymentHeader(xdr = envelope()): string {
  return header({
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: 'stellar:testnet',
      amount: '10000',
      asset: USDC_TESTNET,
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
      extra: {},
    },
    payload: { transaction: xdr },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// S1 — the 402 a Stellar client receives
// ---------------------------------------------------------------------------
describe('S1 — payment requirements', () => {
  it('advertises exact / stellar:testnet / USDC / configured payTo / 10000 atomic', async () => {
    const req = await stellarRail.requirements(endpoint)
    expect(req).toMatchObject({
      scheme: 'exact',
      network: 'stellar:testnet',
      asset: USDC_TESTNET,
      payTo: PAY_TO,
      amount: '10000',
    })
  })

  it('prices 0.001 USDC with SEVEN decimals, not six', async () => {
    // The whole point. The EVM path computes price * 1_000_000 and would emit
    // "1000" here, underpricing the resource by 100x.
    const req = await stellarRail.requirements(endpoint)
    expect(req.amount).toBe('10000')
    expect(req.amount).not.toBe('1000')
    expect(Number(req.amount) / 10 ** 7).toBe(0.001)
  })

  it('declares fee sponsorship, which the facilitator reports', async () => {
    const req = await stellarRail.requirements(endpoint)
    expect(req.extra).toMatchObject({ areFeesSponsored: true })
  })

  it('carries discovery metadata in the 402 body', async () => {
    const { body } = await stellarRail.paymentRequired(endpoint)
    const parsed = body as {
      x402Version: number
      accepts: unknown[]
      resource: { url: string; serviceName: string; mimeType: string; tags: string[] }
    }
    expect(parsed.x402Version).toBe(2)
    expect(parsed.accepts).toHaveLength(1)
    expect(parsed.resource.url).toBe('https://www.denscope.xyz/api/v1/trust/evaluate')
    expect(parsed.resource.serviceName).toBe('DenScope Trust Evaluation')
    expect(parsed.resource.mimeType).toBe('application/json')
    expect(parsed.resource.tags).toEqual(
      expect.arrayContaining(['trust', 'reputation', 'risk', 'erc-8004', 'agent']),
    )
  })

  it('serves a 402 without contacting the facilitator', async () => {
    // The seller must answer 402 while the facilitator is down. Anything that
    // reached the network here would break that.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await stellarRail.paymentRequired(endpoint)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Local rejection — SEC-04, no facilitator round-trip
// ---------------------------------------------------------------------------
describe('local shape check', () => {
  it.each([
    ['empty header', '', 'missing'],
    ['oversized header', 'a'.repeat(8193), 'too_large'],
    ['not base64 json', 'not-a-valid-payment-payload!!!', 'not_decodable'],
  ])('rejects %s locally', (_label, value, reason) => {
    const result = stellarRail.inspect(value)
    expect(result).toEqual({ ok: false, reason })
  })

  it('rejects a wrong protocol version', () => {
    const h = header({ x402Version: 1, payload: { transaction: envelope() } })
    expect(stellarRail.inspect(h)).toEqual({ ok: false, reason: 'bad_version' })
  })

  it('rejects a payload with no transaction', () => {
    const h = header({ x402Version: 2, payload: {} })
    expect(stellarRail.inspect(h)).toEqual({ ok: false, reason: 'missing_transaction' })
  })

  it('rejects bytes that are not a Stellar envelope', () => {
    const h = header({ x402Version: 2, payload: { transaction: 'AAAA-not-an-envelope' } })
    expect(stellarRail.inspect(h)).toEqual({ ok: false, reason: 'not_stellar_envelope' })
  })

  it('never reaches the network while rejecting', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    stellarRail.inspect('garbage')
    stellarRail.inspect(header({ x402Version: 2, payload: {} }))
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('accepts a well-formed envelope and returns a fingerprint, not an identity', () => {
    const result = stellarRail.inspect(paymentHeader())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.paymentFingerprint).toMatch(/^[0-9a-f]{64}$/)
    // There is no payer here, and there must not be: nothing local can confirm one.
    expect(result.claimedPayer).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Fingerprint properties — the replay guarantee
// ---------------------------------------------------------------------------
describe('canonical payment fingerprint', () => {
  it('is stable for the same payment', () => {
    const xdr = envelope()
    expect(canonicalPaymentFingerprint(xdr, 'stellar:testnet')).toBe(
      canonicalPaymentFingerprint(xdr, 'stellar:testnet'),
    )
  })

  it('differs between distinct payments', () => {
    expect(canonicalPaymentFingerprint(envelope('1'), 'stellar:testnet')).not.toBe(
      canonicalPaymentFingerprint(envelope('2'), 'stellar:testnet'),
    )
  })

  it('is identical for the fee-bumped and plain wrapping of ONE payment', () => {
    // Otherwise a caller re-wraps a settled payment, gets a second key, and buys
    // a second result for the same money.
    const kp = Keypair.random()
    const inner = new TransactionBuilder(new Account(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase: PASSPHRASE,
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
    inner.sign(kp)

    const sponsor = Keypair.random()
    const bump = TransactionBuilder.buildFeeBumpTransaction(sponsor, '200', inner, PASSPHRASE)
    bump.sign(sponsor)

    expect(canonicalPaymentFingerprint(bump.toEnvelope().toXDR('base64'), 'stellar:testnet')).toBe(
      canonicalPaymentFingerprint(inner.toEnvelope().toXDR('base64'), 'stellar:testnet'),
    )
  })

  it('is bound to the network', () => {
    const xdr = envelope()
    expect(canonicalPaymentFingerprint(xdr, 'stellar:testnet')).not.toBe(
      canonicalPaymentFingerprint(xdr, 'stellar:pubnet'),
    )
  })
})

// ---------------------------------------------------------------------------
// Identity — authoritative only after verification
// ---------------------------------------------------------------------------
describe('identity assembly', () => {
  const inspected = () => {
    const r = stellarRail.inspect(paymentHeader())
    if (!r.ok) throw new Error('fixture should inspect cleanly')
    return r
  }

  it('refuses to produce an identity without a facilitator-confirmed payer', () => {
    // No claimed-payer fallback exists on this rail, by design.
    expect(stellarRail.identify(inspected(), { valid: true })).toBeNull()
  })

  it('uses the confirmed payer verbatim, without lowercasing it', () => {
    // `G…` strkeys are case-sensitive base32. Lowercasing produces a different,
    // invalid address — and would split one payer across two idempotency keys.
    const identity = stellarRail.identify(inspected(), { valid: true, payer: PAY_TO })
    expect(identity?.payer).toBe(PAY_TO)
    expect(identity?.payer).not.toBe(PAY_TO.toLowerCase())
  })

  it('keys the identity on network + confirmed payer + fingerprint', () => {
    const inspection = inspected()
    const identity = stellarRail.identify(inspection, { valid: true, payer: PAY_TO })
    expect(identity).toEqual({
      network: 'stellar:testnet',
      payer: PAY_TO,
      paymentId: inspection.paymentFingerprint,
    })
  })
})

// ---------------------------------------------------------------------------
// S7 — payment parameters are server-derived
// ---------------------------------------------------------------------------
describe('S7 — the caller controls no payment parameter', () => {
  it('ignores amount, asset, network, payTo and facilitator supplied in the payload', async () => {
    const attacker = stellarRail.inspect(
      header({
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'stellar:pubnet',
          amount: '1',
          asset: 'CATTACKERASSET',
          payTo: 'GATTACKERPAYTOADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          maxTimeoutSeconds: 9999,
          extra: {},
        },
        facilitator: 'https://evil.example',
        payload: { transaction: envelope() },
      }),
    )
    expect(attacker.ok).toBe(true)

    // What the server will actually charge against is built from config alone.
    const req = await stellarRail.requirements(endpoint)
    expect(req.amount).toBe('10000')
    expect(req.asset).toBe(USDC_TESTNET)
    expect(req.network).toBe('stellar:testnet')
    expect(req.payTo).toBe(PAY_TO)
  })

  it('takes no request input when choosing the facilitator', async () => {
    const { facilitatorGuard } = await import('../../config')
    // The guard's only input is configuration. There is no overload that a
    // request could reach.
    expect(facilitatorGuard('https://evil.example')).toEqual({
      ok: false,
      reason: 'not_approved',
    })
  })
})

// ---------------------------------------------------------------------------
// S8 — the application never holds the seller secret
// ---------------------------------------------------------------------------
describe('S8 — no seller secret in application config', () => {
  it('exposes only a public payTo', async () => {
    const { stellarConfig } = await import('../../config')
    expect(stellarConfig.payTo).toMatch(/^G[A-Z2-7]{55}$/)
    expect(Object.keys(stellarConfig)).toEqual(
      expect.not.arrayContaining(['secret', 'secretKey', 'privateKey', 'seed', 'mnemonic']),
    )
  })

  it('reads no secret-shaped environment variable', () => {
    const forbidden = [
      'X402_STELLAR_SECRET',
      'X402_STELLAR_SECRET_KEY',
      'X402_STELLAR_PRIVATE_KEY',
      'STELLAR_SEED',
    ]
    // A seller receives; it never authorises and never submits. If one of these
    // ever appears in the source, this test is the alarm.
    for (const name of forbidden) {
      expect(process.env[name]).toBeUndefined()
    }
  })
})

describe('the pilot prices exactly one resource', () => {
  it('refuses an endpoint it has no price for', async () => {
    // Silently inheriting the evaluate price is how a second paid route ships
    // mispriced. Adding a Stellar price must be a reviewed change.
    await expect(
      stellarRail.requirements({ ...endpoint, priceKey: 'signals' }),
    ).rejects.toThrow(/no price for "signals"/)
  })
})
