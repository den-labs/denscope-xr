/**
 * Binds a settled payment to the response it bought (SEC-02).
 *
 * Without this, a client that loses the response has no way to recover it: the
 * only retry available is a fresh payment, which is a second charge for one
 * purchase. With it, presenting the same settled payment returns the same bytes.
 *
 * The key is the payment's own identity — `(network, payer, nonce)` — not a
 * caller-supplied idempotency key. That distinction is the security property:
 * a caller cannot name someone else's result, because reaching this store at
 * all requires a payload the facilitator verified as signed by that payer.
 *
 * FAIL CLOSED. Every function here reports store unavailability rather than
 * swallowing it, and callers must refuse the paid request when it happens.
 * Treating a failed lookup as "no stored result" would recompute and re-settle
 * an already-paid request — precisely the double charge this exists to prevent.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

/** Identity of a payment the facilitator has confirmed the payer for. */
export interface SettledPaymentIdentity {
  network: string
  /** Confirmed payer, lowercased. Never the merely-claimed address. */
  payer: string
  /** EIP-3009 authorization nonce, lowercased. */
  nonce: string
}

export interface DeliveredResult {
  status: number
  body: unknown
  txHash: string | null
}

export type DeliveredLookup =
  | { available: true; result: DeliveredResult | null }
  | { available: false }

/**
 * Look up the response already delivered for this payment.
 *
 * @returns `{ available: false }` when the store could not be consulted. The
 *   caller must fail the request, not proceed.
 */
export async function lookupDeliveredResult(
  id: SettledPaymentIdentity,
): Promise<DeliveredLookup> {
  try {
    const { data, error } = await supabaseAdmin
      .from('x402_settlements')
      .select('response_status, response_body, tx_hash, expires_at')
      .eq('network', id.network)
      .eq('payer', id.payer)
      .eq('nonce', id.nonce)
      .maybeSingle()

    if (error) return { available: false }
    if (!data) return { available: true, result: null }

    // Past its retention window the row is indistinguishable from absent. The
    // pruner may not have run yet, so this is checked on read as well.
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) {
      return { available: true, result: null }
    }

    return {
      available: true,
      result: {
        status: (data.response_status as number) ?? 200,
        body: data.response_body,
        txHash: (data.tx_hash as string | null) ?? null,
      },
    }
  } catch {
    return { available: false }
  }
}

export type StoreOutcome =
  /** Row written; this request owns the delivery. */
  | { stored: true; duplicate: false }
  /** Another concurrent request settled the same payment first. */
  | { stored: false; duplicate: true }
  /** Store unavailable. The payment settled but the binding was not recorded. */
  | { stored: false; duplicate: false }

/**
 * Record the response delivered for a settled payment.
 *
 * Awaited by the caller, never fire-and-forget: after SEC-02 the ability to
 * answer a retry depends on this row existing, so a lost write is a lost
 * purchase rather than a lost analytics event.
 *
 * A unique-violation (23505) means a concurrent request settled the same
 * payment first. That is reported as `duplicate`, not as an error — the caller
 * should serve the winner's stored result.
 */
export async function storeDeliveredResult(params: {
  id: SettledPaymentIdentity
  endpoint: string
  amountMicro: number
  txHash: string | null
  status: number
  body: unknown
}): Promise<StoreOutcome> {
  try {
    const { error } = await supabaseAdmin.from('x402_settlements').insert({
      network: params.id.network,
      payer: params.id.payer,
      nonce: params.id.nonce,
      endpoint: params.endpoint,
      amount_micro: params.amountMicro,
      tx_hash: params.txHash,
      response_status: params.status,
      response_body: params.body,
    })

    if (!error) return { stored: true, duplicate: false }
    if (error.code === '23505') return { stored: false, duplicate: true }

    console.error('x402: failed to persist delivered result', {
      endpoint: params.endpoint,
      code: error.code,
    })
    return { stored: false, duplicate: false }
  } catch (e) {
    console.error('x402: failed to persist delivered result', {
      endpoint: params.endpoint,
      error: e instanceof Error ? e.message : 'unknown',
    })
    return { stored: false, duplicate: false }
  }
}
