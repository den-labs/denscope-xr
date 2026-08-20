/**
 * Stellar rail — testnet, SEP-41 USDC, `exact` scheme.
 *
 * New implementation, built on the official packages rather than on DenScope's
 * hand-rolled EVM code. Nothing here is a port of the EIP-3009 path: Stellar has
 * no authorization nonce, no `authorization.from` and no 65-byte ECDSA
 * signature, so a port would have been a fiction.
 *
 *   @x402/stellar  ExactStellarScheme  — price -> atomic amount + asset
 *   @x402/core     HTTPFacilitatorClient — /verify and /settle
 *   @x402/core     header codecs         — X-PAYMENT / PAYMENT-REQUIRED wire format
 *   @stellar/stellar-sdk                 — envelope parsing, canonical hash
 *
 * WHY NOT `x402ResourceServer.buildPaymentRequirements()`: it throws unless
 * `initialize()` has fetched `/supported` from the facilitator first, which
 * would make serving a 402 depend on the facilitator being reachable. The audit
 * requires the opposite — the seller must answer 402 while the facilitator is
 * down. `ExactStellarScheme.parsePrice()` is the same official arithmetic with
 * no network call, so the unpaid path stays offline.
 *
 * WHY NOT `@x402/next`: peer-requires `next >= 16.2.6` (this app runs 16.1.6)
 * and its `paymentMiddleware` would own the route, taking the audited
 * settle-after-compute ordering with it.
 */

import { TransactionBuilder, FeeBumpTransaction } from '@stellar/stellar-sdk'
import { getNetworkPassphrase } from '@x402/stellar'
import { ExactStellarScheme } from '@x402/stellar/exact/server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
} from '@x402/core/http'
import type { Network, PaymentPayload } from '@x402/core/types'

import { siteUrl } from '@/config/site'
import type { PaymentRequirement } from '../types'
import {
  stellarConfig,
  facilitatorGuard,
  FACILITATOR_TIMEOUT_MS,
} from '../config'
import type {
  PaymentIdentity,
  PaymentRail,
  RailEndpoint,
  RailInspection,
  RailPaymentRequired,
  RailSettleResult,
  RailVerifyResult,
} from './types'

/** Longest header we will even base64-decode. A signed envelope is ~1–2 KB. */
export const MAX_STELLAR_PAYMENT_HEADER_CHARS = 8192

/** Discovery metadata. Travels in the 402 so a catalogue can read it later. */
const RESOURCE_METADATA = {
  serviceName: 'DenScope Trust Evaluation',
  mimeType: 'application/json',
  tags: ['trust', 'reputation', 'risk', 'erc-8004', 'agent', 'due-diligence', 'onchain'],
} as const

/**
 * The facilitator's invalidReason for a payment whose authorisation has already
 * been spent. Observed live on 2026-08-20 when the settled payment was re-sent.
 */
export const CONSUMED_PAYMENT_REASON = 'invalid_exact_stellar_payload_simulation_failed'

/** The single paid resource in the pilot. Adding another is a reviewed change. */
const PILOT_PRICE_KEY = 'evaluate'

const scheme = new ExactStellarScheme()

/** Built lazily: constructing it reads config, and config can change per test. */
function facilitatorClient(): HTTPFacilitatorClient {
  const guard = facilitatorGuard(stellarConfig.facilitatorUrl)
  if (!guard.ok) {
    throw new FacilitatorNotApproved(guard.reason)
  }
  return new HTTPFacilitatorClient({
    url: guard.url,
    timeoutMs: FACILITATOR_TIMEOUT_MS,
  })
}

/** Refusal to talk to an unapproved facilitator (SEC-05). */
export class FacilitatorNotApproved extends Error {
  constructor(readonly reason: string) {
    super(`facilitator_not_approved:${reason}`)
    this.name = 'FacilitatorNotApproved'
  }
}

/**
 * Canonical fingerprint of a submitted Stellar payment.
 *
 * Fee-bump and plain wrappings of the SAME payment normalise to one value, so a
 * caller cannot mint a second idempotency key by re-wrapping. Adding a signature
 * does not change it either — the hash covers the transaction body, not the
 * signature set.
 *
 * `TransactionBuilder.fromXDR` is mandatory: `new Transaction(xdr, passphrase)`
 * THROWS on a fee-bump envelope.
 */
export function canonicalPaymentFingerprint(xdr: string, network: string): string {
  const parsed = TransactionBuilder.fromXDR(xdr, getNetworkPassphrase(network as Network))
  const core = parsed instanceof FeeBumpTransaction ? parsed.innerTransaction : parsed
  return core.hash().toString('hex')
}

export const stellarRail: PaymentRail = {
  get network() {
    return stellarConfig.network
  },

  /** The pilot sells exactly one resource. Nothing else routes here. */
  supports(endpoint: RailEndpoint): boolean {
    return endpoint.priceKey === PILOT_PRICE_KEY
  },

  /**
   * Local shape check (SEC-04). Zero I/O, bounded work, no signature recovery —
   * the facilitator remains the only authority on whether a payment is valid.
   * This exists solely so that arbitrary bytes cannot become an outbound
   * facilitator request.
   */
  inspect(header: string): RailInspection {
    if (!header) return { ok: false, reason: 'missing' }
    if (header.length > MAX_STELLAR_PAYMENT_HEADER_CHARS) {
      return { ok: false, reason: 'too_large' }
    }

    let decoded: PaymentPayload
    try {
      decoded = decodePaymentSignatureHeader(header)
    } catch {
      return { ok: false, reason: 'not_decodable' }
    }

    if (decoded?.x402Version !== 2) return { ok: false, reason: 'bad_version' }

    const xdr = (decoded.payload as { transaction?: unknown } | undefined)?.transaction
    if (typeof xdr !== 'string' || xdr.length === 0) {
      return { ok: false, reason: 'missing_transaction' }
    }

    let paymentFingerprint: string
    try {
      paymentFingerprint = canonicalPaymentFingerprint(xdr, stellarConfig.network)
    } catch {
      // Not a parseable Stellar envelope. Rejected here, at no cost.
      return { ok: false, reason: 'not_stellar_envelope' }
    }

    return {
      ok: true,
      payload: decoded as unknown as Record<string, unknown>,
      paymentFingerprint,
      // Deliberately absent. Nothing in a Stellar envelope is authority for the
      // payer: on a fee-bump the outer source is undefined and the inner source
      // is still only a claim. `identify()` uses the facilitator's answer alone.
    }
  },

  async requirements(endpoint: RailEndpoint): Promise<PaymentRequirement> {
    // The pilot sells exactly one resource at exactly one price. If a second
    // paid endpoint is ever routed here it would silently inherit this price,
    // so refuse instead — adding a Stellar price is a reviewed change.
    if (endpoint.priceKey !== PILOT_PRICE_KEY) {
      throw new Error(
        `stellar rail has no price for "${endpoint.priceKey}"; the pilot prices only "${PILOT_PRICE_KEY}"`,
      )
    }

    // Official arithmetic, offline. 0.001 -> "10000" because USDC on Stellar has
    // 7 decimals. The EVM `price * 1_000_000` path is never reachable from here.
    const parsed = await scheme.parsePrice(
      stellarConfig.price,
      stellarConfig.network as Network,
    )
    return {
      scheme: 'exact',
      network: stellarConfig.network,
      amount: parsed.amount,
      asset: parsed.asset,
      payTo: stellarConfig.payTo,
      maxTimeoutSeconds: 60,
      extra: { ...parsed.extra, areFeesSponsored: true },
    }
  },

  async paymentRequired(endpoint: RailEndpoint): Promise<RailPaymentRequired> {
    const requirements = await this.requirements(endpoint)
    const body = {
      x402Version: 2,
      accepts: [requirements],
      resource: {
        url: `${resourceBaseUrl()}${endpoint.path}`,
        description: endpoint.description,
        ...RESOURCE_METADATA,
      },
      error: 'missing payment header',
    }
    return {
      body,
      header: encodePaymentRequiredHeader(
        body as unknown as Parameters<typeof encodePaymentRequiredHeader>[0],
      ),
    }
  },

  async verify(
    payload: Record<string, unknown>,
    requirements: PaymentRequirement,
  ): Promise<RailVerifyResult> {
    try {
      const res = await facilitatorClient().verify(
        payload as unknown as PaymentPayload,
        requirements as PaymentRequirement & { network: Network },
      )
      if (res.isValid) return { valid: true, payer: res.payer }
      // Upstream text describes the caller's own payment, so it is useful — but
      // it is still third-party bytes, so it is capped rather than relayed (SEC-07).
      return { valid: false, error: (res.invalidReason ?? '').slice(0, 200) || 'payment_invalid' }
    } catch (error) {
      return { valid: false, error: facilitatorFailure(error, 'verify') }
    }
  },

  async settle(
    payload: Record<string, unknown>,
    requirements: PaymentRequirement,
  ): Promise<RailSettleResult> {
    try {
      const res = await facilitatorClient().settle(
        payload as unknown as PaymentPayload,
        requirements as PaymentRequirement & { network: Network },
      )
      if (res.success) return { success: true, transaction: res.transaction }
      return {
        success: false,
        error: (res.errorReason ?? '').slice(0, 200) || 'settlement_failed',
      }
    } catch (error) {
      return { success: false, error: facilitatorFailure(error, 'settle') }
    }
  },

  /**
   * A consumed Stellar payment no longer verifies, so recovery must be able to
   * happen before verification is attempted.
   *
   * The key carries no payer, because nothing local can confirm one. It names
   * the PAYMENT. That is sufficient and not a weakening: possession of a valid
   * `X-PAYMENT` is already bearer authority in x402 — the same bytes are what
   * bought the result in the first place — and the lifecycle additionally
   * requires the stored endpoint to match, so one payment can only ever
   * re-deliver the one resource it purchased. No value moves on this path.
   */
  preVerifyRecoveryKey(
    inspection: Extract<RailInspection, { ok: true }>,
  ): { network: string; paymentId: string } {
    return {
      network: stellarConfig.network,
      paymentId: inspection.paymentFingerprint,
    }
  },

  /**
   * The single facilitator failure that means "already consumed".
   *
   * Narrow on purpose. Treating any verification failure as a replay would hand
   * out stored results for payments that never settled, and would mask genuine
   * validation problems. This token is upstream text, so if the facilitator ever
   * renames it the behaviour degrades to fail-closed — the buyer sees the 402
   * they see today rather than someone else's result. That is the safe
   * direction, and it is why this is an equality test and not a substring
   * search for "simulation" or "failed".
   */
  isConsumedPaymentFailure(reason: string | undefined): boolean {
    return reason === CONSUMED_PAYMENT_REASON
  },

  identify(
    inspection: Extract<RailInspection, { ok: true }>,
    verified: RailVerifyResult,
  ): PaymentIdentity | null {
    // No confirmed payer, no identity. There is no claimed-payer fallback on
    // this rail and there must never be one: keying a replay lookup on an
    // unverified address is how one caller reads another caller's paid result.
    if (!verified.payer) return null
    return {
      network: stellarConfig.network,
      // NOT lowercased. `G…` strkeys are case-sensitive base32; lowercasing one
      // produces a different, invalid address.
      payer: verified.payer,
      paymentId: inspection.paymentFingerprint,
    }
  },
}

function resourceBaseUrl(): string {
  // Imported at module scope, CALLED here: `siteUrl()` throws when
  // NEXT_PUBLIC_APP_URL is unset, and that throw belongs to the one caller that
  // needs a URL, not to import time. See SEC-09 in config.ts.
  return process.env.X402_BASE_URL ?? siteUrl()
}

function facilitatorFailure(error: unknown, route: 'verify' | 'settle'): string {
  if (error instanceof FacilitatorNotApproved) {
    console.error('x402/stellar: refusing facilitator call', { route, reason: error.reason })
    return error.message
  }
  const name = error instanceof Error ? error.name : ''
  console.error('x402/stellar: facilitator call failed', {
    route,
    error: error instanceof Error ? error.message : 'unknown',
  })
  if (name === 'FacilitatorTimeoutError') return 'facilitator_timeout'
  return 'facilitator_unreachable'
}
