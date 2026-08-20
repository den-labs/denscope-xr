/**
 * Binds a settled payment to the response it bought (SEC-02).
 *
 * Without this, a client that loses the response has no way to recover it: the
 * only retry available is a fresh payment, which is a second charge for one
 * purchase. With it, presenting the same settled payment returns the same bytes.
 *
 * The key is the payment's own identity — `(network, payer, paymentId)` — not a
 * caller-supplied idempotency key. That distinction is the security property:
 * a caller cannot name someone else's result, because reaching this store at
 * all requires a payload the facilitator verified as paid by that payer.
 *
 * NAMING: the DB column is `nonce`, because that is what the deployed schema
 * calls it and renaming it would need a migration for no behavioural gain. In
 * code the field is `paymentId`, because only the EVM rail has an EIP-3009
 * nonce — on Stellar it is a canonical transaction hash, and propagating
 * `nonce` there would assert a protocol feature that does not exist. The two
 * names meet in this file and nowhere else.
 *
 * FAIL CLOSED. Every function here reports store unavailability rather than
 * swallowing it, and callers must refuse the paid request when it happens.
 * Treating a failed lookup as "no stored result" would recompute and re-settle
 * an already-paid request — precisely the double charge this exists to prevent.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { PaymentIdentity } from './rails/types'

export type { PaymentIdentity }

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
  id: PaymentIdentity,
): Promise<DeliveredLookup> {
  try {
    const { data, error } = await supabaseAdmin
      .from('x402_settlements')
      .select('response_status, response_body, tx_hash, expires_at')
      .eq('network', id.network)
      .eq('payer', id.payer)
      .eq('nonce', id.paymentId)
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

/**
 * Look up a delivered result by the PAYMENT alone, without a confirmed payer.
 *
 * Exists for rails where a consumed payment no longer verifies — Stellar, where
 * the facilitator re-simulates a transaction whose authorisation has been spent.
 * Without this, a buyer who lost the response could never reach the result they
 * paid for, because verification refuses before the keyed lookup is reached.
 *
 * `endpoint` is part of the query, not decoration: one payment buys one
 * resource, and a fingerprint must never re-deliver a result bought elsewhere.
 *
 * This does not weaken SEC-02. The caller must already hold the exact signed
 * payment bytes, which is the same bearer authority that bought the result in
 * the first place, and nothing here moves value or creates a settlement.
 *
 * @param key - Configured network, the rail's payment fingerprint, and the
 *   endpoint being requested.
 * @returns `{ available: false }` when the store could not be consulted. The
 *   caller must not read that as "no stored result".
 */
export async function lookupDeliveredByPayment(key: {
  network: string
  paymentId: string
  endpoint: string
}): Promise<DeliveredLookup> {
  try {
    const { data, error } = await supabaseAdmin
      .from('x402_settlements')
      .select('response_status, response_body, tx_hash, expires_at')
      .eq('network', key.network)
      .eq('nonce', key.paymentId)
      .eq('endpoint', key.endpoint)
      .maybeSingle()

    if (error) return { available: false }
    if (!data) return { available: true, result: null }

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
  id: PaymentIdentity
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
      nonce: params.id.paymentId,
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
