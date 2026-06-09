// Presentational maps for the Trust Snapshot UI. Pure — no I/O, no JSX.
import type {
  BadgeKey,
  DimensionKey,
  RecommendedActionIntent,
  Verdict,
} from '@/lib/trust-snapshot/types'
import { DIMENSION_LABEL } from '@/lib/trust-snapshot/types'

export interface VerdictDisplay {
  label: string
  /** Token suffix for status-pill / text color, e.g. 'success' | 'accent' | 'warning' | 'neutral'. */
  tone: 'success' | 'accent' | 'warning' | 'neutral'
}

export const VERDICT_DISPLAY: Record<Verdict, VerdictDisplay> = {
  ready: { label: 'Ready to coordinate', tone: 'success' },
  'warming-up': { label: 'Warming up', tone: 'accent' },
  caution: { label: 'Caution', tone: 'warning' },
  'insufficient-data': { label: 'Insufficient data', tone: 'neutral' },
}

// CTA intent → button token class.
export const INTENT_CLASS: Record<RecommendedActionIntent, string> = {
  primary: 'bg-accent text-background hover:opacity-90',
  neutral: 'border border-border text-text-secondary hover:border-accent',
  caution: 'border border-warning text-warning hover:bg-warning/10',
}

// Score → color token (mirrors TrustScoreBadge thresholds).
export function scoreColor(score: number | null): string {
  if (score === null) return 'text-text-muted'
  if (score >= 80) return 'text-success'
  if (score >= 50) return 'text-accent'
  if (score >= 25) return 'text-warning'
  return 'text-critical'
}

// Short labels for the 8 coordination badges.
export const BADGE_LABEL: Record<BadgeKey, string> = {
  a2a: 'A2A',
  mcp: 'MCP',
  x402: 'x402',
  docs: 'Docs',
  health: 'Health',
  oasf: 'OASF',
  source: 'Source',
  auth: 'Auth',
}

export const DIMENSION_DISPLAY: Record<DimensionKey, string> = DIMENSION_LABEL
