import { supabase } from './client'
import type { AgentSummary } from '@/types/agents'

type DbAgent = {
  chain_id: number
  agent_id: number
  owner: string
  uri: string
  feedback_count: number
  positive_count: number
  negative_count: number
  first_seen: string | null
}

function toAgentSummary(row: DbAgent): AgentSummary {
  return {
    agentId: row.agent_id,
    chainId: row.chain_id,
    owner: row.owner ?? '',
    agentURI: row.uri ?? '',
    feedbackCount: row.feedback_count ?? 0,
    positiveFeedback: row.positive_count ?? 0,
    negativeFeedback: row.negative_count ?? 0,
    lastEventBlock: 0,
    registeredAt: row.first_seen ? new Date(row.first_seen).getTime() : undefined,
  }
}

export async function searchAgents(query: string, limit = 20): Promise<AgentSummary[]> {
  if (!supabase || !query.trim()) return []

  const q = query.trim()
  const isNumeric = /^\d+$/.test(q)

  if (isNumeric) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('agent_id', Number(q))
      .limit(limit)

    if (error || !data) return []
    return (data as DbAgent[]).map(toAgentSummary)
  }

  // Text search: try owner address prefix or use ilike on metadata
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .or(`owner.ilike.%${q}%,uri.ilike.%${q}%`)
    .limit(limit)

  if (error || !data) return []
  return (data as DbAgent[]).map(toAgentSummary)
}
