import type { AgentMetadata } from '@/types/agents'
import type { TrustScore } from '@/types/trust-score'
import {
  countConnectedProtocols,
  deriveCoordinationBadges,
} from './coordination-badges'
import { suggestImprovements } from './improvements'
import {
  deriveCoordinationDim,
  deriveIdentityDim,
  deriveReliabilityDim,
  deriveReputationDim,
  deriveSafetyDim,
} from './radar'
import { buildSummary, derivePrimaryWatchout } from './summary'
import {
  DIMENSION_LABEL,
  DIMENSION_ORDER,
  type DimensionKey,
  type DimensionResult,
  type OpenIncident,
  type RecommendedAction,
  type TrustSnapshotData,
  type Verdict,
} from './types'
import { deriveVerdict } from './verdict'

// Inputs flow into the orchestrator from the Phase B fetcher.
// Order of derivation follows spec §4.10 (N9 fix).
export interface TrustSnapshotInputs {
  trustScore: TrustScore | null
  metadata: AgentMetadata | null
  uriPresent: boolean
  ownerResolved: boolean
  claimed: boolean
  firstSeen: string | null
  lastSeen: string | null
  totalEvents: number
  uriUpdateCount: number
  feedbackCount: number
  positiveCount: number
  recentEventCount: number
  validationEventCount: number
  openIncidents: OpenIncident[]
  hasSybilHistory: boolean
  hasRecentReputationDrop: boolean
  now?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export function buildTrustSnapshot(
  inputs: TrustSnapshotInputs
): TrustSnapshotData {
  const now = inputs.now ?? Date.now()
  const ageDays = inputs.firstSeen
    ? Math.floor((now - new Date(inputs.firstSeen).getTime()) / DAY_MS)
    : 0

  // Step 1: coordination badges (pure of metadata + events + lastSeen).
  const coordinationBadges = deriveCoordinationBadges({
    metadata: inputs.metadata,
    lastSeen: inputs.lastSeen,
    totalEvents: inputs.totalEvents,
    now,
  })

  // Step 2: radar dimensions (Coordination depends on badges).
  const radarInput = {
    trustScore: inputs.trustScore,
    metadata: inputs.metadata,
    uriPresent: inputs.uriPresent,
    ownerResolved: inputs.ownerResolved,
    claimed: inputs.claimed,
    feedbackCount: inputs.feedbackCount,
    totalEvents: inputs.totalEvents,
    uriUpdateCount: inputs.uriUpdateCount,
    ageDays,
    recentEventCount: inputs.recentEventCount,
    validationEventCount: inputs.validationEventCount,
    openIncidents: inputs.openIncidents,
    hasSybilHistory: inputs.hasSybilHistory,
    hasRecentReputationDrop: inputs.hasRecentReputationDrop,
    coordinationBadges,
  }

  const radar: Record<DimensionKey, DimensionResult> = {
    identity: deriveIdentityDim(radarInput),
    reliability: deriveReliabilityDim(radarInput),
    reputation: deriveReputationDim(radarInput),
    coordination: deriveCoordinationDim(radarInput),
    safety: deriveSafetyDim(radarInput),
  }

  // Step 3: verdict.
  const confidence = inputs.trustScore?.confidence ?? 'low'
  const score = inputs.trustScore?.score ?? null
  const openCriticalIncidents = inputs.openIncidents.filter(
    (i) => i.severity === 'critical'
  ).length

  const verdict = deriveVerdict({
    score,
    confidence,
    openCriticalIncidents,
  })

  // Step 4: primary watchout.
  const primaryWatchout = derivePrimaryWatchout({
    openIncidents: inputs.openIncidents,
    radar,
    confidence,
    feedbackCount: inputs.feedbackCount,
  })

  // Step 5: summary.
  const connectedProtocols = countConnectedProtocols(coordinationBadges)
  const summary = buildSummary({
    verdict,
    score,
    ageDays,
    positiveCount: inputs.positiveCount,
    feedbackCount: inputs.feedbackCount,
    connectedProtocols,
    primaryWatchout,
  })

  // Step 6: strengths / watchouts.
  const strengths = deriveStrengths(radar)
  const watchouts = deriveWatchouts(radar, inputs.openIncidents)

  // Step 7: improvements.
  const improvements = suggestImprovements({
    radar,
    coordinationBadges,
    metadata: inputs.metadata,
    claimed: inputs.claimed,
    openIncidents: inputs.openIncidents,
    feedbackCount: inputs.feedbackCount,
  })

  return {
    score,
    verdict,
    confidence,
    summary,
    recommendedAction: mapRecommendedAction(verdict),
    radar,
    strengths,
    watchouts,
    coordination: coordinationBadges,
    improvements,
    openIncidents: inputs.openIncidents,
  }
}

// §4.8: Strengths — top dimensions ≥ 70, sorted desc by value, max 3.
function deriveStrengths(
  radar: Record<DimensionKey, DimensionResult>
): string[] {
  const eligible = DIMENSION_ORDER.filter((k) => radar[k].value >= 70)
  eligible.sort((a, b) => {
    if (radar[b].value !== radar[a].value) return radar[b].value - radar[a].value
    return DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b)
  })
  return eligible
    .slice(0, 3)
    .map((k) => `Strong ${DIMENSION_LABEL[k]} (${radar[k].value}/100)`)
}

// §4.8: Watchouts — incidents (critical>warning), then dimensions < 40, max 3.
function deriveWatchouts(
  radar: Record<DimensionKey, DimensionResult>,
  openIncidents: OpenIncident[]
): string[] {
  const out: string[] = []
  for (const i of openIncidents) {
    if (i.severity === 'critical') out.push(`Open critical incident: ${i.kind}`)
  }
  for (const i of openIncidents) {
    if (i.severity === 'warning') out.push(`Open warning incident: ${i.kind}`)
  }
  const lowDims = DIMENSION_ORDER.filter((k) => radar[k].value < 40)
  lowDims.sort((a, b) => {
    if (radar[a].value !== radar[b].value) return radar[a].value - radar[b].value
    return DIMENSION_ORDER.indexOf(a) - DIMENSION_ORDER.indexOf(b)
  })
  for (const k of lowDims) {
    out.push(`Low ${DIMENSION_LABEL[k]} (${radar[k].value}/100)`)
  }
  return out.slice(0, 3)
}

// §4.4: action by verdict — N8: insufficient-data UI may hide CTA in sticky.
function mapRecommendedAction(verdict: Verdict): RecommendedAction {
  switch (verdict) {
    case 'ready':
      return {
        label: 'Pair on coordinated task',
        intent: 'primary',
        href: '#coordination',
      }
    case 'warming-up':
      return {
        label: 'Start with small interaction',
        intent: 'neutral',
        href: '#coordination',
      }
    case 'caution':
      return {
        label: 'Request additional verification',
        intent: 'caution',
        href: '#evidence',
      }
    case 'insufficient-data':
      return {
        label: 'Check back after first interactions',
        intent: 'neutral',
        href: '#evidence',
      }
  }
}
