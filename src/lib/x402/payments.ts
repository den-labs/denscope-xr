import { supabaseAdmin } from '@/lib/supabase/admin'
import { x402Config, facilitatorGuard } from './config'

/**
 * Append-only revenue ledger for settled x402 payments.
 *
 * Previously invoked without `await`, without `.catch()` and without `after()`
 * (SEC-03). On Vercel a promise created during a request may be terminated once
 * the response is returned, so rows were lost silently — money taken, nothing
 * recorded — and a rejected insert surfaced as an unhandled rejection.
 *
 * Now awaited by the caller and internally total: it records what it can and
 * never throws, because a ledger failure must not undo a settled payment. The
 * *replay-critical* binding lives in `x402_settlements` (see idempotency.ts) and
 * is reported to the caller separately; this table is the audit trail.
 */
export async function recordX402Payment(params: {
  chainId: number
  agentId: number
  endpoint: string
  payer: string
  transaction: string | null
  priceKey: string
  network: string
}): Promise<void> {
  const price = x402Config.pricing[params.priceKey] ?? 0.001
  const amountMicro = Math.round(price * 1_000_000)
  const guard = facilitatorGuard()

  try {
    const { error } = await supabaseAdmin.from('x402_payments').insert({
      chain_id: params.chainId,
      agent_id: params.agentId,
      endpoint: params.endpoint,
      payer_address: params.payer,
      amount_micro: amountMicro,
      tx_hash: params.transaction,
      // Derived from the guarded configuration rather than hardcoded, so the
      // ledger cannot claim a facilitator that was not actually used.
      facilitator: guard.ok ? guard.host : 'unknown',
      network: params.network,
      stablecoin: 'USDC',
    })
    if (error) {
      console.error('x402: failed to record payment in ledger', {
        endpoint: params.endpoint,
        tx: params.transaction,
        code: error.code,
      })
    }
  } catch (e) {
    console.error('x402: failed to record payment in ledger', {
      endpoint: params.endpoint,
      tx: params.transaction,
      error: e instanceof Error ? e.message : 'unknown',
    })
  }
}
