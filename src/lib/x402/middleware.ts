import { NextResponse } from 'next/server'
import type { PaymentRequirement } from './types'
import { isX402Enabled } from './config'
import { activeRail } from './rails'
import type { PaymentIdentity, PaymentRail } from './rails/types'
import { resolveClientIp } from './client-ip'
import { consumeVerifyAttempt } from './verify-limit'
import {
  lookupDeliveredResult,
  storeDeliveredResult,
  type DeliveredResult,
} from './idempotency'
import { recordX402Payment } from './payments'
import {
  extractApiKey,
  authenticateApiKey,
  buildRateLimitHeaders,
  type AuthResult,
} from '@/lib/api-keys/authenticate'
import type { RateLimitResult } from '@/lib/api-keys/rate-limit'

/**
 * Hybrid authorisation and paid delivery for x402 resources.
 *
 * THE LIFECYCLE, and why it is in this order:
 *
 *   authorizePaidRequest()
 *     1. API key present            -> normal quota auth, nothing paid
 *     2. X-PAYMENT present
 *          a. local shape check     (SEC-04: garbage never reaches the facilitator)
 *          b. abuse limiter         (SEC-04: garbage volume is bounded)
 *          c. facilitator /verify   (read-only; no funds move)
 *          d. replay lookup         (SEC-02: already-settled payment -> stored result)
 *        -> returns a PENDING payment. Nothing has been charged.
 *     3. neither                    -> 402 with payment requirements
 *
 *   ...the route then parses, validates, checks preconditions and computes.
 *      Any failure there returns an error and NOTHING IS SETTLED.
 *
 *   deliverPaidResult()
 *     5. facilitator /settle        (funds move, for the first time)
 *     6. persist payment + result   (awaited; SEC-02/SEC-03)
 *     7. response headers
 *
 * The invariant that matters: settlement happens after a successful
 * computation, never before it. Previously `authenticateHybrid` settled as the
 * first statement of every paid route, so a malformed body or an unknown agent
 * took real USDC and returned 400 or 404 (SEC-01). There is deliberately no
 * refund path — a seller that cannot spend cannot refund, and preserving that
 * property is worth more than a refund would be.
 */

export interface PaidEndpoint {
  /** Path used to build the advertised `resource.url` in the 402. */
  path: string
  priceKey: string
  description: string
}

/** A verified-but-unsettled payment. Holding one entitles the caller to work,
 *  not to a result — and has cost them nothing yet. */
export interface PendingPayment {
  payload: Record<string, unknown>
  /** The rail that verified this payment. Settlement MUST use the same one. */
  rail: PaymentRail
  requirements: PaymentRequirement
  identity: PaymentIdentity
  /** Atomic units of the rail's asset, taken from the advertised requirements
   *  so what is stored is always what was quoted. Decimals are rail-specific:
   *  6 on EVM USDC, 7 on Stellar USDC. */
  amountMicro: number
  endpointPath: string
  priceKey: string
}

export type PaidAuth =
  | { ok: true; method: 'api-key'; keyId: string; rateLimit: RateLimitResult }
  | { ok: true; method: 'x402'; pending: PendingPayment }
  /** This exact payment already bought a result; serve it again, charge nothing. */
  | { ok: true; method: 'x402-replay'; delivered: DeliveredResult }
  | { ok: false; error: NextResponse }

async function paymentRequired(endpoint: PaidEndpoint): Promise<NextResponse> {
  const { body, header } = await activeRail(endpoint).paymentRequired(endpoint)
  return new NextResponse(JSON.stringify(body), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'PAYMENT-REQUIRED': header,
      // A 402 quotes a price to one caller; it must not be reused from a shared
      // cache for another.
      'Cache-Control': 'private, no-store',
    },
  })
}

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status })
}

/**
 * Authorise a request for a paid resource. Settles nothing.
 *
 * @param headers - Incoming request headers.
 * @param endpoint - Resource being requested.
 */
export async function authorizePaidRequest(
  headers: Headers,
  endpoint: PaidEndpoint,
): Promise<PaidAuth> {
  // --- Path 1: API key -------------------------------------------------------
  if (extractApiKey(headers)) {
    const auth: AuthResult = await authenticateApiKey(headers)
    if (!auth.ok) return auth
    return { ok: true, method: 'api-key', keyId: auth.keyId, rateLimit: auth.rateLimit }
  }

  const rail = activeRail(endpoint)
  const paymentHeader = headers.get('X-PAYMENT')

  // --- Path 3: no credentials at all -----------------------------------------
  if (!paymentHeader) {
    if (isX402Enabled()) return { ok: false, error: await paymentRequired(endpoint) }
    return {
      ok: false,
      error: jsonError(
        401,
        'Missing API key. Provide via Authorization: Bearer <key> or X-API-Key header.',
      ),
    }
  }

  // --- Path 2: x402 ----------------------------------------------------------
  // (a) Local shape check. Free to run, and it is what stops an anonymous
  //     caller turning arbitrary bytes into an outbound facilitator request.
  const inspection = rail.inspect(paymentHeader)
  if (!inspection.ok) {
    return { ok: false, error: jsonError(402, 'payment_malformed', { reason: inspection.reason }) }
  }

  // (b) Abuse limiter, keyed on the resolved client IP. Only requests that are
  //     about to cost us a facilitator round-trip are counted.
  const client = resolveClientIp(headers)
  const limit = await consumeVerifyAttempt(client.ip)
  if (!limit.available) {
    return { ok: false, error: jsonError(503, 'payment_verification_unavailable') }
  }
  if (!limit.allowed) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'payment_verification_rate_limited', retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      ),
    }
  }

  // (c) Verification. Read-only — this moves no funds.
  const requirements = await rail.requirements(endpoint)
  const verified = await rail.verify(inspection.payload, requirements)
  if (!verified.valid) {
    return { ok: false, error: jsonError(402, 'payment_invalid', { reason: verified.error }) }
  }

  // Identity is assembled ONLY here, after a successful verification, and only
  // by the rail. Before this line there is a fingerprint and no payer — which
  // is what stops a replay lookup keyed on an address nobody confirmed.
  const identity = rail.identify(inspection, verified)
  if (!identity) {
    // Verification succeeded but produced no authoritative payer. Refuse rather
    // than guess: guessing here reads someone else's paid result.
    return { ok: false, error: jsonError(402, 'payment_unattributable') }
  }

  // (d) Replay. A payment that already bought a result buys the same result
  //     again, for free. Fails CLOSED: an unavailable store must not be read as
  //     "nothing stored", which would recompute and re-settle a paid request.
  const prior = await lookupDeliveredResult(identity)
  if (!prior.available) {
    return { ok: false, error: jsonError(503, 'payment_ledger_unavailable') }
  }
  if (prior.result) {
    return { ok: true, method: 'x402-replay', delivered: prior.result }
  }

  return {
    ok: true,
    method: 'x402',
    pending: {
      payload: inspection.payload,
      rail,
      requirements,
      identity,
      amountMicro: Number(requirements.amount),
      endpointPath: endpoint.path,
      priceKey: endpoint.priceKey,
    },
  }
}

export type Delivery =
  /** Serve `body` with these headers. `body` may differ from what the route
   *  computed if a concurrent request won the settlement race. */
  | { ok: true; headers: Record<string, string>; body: unknown; status: number }
  | { ok: false; error: NextResponse }

/**
 * Settle and record a successfully computed result, then hand back what to send.
 *
 * Call this only once the response body exists. Everything that can fail
 * without charging the caller has already failed by this point.
 */
export async function deliverPaidResult(
  auth: Extract<PaidAuth, { ok: true; method: 'api-key' | 'x402' }>,
  body: unknown,
  meta: { chainId: number; agentId: number },
): Promise<Delivery> {
  if (auth.method === 'api-key') {
    return { ok: true, headers: buildRateLimitHeaders(auth.rateLimit), body, status: 200 }
  }

  const { pending } = auth

  // Funds move here, and only here.
  const settled = await pending.rail.settle(pending.payload, pending.requirements)
  if (!settled.success) {
    return {
      ok: false,
      error: jsonError(402, 'payment_failed', { reason: settled.error ?? 'settlement_failed' }),
    }
  }

  // Awaited, not fire-and-forget (SEC-02/SEC-03): the ability to answer a retry
  // now depends on this row, so a lost write is a lost purchase.
  const stored = await storeDeliveredResult({
    id: pending.identity,
    endpoint: pending.endpointPath,
    amountMicro: pending.amountMicro,
    txHash: settled.transaction ?? null,
    status: 200,
    body,
  })

  if (stored.duplicate) {
    // A concurrent request settled the same payment first. Both rails make the
    // chain accept only one of them — an EIP-3009 nonce is single-use, and a
    // Stellar sequence number is consumed — so serve the winner's stored result
    // rather than our own: the caller must see one answer, not two.
    const prior = await lookupDeliveredResult(pending.identity)
    if (prior.available && prior.result) {
      return {
        ok: true,
        headers: replayHeaders(prior.result),
        body: prior.result.body,
        status: prior.result.status,
      }
    }
  }

  await recordX402Payment({
    chainId: meta.chainId,
    agentId: meta.agentId,
    endpoint: pending.endpointPath,
    payer: pending.identity.payer,
    transaction: settled.transaction ?? null,
    priceKey: pending.priceKey,
    network: pending.identity.network,
  })

  const headers: Record<string, string> = { 'X-Payment-Method': 'x402' }
  if (settled.transaction) headers['X-Payment-Tx'] = settled.transaction
  if (!stored.stored) {
    // The payment is real and the result was delivered, but the binding that
    // makes a retry safe is missing. Say so rather than implying replayability.
    headers['X-Payment-Replayable'] = 'false'
  }
  return { ok: true, headers, body, status: 200 }
}

/**
 * Serve a previously delivered result.
 *
 * Routes call this immediately after authorisation and return, so a replayed
 * payment performs no database reads for evidence, no interpretation and no
 * settlement — it is a lookup and a copy.
 */
export function respondWithReplay(delivered: DeliveredResult): NextResponse {
  return NextResponse.json(delivered.body, {
    status: delivered.status,
    headers: replayHeaders(delivered),
  })
}

function replayHeaders(delivered: DeliveredResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Payment-Method': 'x402',
    'X-Payment-Replay': 'true',
  }
  if (delivered.txHash) headers['X-Payment-Tx'] = delivered.txHash
  return headers
}
