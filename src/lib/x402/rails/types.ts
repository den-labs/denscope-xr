/**
 * The payment-rail seam.
 *
 * `middleware.ts` owns the lifecycle — ordering, the abuse limiter, replay,
 * validation, compute, persistence. A rail owns only what is scheme-specific:
 * how to inspect a header locally, what to advertise in a 402, and how to reach
 * the facilitator. A rail can never reorder the lifecycle because it is never
 * given the chance to: it exposes four independent calls, not a wrapper.
 *
 * Two rails exist:
 *
 *   evm.ts      wraps the deployed Celo code as-is. Not rewritten.
 *   stellar.ts  new, built on @x402/core + @x402/stellar.
 *
 * Rail selection is by CONFIGURED network, never by caller input. Nothing in a
 * request can choose the rail, the asset, the price, the payee or the
 * facilitator.
 */

import type { PaymentRequirement } from '../types'

/**
 * The identity of a payment, assembled ONLY after the facilitator has confirmed
 * the payer.
 *
 * `paymentId` is deliberately not called `nonce`: Stellar has no EIP-3009 nonce
 * and inventing one would be a lie. The DB column is still `nonce` for the
 * deployed schema's sake, and the two names meet at the persistence boundary in
 * `idempotency.ts` — nowhere else.
 */
export interface PaymentIdentity {
  /** Configured CAIP-2 network. Never caller-supplied. */
  network: string
  /** The payer the facilitator CONFIRMED, in the rail's canonical form. */
  payer: string
  /** Unique per payment, derived from the payment itself. */
  paymentId: string
}

/**
 * The product of local, pre-verification inspection.
 *
 * A fingerprint is NOT an identity. It says "these bytes are shaped like a
 * payment and this is what makes them distinct"; it says nothing about who
 * paid, because nothing local can. The identity is assembled later, from the
 * fingerprint plus the facilitator's confirmed payer.
 *
 * The invariant this type exists to enforce:
 *
 *   Never look up a previously paid result using a payer the facilitator has
 *   not yet verified.
 */
export type RailInspection =
  | {
      ok: true
      /** Decoded payload, forwarded verbatim to the facilitator. */
      payload: Record<string, unknown>
      /** Distinguishes this payment from every other one. Not a payer. */
      paymentFingerprint: string
      /**
       * An address the payload merely CLAIMS paid. Optional, and inert on its
       * own: it is not an identity, must never reach a replay lookup by itself,
       * and only {@link PaymentRail.identify} — which runs after a successful
       * verification — may consider it at all.
       */
      claimedPayer?: string
    }
  | { ok: false; reason: string }

export interface RailVerifyResult {
  valid: boolean
  /** Present only when the facilitator confirmed it. */
  payer?: string
  error?: string
}

export interface RailSettleResult {
  success: boolean
  transaction?: string
  error?: string
}

/** What a 402 response needs, before it becomes an HTTP response. */
export interface RailPaymentRequired {
  body: unknown
  /** Base64 `PAYMENT-REQUIRED` header value. */
  header: string
}

/** Resource being sold, as the lifecycle knows it. */
export interface RailEndpoint {
  path: string
  priceKey: string
  description: string
}

export interface PaymentRail {
  /** Configured CAIP-2 network this rail settles on. */
  readonly network: string

  /**
   * Local, zero-I/O, allocation-bounded shape check (SEC-04).
   *
   * Runs BEFORE the abuse limiter and before any outbound request, so arbitrary
   * caller bytes can never be turned into a facilitator round-trip.
   */
  inspect(header: string): RailInspection

  /** Payment requirements for this endpoint. Config-derived only. */
  requirements(endpoint: RailEndpoint): Promise<PaymentRequirement>

  /** The full 402 body + header, including discovery metadata. */
  paymentRequired(endpoint: RailEndpoint): Promise<RailPaymentRequired>

  /** Facilitator `/verify`. Read-only — moves no funds. */
  verify(
    payload: Record<string, unknown>,
    requirements: PaymentRequirement,
  ): Promise<RailVerifyResult>

  /** Facilitator `/settle`. Funds move. Call only after a successful compute. */
  settle(
    payload: Record<string, unknown>,
    requirements: PaymentRequirement,
  ): Promise<RailSettleResult>

  /**
   * Assemble the payment identity.
   *
   * The lifecycle calls this ONLY after {@link verify} returned `valid`, which
   * is what makes the resulting `payer` authoritative. Returning `null` means
   * "no authoritative payer" and the lifecycle must refuse the request rather
   * than key a replay lookup on a guess.
   *
   * Payer casing is rail-specific and lives here. EVM addresses are hex and are
   * lowercased so one payer cannot occupy two idempotency keys. Stellar `G…`
   * strkeys are case-sensitive base32 — lowercasing one CORRUPTS it — so that
   * rail returns the address untouched.
   */
  identify(
    inspection: Extract<RailInspection, { ok: true }>,
    verified: RailVerifyResult,
  ): PaymentIdentity | null
}
