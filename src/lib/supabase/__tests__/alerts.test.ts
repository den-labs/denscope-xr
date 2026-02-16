import { describe, it, expect } from 'vitest'
import { buildDefaultRules } from '@/lib/supabase/alerts'

describe('alerts helpers', () => {
  it('generates 3 default alert rules for an agent', () => {
    const rules = buildDefaultRules({
      ownerAddress: '0xabc',
      chainId: 42220,
      agentId: 5,
    })
    expect(rules).toHaveLength(3)
    expect(rules.map((r) => r.rule_type).sort()).toEqual([
      'going_cold',
      'reputation_drop',
      'sybil_detected',
    ])
    rules.forEach((r) => {
      expect(r.owner_address).toBe('0xabc')
      expect(r.enabled).toBe(true)
    })
  })
})
