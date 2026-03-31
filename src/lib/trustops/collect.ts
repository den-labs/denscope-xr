import { supabaseAdmin } from '@/lib/supabase/admin'

export type TrustBandDistribution = {
  high: number
  medium: number
  low: number
  insufficient: number
}

export type TrustOpsOverview = {
  totalAgents: number
  trustBands: TrustBandDistribution
  elevatedRiskCount: number
  criticalRiskCount: number
  openIncidents: number
  recentEvaluations: EvaluationLogEntry[]
  collectedAt: string
}

export type EvaluationLogEntry = {
  chainId: number
  agentId: number
  endpoint: string
  calledAt: string
}

export async function collectTrustOpsOverview(): Promise<TrustOpsOverview> {
  const [
    agentsResult,
    scoresResult,
    incidentsResult,
    evaluationsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('agents')
      .select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('trust_scores')
      .select('score, feedback_count, confidence'),
    supabaseAdmin
      .from('incidents')
      .select('id, severity', { count: 'exact' })
      .is('resolved_at', null),
    supabaseAdmin
      .from('api_usage_log')
      .select('chain_id, agent_id, endpoint, called_at')
      .like('endpoint', '%/trust/evaluate%')
      .order('called_at', { ascending: false })
      .limit(20),
  ])

  const queryError = agentsResult.error ?? scoresResult.error ?? incidentsResult.error ?? evaluationsResult.error
  if (queryError) {
    throw new Error(`Supabase query failed: ${queryError.message}`)
  }

  const totalAgents = agentsResult.count ?? 0
  const scores = scoresResult.data ?? []
  const openIncidents = incidentsResult.count ?? 0
  const evaluationLogs = evaluationsResult.data ?? []

  // Derive trust band distribution from scores using default_safety thresholds
  const trustBands: TrustBandDistribution = { high: 0, medium: 0, low: 0, insufficient: 0 }
  for (const row of scores) {
    const score = row.score as number
    const feedbackCount = row.feedback_count as number
    if (feedbackCount < 3) {
      trustBands.insufficient++
    } else if (score >= 60) {
      trustBands.high++
    } else if (score >= 35) {
      trustBands.medium++
    } else {
      trustBands.low++
    }
  }

  // Count agents with elevated/critical risk indicators
  const incidents = incidentsResult.data ?? []
  const criticalIncidents = incidents.filter((i) => (i.severity as string) === 'critical')
  const criticalRiskCount = criticalIncidents.length
  const elevatedRiskCount = incidents.length - criticalRiskCount

  const recentEvaluations: EvaluationLogEntry[] = evaluationLogs.map((row) => ({
    chainId: row.chain_id as number,
    agentId: row.agent_id as number,
    endpoint: row.endpoint as string,
    calledAt: row.called_at as string,
  }))

  return {
    totalAgents,
    trustBands,
    elevatedRiskCount,
    criticalRiskCount,
    openIncidents,
    recentEvaluations,
    collectedAt: new Date().toISOString(),
  }
}
