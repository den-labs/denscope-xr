import type { DenEvent } from './types'
import type { TrustEdge } from '@/types/graph'

export type FeedbackStats = {
  total: number
  posCount: number
  negCount: number
  neutralCount: number
  positivePct: number
}

type FeedbackLike = {
  value: number
  targetId?: string
  target?: string
}

export function feedbackStatsForTarget(
  eventsOrEdges: readonly (DenEvent | TrustEdge | FeedbackLike)[],
  targetId: string,
): FeedbackStats {
  let posCount = 0
  let negCount = 0
  let neutralCount = 0

  for (const item of eventsOrEdges) {
    const itemTarget = 'targetId' in item ? item.targetId : item.target
    if (itemTarget !== targetId) continue

    const value = Number(item.value)
    if (!Number.isFinite(value)) continue

    if (value > 0) posCount++
    else if (value < 0) negCount++
    else neutralCount++
  }

  const total = posCount + negCount + neutralCount
  const positivePct = total > 0 ? Math.round((posCount / total) * 100) : 0

  return { total, posCount, negCount, neutralCount, positivePct }
}
