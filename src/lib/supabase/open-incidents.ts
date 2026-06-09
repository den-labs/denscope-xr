import { supabase } from './client'
import type { OpenIncident, IncidentSeverity } from '@/lib/trust-snapshot/types'

// Severity precedence for N4 sort (critical > warning > info).
const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
}

type IncidentRow = {
  id: string
  signal_kind: string
  severity: IncidentSeverity
  triggered_at: string
}

/**
 * Open incidents for an agent (resolved_at IS NULL), sorted by severity desc
 * (critical > warning > info), then openedAt desc. Implements the N4 ordering
 * contract from spec §4.1 so downstream derivation can rely on it.
 */
export async function fetchOpenIncidents(
  chainId: number,
  agentId: number
): Promise<OpenIncident[]> {
  if (!supabase) return []

  const { data } = await supabase
    .from('incidents')
    .select('id, signal_kind, severity, triggered_at')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .is('resolved_at', null)

  const rows = (data ?? []) as IncidentRow[]

  return rows
    .map((r) => ({
      id: r.id,
      severity: r.severity,
      kind: r.signal_kind,
      openedAt: r.triggered_at,
    }))
    .sort((a, b) => {
      const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
      if (bySeverity !== 0) return bySeverity
      return b.openedAt.localeCompare(a.openedAt)
    })
}
