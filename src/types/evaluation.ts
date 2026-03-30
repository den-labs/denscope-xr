// --- Enums ---
export type TrustBand = 'high' | 'medium' | 'low' | 'insufficient_signal'
export type EvalStatus = 'active' | 'stale' | 'dormant' | 'anomalous'
export type SignalStrength = 'strong' | 'moderate' | 'weak' | 'none'
export type RiskLevel = 'minimal' | 'moderate' | 'elevated' | 'critical'
export type DecisionConfidence = 'low' | 'medium' | 'high'
export type RecommendedAction = 'allow' | 'review' | 'limit'
export type PresetId = 'default_safety' | 'agent_to_agent' | 'defi_counterparty'
export type SybilWeight = 'normal' | 'elevated' | 'critical'

// --- Request ---
export type EvaluateRequest = {
  chainId: number
  agentId: number
  preset: PresetId
  context?: string
  sensitivity?: 'low' | 'normal' | 'high'
  objective?: string
}

// --- Evidence (gathered from existing functions) ---
export type GatheredEvidence = {
  score: number
  scoreConfidence: 'low' | 'medium' | 'high'
  positiveRatio: number
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  openIncidents: number
  openCriticalIncidents: number
  openWarningIncidents: number
  hasSybilIncident: boolean
  resolvedSybilCount: number
  ageDays: number
  lastActivityDays: number
  agentExists: boolean
}

// --- Preset Config (internal) ---
export type PresetConfig = {
  id: PresetId
  label: string
  description: string
  trustBand: {
    high: number
    medium: number
    low: number
  }
  minFeedbacks: number
  minConfidence: 'low' | 'medium' | 'high'
  sybilWeight: SybilWeight
  incidentTolerance: number
  allowThreshold: number
  reviewThreshold: number
  staleDays: number
  dormantDays: number
}

// --- Interpretation result (before rationale) ---
export type InterpretationResult = {
  trust_band: TrustBand
  status: EvalStatus
  signal_strength: SignalStrength
  risk_level: RiskLevel
  decision_confidence: DecisionConfidence
  recommended_action: RecommendedAction
  flags: string[]
}

// --- Response ---
export type EvaluationEvidence = {
  score: number
  score_confidence: 'low' | 'medium' | 'high'
  feedbackCount: number
  positiveRatio: number  // 0.0-1.0
  openIncidents: number
  lastActivityDays: number
  ageDays: number
}

export type Evaluation = {
  trust_band: TrustBand
  status: EvalStatus
  signal_strength: SignalStrength
  risk_level: RiskLevel
  decision_confidence: DecisionConfidence
  recommended_action: RecommendedAction
  flags: string[]
  rationale: string
  evidence: EvaluationEvidence
  preset: PresetId
  evaluatedAt: string
  chainId: number
  agentId: number
}

export type EvaluateResponse = {
  evaluation: Evaluation
}
