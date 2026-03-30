import type {
  GatheredEvidence,
  PresetConfig,
  InterpretationResult,
  TrustBand,
  EvalStatus,
  SignalStrength,
  RiskLevel,
  DecisionConfidence,
  RecommendedAction,
} from '@/types/evaluation'

const CONFIDENCE_ORDER = { low: 0, medium: 1, high: 2 } as const

export function interpretEvidence(
  evidence: GatheredEvidence,
  preset: PresetConfig,
): InterpretationResult {
  const flags = collectFlags(evidence, preset)
  const insufficientSignal = evidence.feedbackCount < preset.minFeedbacks

  const trust_band = deriveTrustBand(evidence, preset, insufficientSignal)
  const status = deriveStatus(evidence, preset)
  const signal_strength = deriveSignalStrength(evidence, preset)
  const risk_level = deriveRiskLevel(evidence, preset)
  const recommended_action = deriveAction(evidence, preset, status, insufficientSignal)
  const decision_confidence = deriveDecisionConfidence(signal_strength, flags, status)

  return {
    trust_band,
    status,
    signal_strength,
    risk_level,
    decision_confidence,
    recommended_action,
    flags,
  }
}

function deriveTrustBand(
  evidence: GatheredEvidence,
  preset: PresetConfig,
  insufficientSignal: boolean,
): TrustBand {
  if (insufficientSignal) return 'insufficient_signal'
  if (evidence.score >= preset.trustBand.high) return 'high'
  if (evidence.score >= preset.trustBand.medium) return 'medium'
  return 'low'
}

function deriveStatus(evidence: GatheredEvidence, preset: PresetConfig): EvalStatus {
  if (evidence.openCriticalIncidents > 0) return 'anomalous'
  if (evidence.hasSybilIncident) return 'anomalous'
  if (evidence.lastActivityDays >= preset.dormantDays) return 'dormant'
  if (evidence.lastActivityDays >= preset.staleDays) return 'stale'
  return 'active'
}

function deriveSignalStrength(
  evidence: GatheredEvidence,
  preset: PresetConfig,
): SignalStrength {
  if (evidence.feedbackCount < preset.minFeedbacks) return 'none'
  if (evidence.feedbackCount >= 20 && evidence.scoreConfidence === 'high') return 'strong'
  if (CONFIDENCE_ORDER[evidence.scoreConfidence] >= CONFIDENCE_ORDER[preset.minConfidence]) return 'moderate'
  return 'weak'
}

function deriveRiskLevel(evidence: GatheredEvidence, preset: PresetConfig): RiskLevel {
  if (evidence.hasSybilIncident && preset.sybilWeight === 'critical') return 'critical'
  if (evidence.openCriticalIncidents > 0) return 'critical'
  if (evidence.hasSybilIncident) return 'elevated'
  if (evidence.openIncidents > preset.incidentTolerance) return 'elevated'
  if (evidence.openIncidents > 0) return 'moderate'
  if (evidence.resolvedSybilCount > 0) return 'moderate'
  return 'minimal'
}

function deriveAction(
  evidence: GatheredEvidence,
  preset: PresetConfig,
  status: EvalStatus,
  insufficientSignal: boolean,
): RecommendedAction {
  // 1. HARD GATES
  if (insufficientSignal) return 'limit'
  if (preset.sybilWeight === 'critical' && evidence.hasSybilIncident) return 'limit'
  if (preset.incidentTolerance === 0 && evidence.openCriticalIncidents > 0) return 'limit'

  // 2. PRESET THRESHOLDS
  let action: RecommendedAction
  if (evidence.score >= preset.allowThreshold) action = 'allow'
  else if (evidence.score >= preset.reviewThreshold) action = 'review'
  else action = 'limit'

  // 3. FRESHNESS MODIFIERS (can only downgrade)
  if (status === 'dormant' && action === 'allow') action = 'review'
  if (status === 'anomalous') {
    if (action === 'allow') action = 'review'
    else if (action === 'review') action = 'limit'
  }

  return action
}

function deriveDecisionConfidence(
  signal_strength: SignalStrength,
  flags: string[],
  status: EvalStatus,
): DecisionConfidence {
  if (signal_strength === 'none') return 'low'

  const conflictingFlags = flags.filter((f) =>
    f === 'sybil_risk_high' ||
    f === 'incident_open_critical'
  )

  if (status === 'anomalous' && signal_strength === 'weak') return 'low'
  if (conflictingFlags.length >= 2) return 'low'
  if (signal_strength === 'weak') return 'medium'
  if (conflictingFlags.length === 1) return 'medium'
  return 'high'
}

function collectFlags(evidence: GatheredEvidence, preset: PresetConfig): string[] {
  const flags: string[] = []
  if (evidence.feedbackCount < preset.minFeedbacks) flags.push('insufficient_signal')
  if (evidence.hasSybilIncident) flags.push('sybil_risk_high')
  if (!evidence.hasSybilIncident && evidence.resolvedSybilCount > 0) flags.push('sybil_risk_resolved')
  if (evidence.openCriticalIncidents > 0) flags.push('incident_open_critical')
  if (evidence.openWarningIncidents > 0) flags.push('incident_open_warning')
  if (evidence.lastActivityDays >= preset.dormantDays) flags.push('dormant')
  else if (evidence.lastActivityDays >= preset.staleDays) flags.push('no_recent_activity')
  if (evidence.ageDays < 7) flags.push('newly_registered')
  return flags
}
