/**
 * Local, cryptography-free inspection of an `X-PAYMENT` header.
 *
 * Purpose (SEC-04): an anonymous caller must not be able to make DenScope issue
 * an outbound facilitator `/verify` call by sending arbitrary bytes. Every check
 * here is local, allocation-bounded and deterministic — it decides only whether
 * the header is *shaped* like an x402 v2 EIP-3009 payment. It deliberately does
 * NOT attempt signature recovery: the facilitator remains the only authority on
 * whether a payment is valid.
 *
 * Purpose (SEC-02): the same parse yields the payment's natural identity — the
 * EIP-3009 authorization nonce plus the payer — which is what binds a settled
 * payment to a delivered result.
 *
 * Rejection reasons are a closed set of opaque tokens. Nothing derived from
 * caller-supplied bytes is ever placed in a reason, so this can be returned to
 * the caller without becoming an echo channel.
 */

/** Longest header we will even base64-decode. A real payload is ~700 bytes. */
export const MAX_PAYMENT_HEADER_CHARS = 8192

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const NONCE_RE = /^0x[0-9a-fA-F]{64}$/
/** 65-byte ECDSA signature: r (32) + s (32) + v (1). */
const SIGNATURE_RE = /^0x[0-9a-fA-F]{130}$/
/** Decimal integer string, bounded well under uint256's 78 digits. */
const UINT_RE = /^\d{1,78}$/

export type PaymentRejectionReason =
  | 'missing'
  | 'too_large'
  | 'not_base64'
  | 'not_json'
  | 'bad_version'
  | 'missing_authorization'
  | 'bad_address'
  | 'bad_nonce'
  | 'bad_amount'
  | 'bad_signature'
  | 'expired'

/** The natural key of an EIP-3009 payment, before the payer is confirmed. */
export interface ClaimedPaymentIdentity {
  /** `authorization.from`, lowercased. Claimed — not yet confirmed by verify. */
  claimedPayer: string
  /** `authorization.nonce`, lowercased. Unique per authorization by EIP-3009. */
  nonce: string
}

export type PaymentHeaderInspection =
  | {
      ok: true
      /** Decoded payload, forwarded verbatim to the facilitator. */
      payload: Record<string, unknown>
      identity: ClaimedPaymentIdentity
      /** Unix seconds after which the authorization is no longer valid. */
      validBefore: number
    }
  | { ok: false; reason: PaymentRejectionReason }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Decide whether `header` is plausibly an x402 v2 EIP-3009 payment.
 *
 * @param header - Raw `X-PAYMENT` header value, or null when absent.
 * @param nowSeconds - Injectable clock, so expiry is testable without fake timers.
 */
export function inspectPaymentHeader(
  header: string | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): PaymentHeaderInspection {
  if (!header) return { ok: false, reason: 'missing' }
  if (header.length > MAX_PAYMENT_HEADER_CHARS) return { ok: false, reason: 'too_large' }

  let decoded: string
  try {
    decoded = Buffer.from(header, 'base64').toString('utf-8')
  } catch {
    return { ok: false, reason: 'not_base64' }
  }
  // Buffer.from is famously lenient — it drops invalid characters rather than
  // throwing — so an empty result is the real signal that this was not base64.
  if (decoded.trim() === '') return { ok: false, reason: 'not_base64' }

  let parsed: unknown
  try {
    parsed = JSON.parse(decoded)
  } catch {
    return { ok: false, reason: 'not_json' }
  }
  if (!isRecord(parsed)) return { ok: false, reason: 'not_json' }

  if (parsed.x402Version !== 2) return { ok: false, reason: 'bad_version' }

  const inner = parsed.payload
  if (!isRecord(inner)) return { ok: false, reason: 'missing_authorization' }

  const auth = inner.authorization
  if (!isRecord(auth)) return { ok: false, reason: 'missing_authorization' }

  const { from, to, value, validBefore, nonce } = auth
  if (typeof from !== 'string' || !ADDRESS_RE.test(from)) return { ok: false, reason: 'bad_address' }
  if (typeof to !== 'string' || !ADDRESS_RE.test(to)) return { ok: false, reason: 'bad_address' }
  if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) return { ok: false, reason: 'bad_nonce' }
  if (typeof value !== 'string' || !UINT_RE.test(value)) return { ok: false, reason: 'bad_amount' }

  if (typeof inner.signature !== 'string' || !SIGNATURE_RE.test(inner.signature)) {
    return { ok: false, reason: 'bad_signature' }
  }

  if (typeof validBefore !== 'string' || !UINT_RE.test(validBefore)) {
    return { ok: false, reason: 'bad_amount' }
  }
  const expiry = Number(validBefore)
  // An already-expired authorization can never settle. Rejecting it here saves
  // a facilitator round-trip and closes the cheapest replay-flood variant:
  // capture one real payload, then resend it forever.
  if (!Number.isFinite(expiry) || expiry <= nowSeconds) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    payload: parsed,
    identity: { claimedPayer: from.toLowerCase(), nonce: nonce.toLowerCase() },
    validBefore: expiry,
  }
}
