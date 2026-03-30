import type { GatheredEvidence, InterpretationResult } from '@/types/evaluation'

export function generateRationale(
  evidence: GatheredEvidence,
  interpretation: InterpretationResult,
): string {
  const parts: string[] = []

  if (interpretation.trust_band === 'insufficient_signal') {
    parts.push(
      `Agent has only ${evidence.feedbackCount} feedback(s) — insufficient signal for evaluation.`,
    )
  } else {
    const pct = Math.round(evidence.positiveRatio * 100)
    parts.push(
      `Agent scores ${evidence.score}/100 with ${evidence.scoreConfidence} confidence (${evidence.feedbackCount} feedbacks, ${pct}% positive).`,
    )
  }

  if (evidence.openIncidents > 0) {
    const critical = evidence.openCriticalIncidents
    const warning = evidence.openWarningIncidents
    const details = [
      critical > 0 ? `${critical} critical` : '',
      warning > 0 ? `${warning} warning` : '',
    ].filter(Boolean).join(', ')
    parts.push(`${evidence.openIncidents} open incident(s) (${details}).`)
  } else {
    parts.push('No open incidents.')
  }

  if (evidence.hasSybilIncident) {
    parts.push('Active sybil cluster detected.')
  }

  if (interpretation.status === 'dormant') {
    parts.push(`Status dormant — no activity in ${evidence.lastActivityDays} days.`)
  } else if (interpretation.status === 'stale') {
    parts.push(`Stale — last activity ${evidence.lastActivityDays} days ago.`)
  } else if (interpretation.status === 'anomalous') {
    parts.push('Status anomalous due to severe incidents.')
  } else {
    parts.push(`Active within last ${evidence.lastActivityDays} day(s).`)
  }

  parts.push(`Recommended action: ${interpretation.recommended_action}.`)

  return parts.join(' ')
}
