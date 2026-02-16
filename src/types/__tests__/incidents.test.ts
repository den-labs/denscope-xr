// src/types/__tests__/incidents.test.ts
import { describe, it, expect } from 'vitest'
import type { Incident, IncidentSignalKind } from '@/types/incidents'
import type { AlertRule, AlertRuleType } from '@/types/alerts'

describe('Incident type', () => {
  it('has all required fields', () => {
    const incident: Incident = {
      id: 'uuid',
      chainId: 42220,
      agentId: 5,
      signalKind: 'reputation_drop',
      severity: 'warning',
      title: 'Reputation Drop',
      description: 'Test',
      whyItMatters: 'Test reason',
      triggeredAt: '2026-02-16T00:00:00Z',
      metadata: {},
    }
    expect(incident.signalKind).toBe('reputation_drop')
  })

  it('covers all signal kinds', () => {
    const kinds: IncidentSignalKind[] = [
      'reputation_drop', 'sybil_cluster', 'feedback_spike',
      'first_interaction', 'validation_complete', 'going_cold',
    ]
    expect(kinds).toHaveLength(6)
  })
})

describe('AlertRule type', () => {
  it('covers all 3 predefined rule types', () => {
    const types: AlertRuleType[] = ['reputation_drop', 'sybil_detected', 'going_cold']
    expect(types).toHaveLength(3)
  })

  it('has required fields', () => {
    const rule: AlertRule = {
      id: 'uuid',
      ownerAddress: '0x123',
      chainId: 42220,
      agentId: 5,
      ruleType: 'reputation_drop',
      enabled: true,
      webhookUrl: null,
      createdAt: '2026-02-16T00:00:00Z',
      updatedAt: '2026-02-16T00:00:00Z',
    }
    expect(rule.ruleType).toBe('reputation_drop')
  })
})
