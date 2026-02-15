import type { ScopeEvent } from '@/types/events'
import type { DiscoverySignal } from '@/types/discovery'

export function detectFirstBlood(
  event: ScopeEvent,
  feedbackCounts: Map<string, number>,
): DiscoverySignal | null {
  if (event.kind !== 'feedback') return null
  const key = `${event.chainId}:${event.agentId}`
  if ((feedbackCounts.get(key) ?? 0) > 0) return null
  return {
    kind: 'first_blood',
    title: 'First Blood',
    description: `Agent #${event.agentId} received its first-ever feedback`,
    agentIds: [event.agentId],
    chainId: event.chainId,
    timestamp: event.timestamp ?? Date.now(),
    severity: 'info',
  }
}

export function detectRisingStar(
  event: ScopeEvent,
  recentFeedbacks: Map<string, { count: number; since: number }>,
): DiscoverySignal | null {
  if (event.kind !== 'feedback') return null
  const key = `${event.chainId}:${event.agentId}`
  const entry = recentFeedbacks.get(key)
  if (!entry || entry.count < 5) return null
  const hours = (Date.now() - entry.since) / (1000 * 60 * 60)
  if (hours >= 24) return null
  return {
    kind: 'rising_star',
    title: 'Rising Star',
    description: `Agent #${event.agentId} got ${entry.count} feedbacks in ${Math.round(hours)}h`,
    agentIds: [event.agentId],
    chainId: event.chainId,
    timestamp: event.timestamp ?? Date.now(),
    severity: 'info',
  }
}
