import { supabase } from './client'
import type { Incident, IncidentSignalKind, IncidentSeverity } from '@/types/incidents'
import { toIncident } from '@/types/incidents'

type BuildIncidentParams = {
  chainId: number
  agentId: number
  signalKind: IncidentSignalKind
  severity: IncidentSeverity
  title: string
  description: string
  whyItMatters?: string
  sourceTxHash?: string
  metadata?: Record<string, unknown>
}

export function buildIncidentRow(params: BuildIncidentParams) {
  return {
    chain_id: params.chainId,
    agent_id: params.agentId,
    signal_kind: params.signalKind,
    severity: params.severity,
    title: params.title,
    description: params.description,
    why_it_matters: params.whyItMatters ?? null,
    source_tx_hash: params.sourceTxHash ?? null,
    metadata: params.metadata ?? {},
  }
}

export async function fetchIncidents(
  chainId: number,
  agentId: number,
  limit = 20
): Promise<Incident[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('incidents')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('triggered_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(toIncident)
}

export async function fetchIncidentsForOwner(
  walletAddress: string,
  limit = 50
): Promise<Incident[]> {
  if (!supabase) return []
  // Join via owner_profiles to get incidents for all claimed agents
  const { data: profiles } = await supabase
    .from('owner_profiles')
    .select('chain_id, agent_id')
    .eq('wallet_address', walletAddress.toLowerCase())
  if (!profiles || profiles.length === 0) return []

  const filters = profiles.map(
    (p) => `and(chain_id.eq.${p.chain_id},agent_id.eq.${p.agent_id})`
  )
  const { data } = await supabase
    .from('incidents')
    .select('*')
    .or(filters.join(','))
    .order('triggered_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(toIncident)
}

export async function fetchOpenIncidentCount(
  walletAddress: string
): Promise<number> {
  if (!supabase) return 0
  const { data: profiles } = await supabase
    .from('owner_profiles')
    .select('chain_id, agent_id')
    .eq('wallet_address', walletAddress.toLowerCase())
  if (!profiles || profiles.length === 0) return 0

  const filters = profiles.map(
    (p) => `and(chain_id.eq.${p.chain_id},agent_id.eq.${p.agent_id})`
  )
  const { count } = await supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .or(filters.join(','))
    .is('resolved_at', null)
  return count ?? 0
}
