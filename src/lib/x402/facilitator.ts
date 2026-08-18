import type { PaymentRequirement, X402VerifyResult, X402SettleResult } from './types'
import { facilitatorGuard, FACILITATOR_TIMEOUT_MS } from './config'

/**
 * Facilitator client.
 *
 * Two properties this module is responsible for:
 *
 *  - It never talks to a facilitator that {@link facilitatorGuard} has not
 *    approved (SEC-05). The guard reads configuration only; there is no code
 *    path by which a request can influence the destination.
 *
 *  - It never relays upstream response text to our caller (SEC-07). A third
 *    party's error body must not become DenScope's error body. Failures are
 *    reported as a closed set of tokens plus the HTTP status; the detail is
 *    logged server-side where it is useful and not attacker-readable.
 *
 * Payloads arrive already decoded and shape-checked by `payload.ts`, so nothing
 * here parses caller bytes.
 */

type FacilitatorRoute = 'verify' | 'settle'

type FacilitatorCall =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string }

async function callFacilitator(
  route: FacilitatorRoute,
  paymentPayload: Record<string, unknown>,
  paymentRequirements: PaymentRequirement,
): Promise<FacilitatorCall> {
  const guard = facilitatorGuard()
  if (!guard.ok) {
    // A misconfigured facilitator must be loud and must not fall back to a
    // default that would settle somewhere else.
    console.error('x402: refusing facilitator call', { route, reason: guard.reason })
    return { ok: false, error: `facilitator_not_approved:${guard.reason}` }
  }

  try {
    const res = await fetch(`${guard.url}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
      signal: AbortSignal.timeout(FACILITATOR_TIMEOUT_MS),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('x402: facilitator returned non-2xx', {
        route,
        host: guard.host,
        status: res.status,
        detail: detail.slice(0, 500),
      })
      return { ok: false, error: `facilitator_error:${res.status}` }
    }

    return { ok: true, body: (await res.json()) as Record<string, unknown> }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    console.error('x402: facilitator call failed', {
      route,
      host: guard.host,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return { ok: false, error: timedOut ? 'facilitator_timeout' : 'facilitator_unreachable' }
  }
}

/**
 * Verify a payment authorisation with the facilitator.
 *
 * Read-only: no funds move. Verification alone entitles the caller to nothing —
 * the result is only used to decide whether it is worth computing.
 */
export async function verifyX402Payment(
  paymentPayload: Record<string, unknown>,
  paymentRequirements: PaymentRequirement,
): Promise<X402VerifyResult> {
  const call = await callFacilitator('verify', paymentPayload, paymentRequirements)
  if (!call.ok) return { valid: false, error: call.error }

  // Facilitator returns "isValid" (not "valid") and "invalidReason" (not "error")
  if (call.body.isValid) {
    return {
      valid: true,
      payer: call.body.payer as string,
      network: call.body.network as string,
    }
  }

  // invalidReason describes the CALLER's own payment, so echoing it is useful
  // rather than a disclosure channel — but it is still upstream text, so it is
  // length-capped instead of relayed verbatim.
  const reason = typeof call.body.invalidReason === 'string' ? call.body.invalidReason : ''
  return { valid: false, error: reason.slice(0, 200) || 'payment_invalid' }
}

/**
 * Settle the payment on-chain via the facilitator.
 *
 * MUST be called only after the result has been computed successfully — see
 * the lifecycle in `middleware.ts`. Settling earlier is SEC-01.
 */
export async function settleX402Payment(
  paymentPayload: Record<string, unknown>,
  paymentRequirements: PaymentRequirement,
): Promise<X402SettleResult> {
  const call = await callFacilitator('settle', paymentPayload, paymentRequirements)
  if (!call.ok) return { success: false, error: call.error }

  if (call.body.success) {
    return {
      success: true,
      transaction: call.body.transaction as string,
      network: call.body.network as string,
      payer: call.body.payer as string,
    }
  }

  const reason = typeof call.body.errorReason === 'string' ? call.body.errorReason : ''
  return { success: false, error: reason.slice(0, 200) || 'settlement_failed' }
}
