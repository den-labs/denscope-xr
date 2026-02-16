import type { TrustConfidence, TrustScoreInput } from '@/types/trust-score'

const WEIGHTS = {
  positiveRatio: 0.40,
  age: 0.20,
  activity: 0.20,
  incident: 0.10,
  sybil: 0.10,
} as const

const AGE_CAP_DAYS = 90
const ACTIVITY_DIVISOR = 2

export type ComputedScore = {
  score: number
  positiveRatio: number
  activityScore: number
  ageScore: number
  incidentPenalty: number
  confidence: TrustConfidence
}

export function computeTrustScore(input: TrustScoreInput): ComputedScore {
  const {
    feedbackCount,
    positiveCount,
    firstSeen,
    lastSeen,
    openCriticalIncidents,
    openWarningIncidents,
    hasSybilIncident,
  } = input

  if (feedbackCount === 0) {
    return {
      score: 0,
      positiveRatio: 0,
      activityScore: 0,
      ageScore: 0,
      incidentPenalty: 0,
      confidence: 'low',
    }
  }

  const positiveRatio = positiveCount / feedbackCount

  let ageScore = 0
  if (firstSeen) {
    const ageDays = (Date.now() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000)
    ageScore = Math.min(ageDays / AGE_CAP_DAYS, 1.0)
  }

  let activityScore = 0
  if (firstSeen && lastSeen) {
    const activeDays = Math.max(
      (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000),
      1
    )
    activityScore = Math.min(feedbackCount / (activeDays * ACTIVITY_DIVISOR), 1.0)
  }

  const rawIncidentPenalty =
    openCriticalIncidents * 0.15 +
    openWarningIncidents * 0.05
  const incidentPenalty = Math.min(rawIncidentPenalty, 1.0)

  const sybilPenalty = hasSybilIncident ? 1.0 : 0.0

  const rawScore =
    WEIGHTS.positiveRatio * positiveRatio +
    WEIGHTS.age * ageScore +
    WEIGHTS.activity * activityScore -
    WEIGHTS.incident * incidentPenalty -
    WEIGHTS.sybil * sybilPenalty

  const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)))

  let confidence: TrustConfidence = 'low'
  if (feedbackCount >= 10) confidence = 'high'
  else if (feedbackCount >= 3) confidence = 'medium'

  return {
    score,
    positiveRatio: Math.round(positiveRatio * 10000) / 10000,
    activityScore: Math.round(activityScore * 10000) / 10000,
    ageScore: Math.round(ageScore * 10000) / 10000,
    incidentPenalty: Math.round(incidentPenalty * 10000) / 10000,
    confidence,
  }
}
