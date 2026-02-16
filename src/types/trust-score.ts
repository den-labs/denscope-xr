export type TrustConfidence = 'low' | 'medium' | 'high'

export type TrustScore = {
  chainId: number
  agentId: number
  score: number
  positiveRatio: number
  activityScore: number
  ageScore: number
  incidentPenalty: number
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  openIncidents: number
  confidence: TrustConfidence
  updatedAt: string
}

export type TrustScoreInput = {
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  firstSeen: string | null
  lastSeen: string | null
  openCriticalIncidents: number
  openWarningIncidents: number
  hasSybilIncident: boolean
}

export function toTrustScore(row: Record<string, unknown>): TrustScore {
  return {
    chainId: row.chain_id as number,
    agentId: row.agent_id as number,
    score: row.score as number,
    positiveRatio: Number(row.positive_ratio),
    activityScore: Number(row.activity_score),
    ageScore: Number(row.age_score),
    incidentPenalty: Number(row.incident_penalty),
    feedbackCount: row.feedback_count as number,
    positiveCount: row.positive_count as number,
    negativeCount: row.negative_count as number,
    openIncidents: row.open_incidents as number,
    confidence: row.confidence as TrustConfidence,
    updatedAt: row.updated_at as string,
  }
}
