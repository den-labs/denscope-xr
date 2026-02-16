import { describe, it, expect } from 'vitest'
import { buildIncidentRow } from '@/lib/supabase/incidents'

describe('incidents helpers', () => {
  it('builds an incident row from params', () => {
    const row = buildIncidentRow({
      chainId: 42220,
      agentId: 5,
      signalKind: 'reputation_drop',
      severity: 'warning',
      title: 'Reputation Drop',
      description: 'Score dropped 30% in 24h',
      whyItMatters: 'Review recent interactions',
    })
    expect(row).toEqual({
      chain_id: 42220,
      agent_id: 5,
      signal_kind: 'reputation_drop',
      severity: 'warning',
      title: 'Reputation Drop',
      description: 'Score dropped 30% in 24h',
      why_it_matters: 'Review recent interactions',
      source_tx_hash: null,
      metadata: {},
    })
  })

  it('includes optional source_tx_hash', () => {
    const row = buildIncidentRow({
      chainId: 42220,
      agentId: 5,
      signalKind: 'first_interaction',
      severity: 'info',
      title: 'First Feedback',
      description: 'Agent received first feedback',
      sourceTxHash: '0xabc',
    })
    expect(row.source_tx_hash).toBe('0xabc')
  })
})
