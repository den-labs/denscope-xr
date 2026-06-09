import {
  DIMENSION_LABEL,
  DIMENSION_ORDER,
  type Confidence,
  type DimensionKey,
  type DimensionResult,
  type OpenIncident,
  type Verdict,
} from './types'

export interface PrimaryWatchoutInput {
  openIncidents: OpenIncident[]
  radar: Record<DimensionKey, DimensionResult>
  confidence: Confidence
  feedbackCount: number
}

// §4.3.1 ordering rule. Returns null if nothing watchable.
export function derivePrimaryWatchout(input: PrimaryWatchoutInput): string | null {
  const critical = input.openIncidents.find((i) => i.severity === 'critical')
  if (critical) return `Open critical incident (${critical.kind})`

  const warning = input.openIncidents.find((i) => i.severity === 'warning')
  if (warning) return `Open warning incident (${warning.kind})`

  const lowDim = pickLowestDimensionBelow40(input.radar)
  if (lowDim) {
    return `Low ${DIMENSION_LABEL[lowDim.key]} score (${lowDim.value}/100)`
  }

  if (input.confidence === 'low' && input.feedbackCount < 3) {
    return 'Insufficient feedback to validate score'
  }

  return null
}

function pickLowestDimensionBelow40(
  radar: Record<DimensionKey, DimensionResult>
): { key: DimensionKey; value: number } | null {
  let pick: { key: DimensionKey; value: number } | null = null
  for (const key of DIMENSION_ORDER) {
    const value = radar[key].value
    if (value >= 40) continue
    if (pick === null || value < pick.value) {
      pick = { key, value }
    }
  }
  return pick
}

export interface SummaryInput {
  verdict: Verdict
  score: number | null
  ageDays: number
  positiveCount: number
  feedbackCount: number
  connectedProtocols: number
  primaryWatchout: string | null
}

// §4.3 deterministic templates. No free-form generation.
export function buildSummary(input: SummaryInput): string {
  switch (input.verdict) {
    case 'ready':
      return `Active for ${input.ageDays}d with ${input.positiveCount}/${input.feedbackCount} positive feedback and ${input.connectedProtocols} protocols connected.`

    case 'warming-up': {
      const plural = input.feedbackCount === 1 ? '' : 's'
      return `Newer agent (${input.ageDays}d) with ${input.feedbackCount} feedback${plural}. Track record building.`
    }

    case 'caution':
      if (input.primaryWatchout) {
        return `${input.primaryWatchout}. Recommend additional review before coordination.`
      }
      return `Trust score ${formatScore(input.score)}/100. Review evidence before coordination.`

    case 'insufficient-data':
      return `Agent registered ${input.ageDays}d ago. No feedback yet — too early to score.`
  }
}

function formatScore(score: number | null): string {
  return score === null ? '—' : String(score)
}
