import { supabase } from '@/lib/supabase/client'
import { toTrustScore } from '@/types/trust-score'
import type { TrustScore } from '@/types/trust-score'
import type { ComputedScore } from '@/lib/reputation/compute'

export type BuildTrustScoreRowParams = {
  chainId: number
  agentId: number
  computed: ComputedScore
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  openIncidents: number
}

export function buildTrustScoreRow(params: BuildTrustScoreRowParams) {
  const { chainId, agentId, computed, feedbackCount, positiveCount, negativeCount, openIncidents } = params
  return {
    id: `${chainId}:${agentId}`,
    chain_id: chainId,
    agent_id: agentId,
    score: computed.score,
    positive_ratio: computed.positiveRatio,
    activity_score: computed.activityScore,
    age_score: computed.ageScore,
    incident_penalty: computed.incidentPenalty,
    feedback_count: feedbackCount,
    positive_count: positiveCount,
    negative_count: negativeCount,
    open_incidents: openIncidents,
    confidence: computed.confidence,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchTrustScore(
  chainId: number,
  agentId: number,
): Promise<TrustScore | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('trust_scores')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()
  return data ? toTrustScore(data) : null
}

export async function fetchTrustScoresByChain(
  chainId: number,
  limit = 50,
): Promise<TrustScore[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('trust_scores')
    .select('*')
    .eq('chain_id', chainId)
    .order('score', { ascending: false })
    .limit(limit)
  return (data ?? []).map(toTrustScore)
}
