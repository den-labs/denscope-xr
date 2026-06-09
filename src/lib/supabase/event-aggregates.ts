import { supabase } from './client'

/** Count of scope_events for an agent on/after `sinceIso` (last-30d window). */
export async function fetchRecentEventCount(
  chainId: number,
  agentId: number,
  sinceIso: string
): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase
    .from('scope_events')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .gte('event_timestamp', sinceIso)
  return count ?? 0
}

/** Count of `validation_res` events for an agent (all time). */
export async function fetchValidationEventCount(
  chainId: number,
  agentId: number
): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase
    .from('scope_events')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .eq('kind', 'validation_res')
  return count ?? 0
}

/** Whether a `reputation_drop` incident was triggered on/after `sinceIso`. */
export async function fetchHasRecentReputationDrop(
  chainId: number,
  agentId: number,
  sinceIso: string
): Promise<boolean> {
  if (!supabase) return false
  const { count } = await supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .eq('signal_kind', 'reputation_drop')
    .gte('triggered_at', sinceIso)
  return (count ?? 0) > 0
}
