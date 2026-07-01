import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Record a trust evaluation call in the audit log.
 * Called after an evaluation succeeds — fire-and-forget (non-blocking).
 * Never throws: a logging failure must not break the evaluation response.
 */
export async function recordEvaluation(params: {
  chainId: number
  agentId: number
  endpoint: string
  preset?: string
  authMethod: 'api_key' | 'x402'
}): Promise<void> {
  try {
    await supabaseAdmin.from('evaluation_log').insert({
      chain_id: params.chainId,
      agent_id: params.agentId,
      endpoint: params.endpoint,
      preset: params.preset ?? null,
      auth_method: params.authMethod,
    })
  } catch (e) {
    console.error('Failed to record evaluation:', e)
  }
}
