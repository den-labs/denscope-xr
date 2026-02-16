import { supabaseAdmin } from '@/lib/supabase/admin'
import type { X402Context } from './types'
import { x402Config } from './config'

/**
 * Record a successful x402 payment in the audit trail.
 * Called after settlement succeeds — fire-and-forget (non-blocking).
 */
export async function recordX402Payment(params: {
  chainId: number
  agentId: number
  endpoint: string
  x402: X402Context
  priceKey: string
}): Promise<void> {
  const price = x402Config.pricing[params.priceKey] ?? 0.001
  const amountMicro = Math.round(price * 1_000_000)

  await supabaseAdmin.from('x402_payments').insert({
    chain_id: params.chainId,
    agent_id: params.agentId,
    endpoint: params.endpoint,
    payer_address: params.x402.payer,
    amount_micro: amountMicro,
    tx_hash: params.x402.transaction ?? null,
    facilitator: 'ultravioletadao',
    network: x402Config.network,
    stablecoin: 'USDC',
  })
}
