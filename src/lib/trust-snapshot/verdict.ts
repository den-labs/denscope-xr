import type { Confidence, Verdict } from './types'

export interface VerdictInput {
  score: number | null
  confidence: Confidence
  openCriticalIncidents: number
}

// Verdict derivation — spec §4.2 (Rev 3 with N1 safety override).
// Evaluated in order; first match wins. No implicit fallthrough.
export function deriveVerdict(input: VerdictInput): Verdict {
  if (input.openCriticalIncidents >= 1) return 'caution'
  if (input.score === null) return 'insufficient-data'

  if (input.score >= 75) {
    return input.confidence === 'high' ? 'ready' : 'warming-up'
  }
  if (input.score >= 50) {
    return 'warming-up'
  }
  return 'caution'
}
