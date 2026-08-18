import { NextResponse } from 'next/server'
import type { X402Context } from './types'
import { x402Config, isX402Enabled } from './config'
import { createPaymentRequired } from './payment-required'
import { verifyX402Payment, settleX402Payment } from './facilitator'
import {
  extractApiKey,
  authenticateApiKey,
  buildRateLimitHeaders,
  type AuthResult,
} from '@/lib/api-keys/authenticate'
import type { RateLimitResult } from '@/lib/api-keys/rate-limit'

/** Unified auth result for routes that accept both API key and x402 */
export type HybridAuthResult =
  | { ok: true; method: 'api-key'; keyId: string; rateLimit: RateLimitResult }
  | { ok: true; method: 'x402'; x402: X402Context }
  | { ok: false; error: NextResponse }

/**
 * Hybrid authentication: API key OR x402 payment.
 *
 * Priority:
 * 1. Authorization / X-API-Key header → existing M6 API key auth
 * 2. X-PAYMENT header → x402 verify + settle via facilitator
 * 3. Neither → 402 if x402 enabled, 401 otherwise
 */
export async function authenticateHybrid(
  headers: Headers,
  endpoint: { path: string; priceKey: string; description: string },
): Promise<HybridAuthResult> {
  // --- Path 1: API key ---
  const rawKey = extractApiKey(headers)
  if (rawKey) {
    const auth: AuthResult = await authenticateApiKey(headers)
    if (!auth.ok) return auth
    return { ok: true, method: 'api-key', keyId: auth.keyId, rateLimit: auth.rateLimit }
  }

  // --- Path 2: x402 payment ---
  const paymentHeader = headers.get('X-PAYMENT')
  if (paymentHeader) {
    const price = x402Config.pricing[endpoint.priceKey] ?? 0.001
    const microUnits = Math.round(price * 1_000_000)

    const paymentRequirements = {
      scheme: 'exact' as const,
      network: x402Config.network,
      amount: String(microUnits),
      asset: x402Config.assetAddress,
      payTo: x402Config.payTo,
      maxTimeoutSeconds: 30,
      extra: {
        assetTransferMethod: 'eip3009',
        name: x402Config.assetName,
        version: '2',
      },
    }

    const verifyResult = await verifyX402Payment(paymentHeader, paymentRequirements)
    if (!verifyResult.valid) {
      return {
        ok: false,
        error: NextResponse.json(
          { error: 'payment_invalid', message: verifyResult.error ?? 'x402 verification failed' },
          { status: 402 }
        ),
      }
    }

    // CRITICAL: settle AFTER verify — without this you validate but never collect
    const settleResult = await settleX402Payment(paymentHeader, paymentRequirements)
    if (!settleResult.success) {
      return {
        ok: false,
        error: NextResponse.json(
          { error: 'payment_failed', message: settleResult.error ?? 'x402 settlement failed' },
          { status: 402 }
        ),
      }
    }

    return {
      ok: true,
      method: 'x402',
      x402: {
        payer: settleResult.payer ?? verifyResult.payer ?? 'unknown',
        transaction: settleResult.transaction,
        authMethod: 'x402',
      },
    }
  }

  // --- Path 3: No auth at all ---
  if (isX402Enabled()) {
    const resourceUrl = `${x402Config.resourceBaseUrl()}${endpoint.path}`
    const { body, header } = createPaymentRequired({
      resourceUrl,
      description: endpoint.description,
      priceKey: endpoint.priceKey,
    })

    return {
      ok: false,
      error: new NextResponse(JSON.stringify(body), {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          'PAYMENT-REQUIRED': header,
        },
      }),
    }
  }

  // x402 not configured — fall through to standard 401
  return {
    ok: false,
    error: NextResponse.json(
      { error: 'Missing API key. Provide via Authorization: Bearer <key> or X-API-Key header.' },
      { status: 401 }
    ),
  }
}

/** Build response headers for a successful hybrid auth result */
export function buildHybridHeaders(auth: HybridAuthResult & { ok: true }): Record<string, string> {
  if (auth.method === 'api-key') {
    return buildRateLimitHeaders(auth.rateLimit)
  }
  // x402 payments don't have rate limits — return payment info
  return {
    'X-Payment-Method': 'x402',
    ...(auth.x402.transaction ? { 'X-Payment-Tx': auth.x402.transaction } : {}),
  }
}
