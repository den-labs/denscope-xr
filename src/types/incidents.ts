export type IncidentSignalKind =
  | 'reputation_drop'
  | 'sybil_cluster'
  | 'feedback_spike'
  | 'first_interaction'
  | 'validation_complete'
  | 'going_cold'

export type IncidentSeverity = 'info' | 'warning' | 'critical'

export type Incident = {
  id: string
  chainId: number
  agentId: number
  signalKind: IncidentSignalKind
  severity: IncidentSeverity
  title: string
  description: string
  whyItMatters: string | null
  sourceTxHash?: string
  triggeredAt: string
  resolvedAt?: string | null
  metadata: Record<string, unknown>
}

/** Map DB row (snake_case) -> Incident (camelCase) */
export function toIncident(row: Record<string, unknown>): Incident {
  return {
    id: row.id as string,
    chainId: row.chain_id as number,
    agentId: row.agent_id as number,
    signalKind: row.signal_kind as IncidentSignalKind,
    severity: row.severity as IncidentSeverity,
    title: row.title as string,
    description: row.description as string,
    whyItMatters: (row.why_it_matters as string) ?? null,
    sourceTxHash: row.source_tx_hash as string | undefined,
    triggeredAt: row.triggered_at as string,
    resolvedAt: row.resolved_at as string | null | undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}
