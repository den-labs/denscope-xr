// Trust Snapshot / Coordination Layer — output types
// Spec: docs/superpowers/specs/2026-05-23-trust-snapshot-coordination-layer.md (Rev 3)
// Pure types — no I/O. Zod runtime validation lives at fetcher boundary (Phase B).

export type Verdict = 'ready' | 'warming-up' | 'caution' | 'insufficient-data'

export type Confidence = 'low' | 'medium' | 'high'

export type DimensionKey =
  | 'identity'
  | 'reliability'
  | 'reputation'
  | 'coordination'
  | 'safety'

// Canonical dimension order — tiebreaker for ordering rules (§4.3.1, §4.8)
export const DIMENSION_ORDER: readonly DimensionKey[] = [
  'identity',
  'reliability',
  'reputation',
  'coordination',
  'safety',
] as const

// Human-readable labels for templates (N5 fix, §4.3.1)
export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  identity: 'Identity completeness',
  reliability: 'Service reliability',
  reputation: 'Reputation quality',
  coordination: 'Coordination readiness',
  safety: 'Safety / integrity',
}

export type DimensionStatus = 'derived' | 'partial' | 'unavailable'

export interface DimensionResult {
  value: number // 0-100, clamped
  rule: string
  evidence: string[]
  status: DimensionStatus
}

// Coordination Matrix badge state (§4.6)
// Two distinct "unknown-ish" states (N7):
//   'unknown' = agent-specific (Health with <5 events) → solid muted
//   'pending' = convention-pending (OASF/Source/Auth) → dashed-border muted
export type BadgeState =
  | { state: 'connected'; evidence: string }
  | { state: 'detected'; evidence: string }
  | { state: 'missing' }
  | { state: 'unknown'; reason: string }
  | { state: 'pending'; reason: string }

export type BadgeKey =
  | 'a2a'
  | 'mcp'
  | 'x402'
  | 'docs'
  | 'health'
  | 'oasf'
  | 'source'
  | 'auth'

export type CoordinationMatrix = Record<BadgeKey, BadgeState>

export type ImprovementPriority = 'P1' | 'P2' | 'P3'

export interface ImprovementSuggestion {
  priority: ImprovementPriority
  title: string
  body: string
  affectsDimension: DimensionKey
  action?: { label: string; href: string }
}

export type RecommendedActionIntent = 'primary' | 'neutral' | 'caution'

export interface RecommendedAction {
  label: string
  intent: RecommendedActionIntent
  href?: string
}

export type IncidentSeverity = 'critical' | 'warning' | 'info'

// Sorted by severity desc (critical > warning > info), then openedAt desc (N4 contract)
export interface OpenIncident {
  id: string
  severity: IncidentSeverity
  kind: string
  openedAt: string
}

export interface TrustSnapshotData {
  score: number | null
  verdict: Verdict
  confidence: Confidence
  summary: string
  recommendedAction: RecommendedAction

  radar: Record<DimensionKey, DimensionResult>

  strengths: string[]
  watchouts: string[]

  coordination: CoordinationMatrix

  improvements: ImprovementSuggestion[]

  openIncidents: OpenIncident[]
}
