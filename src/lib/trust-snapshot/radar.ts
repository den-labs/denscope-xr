import type { AgentMetadata } from '@/types/agents'
import type { TrustScore } from '@/types/trust-score'
import type {
  CoordinationMatrix,
  DimensionResult,
  OpenIncident,
} from './types'

// Single wide input — each dimension function picks the fields it needs.
// Spec §4.5 (Rev 3). Pure: no I/O.
export interface RadarInput {
  trustScore: TrustScore | null
  metadata: AgentMetadata | null
  uriPresent: boolean
  ownerResolved: boolean
  claimed: boolean
  feedbackCount: number
  totalEvents: number
  uriUpdateCount: number
  ageDays: number
  recentEventCount: number          // events in last 30d
  validationEventCount: number       // count of validation_complete signals
  openIncidents: OpenIncident[]
  hasSybilHistory: boolean
  hasRecentReputationDrop: boolean
  coordinationBadges: CoordinationMatrix
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

// §4.5.1 Identity Completeness — 7 components, weights sum to 100.
export function deriveIdentityDim(input: RadarInput): DimensionResult {
  const components: Array<{ on: boolean; weight: number; label: string }> = [
    { on: input.uriPresent, weight: 20, label: 'on-chain URI' },
    { on: input.metadata !== null, weight: 15, label: 'URI resolves' },
    {
      on:
        !!input.metadata?.name &&
        (input.metadata?.description?.length ?? 0) > 0,
      weight: 15,
      label: 'name + description',
    },
    {
      on: !!input.metadata?.image,
      weight: 10,
      label: 'image',
    },
    { on: input.ownerResolved, weight: 10, label: 'owner resolved' },
    { on: input.claimed, weight: 15, label: 'claimed' },
    {
      on: (input.metadata?.services?.length ?? 0) > 0,
      weight: 15,
      label: 'declares services',
    },
  ]
  const value = clamp(
    components.reduce((sum, c) => sum + (c.on ? c.weight : 0), 0)
  )
  return {
    value,
    rule: 'Sum of 7 weighted metadata-presence components (URI, resolves, name+desc, image, owner, claimed, services)',
    evidence: components
      .filter((c) => c.on)
      .map((c) => `+${c.weight} ${c.label}`),
    status: 'derived',
  }
}

// §4.5.2 Service Reliability — 4 components × 25.
export function deriveReliabilityDim(input: RadarInput): DimensionResult {
  const age = Math.min(input.ageDays / 90, 1) * 25
  const stability = (1 - Math.min(input.uriUpdateCount / 5, 1)) * 25
  const recency = input.recentEventCount > 0
    ? 25
    : input.ageDays > 0
      ? Math.max(0, 25 - input.ageDays * 0.5)
      : 0
  const validation = Math.min(input.validationEventCount / 3, 1) * 25

  const value = clamp(Math.round(age + stability + recency + validation))
  return {
    value,
    rule: 'Average of 4 components: age (90d cap), URI stability (5 updates cap), 30d event recency, validation_complete events (target=3)',
    evidence: [
      `age=${Math.round(age)}/25 (${input.ageDays}d)`,
      `stability=${Math.round(stability)}/25 (${input.uriUpdateCount} updates)`,
      `recency=${Math.round(recency)}/25 (${input.recentEventCount} events in 30d)`,
      `validation=${Math.round(validation)}/25 (${input.validationEventCount} events)`,
    ],
    status: 'derived',
  }
}

// §4.5.3 Reputation Quality — positive ratio dominates.
export function deriveReputationDim(input: RadarInput): DimensionResult {
  if (!input.trustScore) {
    return {
      value: 0,
      rule: 'No trust score computed yet',
      evidence: [],
      status: 'unavailable',
    }
  }
  const ratio = input.trustScore.positiveRatio * 60
  const volume = Math.min(input.feedbackCount / 10, 1) * 25
  const confBump =
    input.trustScore.confidence === 'high'
      ? 15
      : input.trustScore.confidence === 'medium'
        ? 10
        : 0
  const value = clamp(Math.round(ratio + volume + confBump))
  return {
    value,
    rule: 'Positive ratio (×60) + feedback volume (target=10) + confidence bump',
    evidence: [
      `positive_ratio=${input.trustScore.positiveRatio.toFixed(2)} → ${Math.round(ratio)}/60`,
      `feedback_count=${input.feedbackCount} → ${Math.round(volume)}/25`,
      `confidence=${input.trustScore.confidence} → ${confBump}/15`,
    ],
    status: 'derived',
  }
}

// §4.5.4 Coordination Readiness — 5 derivable badges, weights sum to 100.
export function deriveCoordinationDim(input: RadarInput): DimensionResult {
  const b = input.coordinationBadges
  const components = [
    { on: b.a2a.state === 'connected', weight: 25, label: 'A2A' },
    { on: b.mcp.state === 'connected', weight: 25, label: 'MCP' },
    { on: b.x402.state === 'connected', weight: 20, label: 'x402' },
    { on: b.docs.state === 'connected', weight: 10, label: 'Docs' },
    { on: b.health.state === 'connected', weight: 20, label: 'Health' },
  ]
  const value = clamp(
    components.reduce((sum, c) => sum + (c.on ? c.weight : 0), 0)
  )
  return {
    value,
    rule: 'A2A(25) + MCP(25) + x402(20) + Docs(10) + Health(20). OASF/Source/Auth excluded until convention exists.',
    evidence: components
      .filter((c) => c.on)
      .map((c) => `+${c.weight} ${c.label}`),
    status: 'derived',
  }
}

// §4.5.5 Safety / Integrity — start at 100, subtract penalties. No bonuses.
export function deriveSafetyDim(input: RadarInput): DimensionResult {
  const critical = input.openIncidents.filter((i) => i.severity === 'critical').length
  const warning = input.openIncidents.filter((i) => i.severity === 'warning').length

  const critPenalty = Math.min(critical * 40, 80)
  const warnPenalty = Math.min(warning * 15, 45)
  const sybilPenalty = input.hasSybilHistory ? 20 : 0
  const dropPenalty = input.hasRecentReputationDrop ? 25 : 0

  const total = critPenalty + warnPenalty + sybilPenalty + dropPenalty
  const value = clamp(100 - total)

  return {
    value,
    rule: 'Start at 100, subtract: critical incidents (40 each, cap 80) + warnings (15 each, cap 45) + sybil history (20) + recent reputation drop (25)',
    evidence: [
      `critical_penalty=-${critPenalty} (${critical} open)`,
      `warning_penalty=-${warnPenalty} (${warning} open)`,
      `sybil_penalty=-${sybilPenalty}`,
      `drop_penalty=-${dropPenalty}`,
    ],
    status: 'derived',
  }
}
