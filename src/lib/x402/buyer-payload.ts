import type { PaymentPayload, PaymentRequirements } from '@x402/core/types'

/**
 * Assemble a `PaymentPayload` from a 402 without throwing its metadata away.
 *
 * THE BUG THIS FIXES
 *
 * `ExactStellarScheme.createPaymentPayload()` returns only
 * `Pick<PaymentPayload, "x402Version" | "payload">` — the signed transaction and
 * nothing else. A buyer that sends just that, plus `accepted`, produces a
 * payload with no `resource` and no `extensions`. The payment settles perfectly
 * and the facilitator then catalogues nothing, because its discovery gate reads
 * `paymentPayload.extensions["bazaar"]` and its resource URL comes from
 * `paymentPayload.resource.url`. That is exactly what happened to DenScope's
 * first Stellar settlement.
 *
 * WHAT THIS DOES
 *
 * Carries the seller's advertised `resource` and `extensions` from the 402 into
 * the payload, unmodified. It is protocol-generic: there is no seller name, no
 * host check, no `bazaar` branch and no DenScope anything. Any 402 that declares
 * metadata gets that metadata forwarded; a 402 that declares none produces a
 * payload with none.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not invent, complete or correct metadata, and it never touches
 * `accepted`. Economic terms come from the requirements the buyer agreed to and
 * are passed through untouched, so nothing here can change what is charged —
 * mirroring the facilitator's own invariant that discovery metadata is never
 * payment authority.
 */

/** The parts of a 402 body this needs. Structural, not seller-specific. */
export interface PaymentRequiredLike {
  x402Version?: number
  resource?: Record<string, unknown>
  extensions?: Record<string, unknown>
  accepts?: unknown[]
}

/** What a scheme's `createPaymentPayload()` hands back. */
export interface SignedPaymentParts {
  x402Version: number
  payload: Record<string, unknown>
}

/**
 * Build the payload to send as `X-PAYMENT`.
 *
 * @param paymentRequired - The 402 body exactly as the seller returned it.
 * @param accepted - The requirements entry the buyer chose to pay.
 * @param signed - Output of the scheme's `createPaymentPayload()`.
 * @returns A payload carrying the seller's `resource` and `extensions` verbatim.
 */
export function buildPaymentPayload(
  paymentRequired: PaymentRequiredLike,
  accepted: PaymentRequirements,
  signed: SignedPaymentParts,
): PaymentPayload {
  return {
    x402Version: signed.x402Version,
    // Untouched: the buyer pays what it agreed to pay.
    accepted,
    payload: signed.payload,
    // Forwarded only when the seller advertised them. Omitted keys stay omitted
    // rather than becoming `undefined`, so the wire shape matches the 402's.
    ...(paymentRequired.resource ? { resource: paymentRequired.resource } : {}),
    ...(paymentRequired.extensions ? { extensions: paymentRequired.extensions } : {}),
  } as PaymentPayload
}
