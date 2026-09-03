/**
 * EVM rail — Celo mainnet, USDC, EIP-3009.
 *
 * This is a WRAPPER, not a reimplementation. Every behaviour below is the code
 * that is live in production at revision 436b7e9, reached through the rail
 * interface instead of directly. `payload.ts`, `facilitator.ts`,
 * `payment-required.ts` and the pricing in `config.ts` are untouched.
 *
 * The one thing that is expressed rather than changed is the payer fallback:
 * the deployed code prefers the facilitator-confirmed payer and falls back to
 * the claimed one, which is sound HERE and only here, because an EIP-3009
 * payload carries a signature over `authorization.from` and verification has
 * already succeeded against it. That reasoning is EVM-specific, so it lives in
 * the EVM rail. It is deliberately not available to any other rail.
 */

import type { PaymentRequirement } from '../types'
import { x402Config } from '../config'
import { createPaymentRequired } from '../payment-required'
import { verifyX402Payment, settleX402Payment } from '../facilitator'
import { inspectPaymentHeader } from '../payload'
import type {
  PaymentIdentity,
  PaymentRail,
  RailEndpoint,
  RailInspection,
  RailPaymentRequired,
  RailSettleResult,
  RailVerifyResult,
} from './types'

/** Atomic units for a 6-decimal asset. USDC on EVM chains. */
function microUnits(priceKey: string): number {
  return Math.round((x402Config.pricing[priceKey] ?? 0.001) * 1_000_000)
}

export const evmRail: PaymentRail = {
  get network() {
    return x402Config.network
  },

  // Every priced endpoint. The EVM rail is the deployed default and prices
  // whatever `x402Config.pricing` names.
  supports(): boolean {
    return true
  },

  inspect(header: string): RailInspection {
    const inspection = inspectPaymentHeader(header)
    if (!inspection.ok) return { ok: false, reason: inspection.reason }
    return {
      ok: true,
      payload: inspection.payload,
      // The EIP-3009 authorization nonce. Unique per authorization by
      // construction, which is what prevents on-chain replay in the first place.
      paymentFingerprint: inspection.identity.nonce,
      claimedPayer: inspection.identity.claimedPayer,
    }
  },

  async requirements(endpoint: RailEndpoint): Promise<PaymentRequirement> {
    return {
      scheme: 'exact',
      network: x402Config.network,
      amount: String(microUnits(endpoint.priceKey)),
      asset: x402Config.assetAddress,
      payTo: x402Config.payTo,
      maxTimeoutSeconds: 30,
      extra: {
        assetTransferMethod: 'eip3009',
        name: x402Config.assetName,
        version: '2',
      },
    }
  },

  async paymentRequired(endpoint: RailEndpoint): Promise<RailPaymentRequired> {
    return createPaymentRequired({
      resourceUrl: `${x402Config.resourceBaseUrl()}${endpoint.path}`,
      description: endpoint.description,
      priceKey: endpoint.priceKey,
    })
  },

  verify(
    payload: Record<string, unknown>,
    requirements: PaymentRequirement,
  ): Promise<RailVerifyResult> {
    return verifyX402Payment(payload, requirements).then((r) => ({
      valid: r.valid,
      payer: r.payer,
      error: r.error,
    }))
  },

  settle(
    payload: Record<string, unknown>,
    requirements: PaymentRequirement,
  ): Promise<RailSettleResult> {
    return settleX402Payment(payload, requirements).then((r) => ({
      success: r.success,
      transaction: r.transaction,
      error: r.error,
    }))
  },

  identify(
    inspection: Extract<RailInspection, { ok: true }>,
    verified: RailVerifyResult,
  ): PaymentIdentity | null {
    const payer = verified.payer ?? inspection.claimedPayer
    if (!payer) return null
    return {
      network: x402Config.network,
      // Hex addresses are case-insensitive; lowercase so one payer cannot
      // occupy two idempotency keys.
      payer: payer.toLowerCase(),
      paymentId: inspection.paymentFingerprint,
    }
  },
}
