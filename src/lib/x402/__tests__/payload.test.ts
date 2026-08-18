import { describe, it, expect } from 'vitest'
import { inspectPaymentHeader, MAX_PAYMENT_HEADER_CHARS } from '../payload'

const NOW = 1_800_000_000

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64')
}

/** Builds a valid payload, merging overrides at the level they belong to.
 *  Merged rather than spread wholesale: a top-level spread would replace
 *  `payload` entirely and silently turn a signature case into a
 *  missing-authorization case. */
function validPayload(
  overrides: {
    top?: Record<string, unknown>
    payload?: Record<string, unknown>
    authorization?: Record<string, unknown>
  } = {},
) {
  return {
    x402Version: 2,
    resource: { url: 'https://www.denscope.xyz/api/v1/trust/evaluate' },
    ...overrides.top,
    payload: {
      signature: `0x${'a'.repeat(130)}`,
      ...overrides.payload,
      authorization: {
        from: `0x${'1'.repeat(40)}`,
        to: `0x${'2'.repeat(40)}`,
        value: '1000',
        validAfter: '0',
        validBefore: String(NOW + 3600),
        nonce: `0x${'f'.repeat(64)}`,
        ...overrides.authorization,
      },
    },
  }
}

describe('inspectPaymentHeader — accepts well-formed payments', () => {
  it('accepts a valid EIP-3009 v2 payload and extracts its identity', () => {
    const result = inspectPaymentHeader(encode(validPayload()), NOW)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.identity.claimedPayer).toBe(`0x${'1'.repeat(40)}`)
    expect(result.identity.nonce).toBe(`0x${'f'.repeat(64)}`)
    expect(result.validBefore).toBe(NOW + 3600)
  })

  it('lowercases identity so casing cannot fork the idempotency key', () => {
    const payload = validPayload({
      authorization: { from: `0x${'A'.repeat(40)}`, nonce: `0x${'F'.repeat(64)}` },
    })
    const result = inspectPaymentHeader(encode(payload), NOW)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.identity.claimedPayer).toBe(`0x${'a'.repeat(40)}`)
    expect(result.identity.nonce).toBe(`0x${'f'.repeat(64)}`)
  })
})

describe('inspectPaymentHeader — rejects garbage locally (SEC-04)', () => {
  const cases: Array<[string, string | null, string]> = [
    ['a missing header', null, 'missing'],
    ['an empty header', '', 'missing'],
    ['non-base64 bytes', '!!!!', 'not_base64'],
    ['base64 that is not JSON', Buffer.from('hello').toString('base64'), 'not_json'],
    ['a JSON array', encode([1, 2, 3]), 'not_json'],
  ]

  for (const [label, header, reason] of cases) {
    it(`rejects ${label}`, () => {
      const result = inspectPaymentHeader(header, NOW)
      expect(result).toEqual({ ok: false, reason })
    })
  }

  it('rejects an oversized header without decoding it', () => {
    const result = inspectPaymentHeader('A'.repeat(MAX_PAYMENT_HEADER_CHARS + 1), NOW)
    expect(result).toEqual({ ok: false, reason: 'too_large' })
  })

  it('rejects a wrong protocol version', () => {
    const result = inspectPaymentHeader(encode({ ...validPayload(), x402Version: 1 }), NOW)
    expect(result).toEqual({ ok: false, reason: 'bad_version' })
  })

  it('rejects a payload with no authorization', () => {
    const result = inspectPaymentHeader(encode({ x402Version: 2, payload: {} }), NOW)
    expect(result).toEqual({ ok: false, reason: 'missing_authorization' })
  })

  it('rejects a malformed payer address', () => {
    const header = encode(validPayload({ authorization: { from: '0xnope' } }))
    expect(inspectPaymentHeader(header, NOW)).toEqual({ ok: false, reason: 'bad_address' })
  })

  it('rejects a malformed nonce', () => {
    const header = encode(validPayload({ authorization: { nonce: '0x1234' } }))
    expect(inspectPaymentHeader(header, NOW)).toEqual({ ok: false, reason: 'bad_nonce' })
  })

  it('rejects a non-numeric amount', () => {
    const header = encode(validPayload({ authorization: { value: '10e5' } }))
    expect(inspectPaymentHeader(header, NOW)).toEqual({ ok: false, reason: 'bad_amount' })
  })

  it('rejects a malformed signature', () => {
    const header = encode(validPayload({ payload: { signature: '0xshort' } }))
    expect(inspectPaymentHeader(header, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects an already-expired authorization', () => {
    const header = encode(validPayload({ authorization: { validBefore: String(NOW - 1) } }))
    expect(inspectPaymentHeader(header, NOW)).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects an authorization expiring exactly now', () => {
    const header = encode(validPayload({ authorization: { validBefore: String(NOW) } }))
    expect(inspectPaymentHeader(header, NOW)).toEqual({ ok: false, reason: 'expired' })
  })

  it('never places caller-supplied bytes into the rejection reason', () => {
    const header = encode(validPayload({ authorization: { from: '0x<script>alert(1)</script>' } }))
    const result = inspectPaymentHeader(header, NOW)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('bad_address')
    expect(JSON.stringify(result)).not.toContain('script')
  })
})
