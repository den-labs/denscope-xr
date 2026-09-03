// src/lib/evaluation/gather.ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import { toTrustScore } from '@/types/trust-score'
import type { GatheredEvidence } from '@/types/evaluation'

export async function gatherEvidence(
  chainId: number,
  agentId: number,
): Promise<GatheredEvidence> {
  const [scoreResult, incidentResult, agentResult] = await Promise.all([
    supabaseAdmin
      .from('trust_scores')
      .select('*')
      .eq('chain_id', chainId)
      .eq('agent_id', agentId)
      .maybeSingle(),
    supabaseAdmin
      .from('incidents')
      .select('severity, signal_kind, resolved_at')
      .eq('chain_id', chainId)
      .eq('agent_id', agentId),
    supabaseAdmin
      .from('agents')
      .select('id, first_seen, last_seen')
      .eq('chain_id', chainId)
      .eq('agent_id', agentId)
      .maybeSingle(),
  ])

  if (!agentResult.data) {
    return {
      score: 0,
      scoreConfidence: 'low',
      positiveRatio: 0,
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      openIncidents: 0,
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
      resolvedSybilCount: 0,
      ageDays: 0,
      lastActivityDays: Infinity,
      agentExists: false,
      dataAsOf: null,
    }
  }

  const score = scoreResult.data ? toTrustScore(scoreResult.data) : null
  const incidents = incidentResult.data ?? []

  const openIncidents = incidents.filter((i) => !i.resolved_at)
  const openCritical = openIncidents.filter((i) => i.severity === 'critical').length
  const openWarning = openIncidents.filter((i) => i.severity === 'warning').length
  const hasSybilIncident = openIncidents.some((i) => i.signal_kind === 'sybil_cluster')
  const resolvedSybilCount = incidents.filter(
    (i) => i.signal_kind === 'sybil_cluster' && i.resolved_at,
  ).length

  const now = Date.now()
  const firstSeen = agentResult.data.first_seen as string | null
  const lastSeen = agentResult.data.last_seen as string | null
  const ageDays = firstSeen
    ? Math.floor((now - new Date(firstSeen).getTime()) / 86_400_000)
    : 0
  const lastActivityDays = lastSeen
    ? Math.floor((now - new Date(lastSeen).getTime()) / 86_400_000)
    : Infinity

  return {
    score: score?.score ?? 0,
    scoreConfidence: score?.confidence ?? 'low',
    positiveRatio: score?.positiveRatio ?? 0,
    feedbackCount: score?.feedbackCount ?? 0,
    positiveCount: score?.positiveCount ?? 0,
    negativeCount: score?.negativeCount ?? 0,
    openIncidents: openIncidents.length,
    openCriticalIncidents: openCritical,
    openWarningIncidents: openWarning,
    hasSybilIncident,
    resolvedSybilCount,
    ageDays,
    lastActivityDays,
    agentExists: true,
    dataAsOf: freshestOf(score?.updatedAt, lastSeen),
  }
}

/** Newest of the dated inputs, ISO 8601. Null when neither is dated. */
function freshestOf(...candidates: (string | null | undefined)[]): string | null {
  const times = candidates
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
    .map((c) => new Date(c).getTime())
    .filter((t) => Number.isFinite(t))
  if (times.length === 0) return null
  return new Date(Math.max(...times)).toISOString()
}
