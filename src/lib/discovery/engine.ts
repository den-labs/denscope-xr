import type { ScopeEvent } from '@/types/events'
import type { DiscoverySignal } from '@/types/discovery'
import { detectFirstBlood, detectRisingStar } from './rules'
import { useDiscoveryStore } from '@/stores/discovery'

const feedbackCounts = new Map<string, number>()
const recentFeedbacks = new Map<string, { count: number; since: number }>()

export function runDiscoveryRules(event: ScopeEvent): void {
  const signals: (DiscoverySignal | null)[] = [
    detectFirstBlood(event, feedbackCounts),
    detectRisingStar(event, recentFeedbacks),
  ]

  // Update tracking state AFTER checking rules
  if (event.kind === 'feedback') {
    const key = `${event.chainId}:${event.agentId}`
    feedbackCounts.set(key, (feedbackCounts.get(key) ?? 0) + 1)
    const entry = recentFeedbacks.get(key)
    if (!entry) recentFeedbacks.set(key, { count: 1, since: Date.now() })
    else entry.count++
  }

  for (const signal of signals) {
    if (signal) useDiscoveryStore.getState().push(signal)
  }
}
