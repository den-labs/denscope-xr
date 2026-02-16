import { describe, it, expect } from 'vitest'
import { buildTrustScoreRow } from '@/lib/supabase/trust-scores'

describe('trust-scores helpers', () => {
  it('builds a trust_scores row from compute result', () => {
    const row = buildTrustScoreRow({
      chainId: 42220,
      agentId: 5,
      computed: {
        score: 78,
        positiveRatio: 0.85,
        activityScore: 0.6,
        ageScore: 0.33,
        incidentPenalty: 0,
        confidence: 'high',
      },
      feedbackCount: 20,
      positiveCount: 17,
      negativeCount: 3,
      openIncidents: 0,
    })
    expect(row).toEqual({
      id: '42220:5',
      chain_id: 42220,
      agent_id: 5,
      score: 78,
      positive_ratio: 0.85,
      activity_score: 0.6,
      age_score: 0.33,
      incident_penalty: 0,
      feedback_count: 20,
      positive_count: 17,
      negative_count: 3,
      open_incidents: 0,
      confidence: 'high',
      updated_at: expect.any(String),
    })
  })
})
