import type { PaymentRequirement, X402VerifyResult, X402SettleResult } from './types'
import { x402Config } from './config'

/**
 * Decode the base64 X-PAYMENT header into a parsed payload.
 * Throws on invalid base64 or JSON.
 */
function decodePaymentHeader(paymentHeader: string): unknown {
  return JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'))
}

/**
 * Verify an EIP-712 signature with the facilitator (read-only, no funds move).
 * IMPORTANT: This only validates — you MUST call settleX402Payment() after.
 */
export async function verifyX402Payment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirement,
): Promise<X402VerifyResult> {
  try {
    const paymentPayload = decodePaymentHeader(paymentHeader)

    const res = await fetch(`${x402Config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { valid: false, error: `Facilitator returned ${res.status}: ${text}` }
    }

    const result = (await res.json()) as Record<string, unknown>

    // Facilitator returns "isValid" (not "valid") and "invalidReason" (not "error")
    if (result.isValid) {
      return {
        valid: true,
        payer: result.payer as string,
        network: result.network as string,
      }
    }

    return {
      valid: false,
      error: (result.invalidReason as string) || 'Payment verification failed',
    }
  } catch (error) {
    return { valid: false, error: `x402 verification error: ${error}` }
  }
}

/**
 * Settle the payment on-chain via the facilitator.
 * Calls transferWithAuthorization (EIP-3009) — moves real USDC.
 * MUST be called AFTER verifyX402Payment() succeeds.
 */
export async function settleX402Payment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirement,
): Promise<X402SettleResult> {
  try {
    const paymentPayload = decodePaymentHeader(paymentHeader)

    const res = await fetch(`${x402Config.facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { success: false, error: `Facilitator settle returned ${res.status}: ${text}` }
    }

    const result = (await res.json()) as Record<string, unknown>

    if (result.success) {
      return {
        success: true,
        transaction: result.transaction as string,
        network: result.network as string,
        payer: result.payer as string,
      }
    }

    return {
      success: false,
      error: (result.errorReason as string) || 'Settlement failed',
    }
  } catch (error) {
    return { success: false, error: `x402 settlement error: ${error}` }
  }
}
