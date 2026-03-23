import type { ScopeEvent } from '@/types/events'
import type { DiscoverySignal } from '@/types/discovery'
import { detectFirstBlood, detectRisingStar } from './rules'
import { useDiscoveryStore } from '@/stores/discovery'
import { supabase } from '@/lib/supabase/client'

const feedbackCounts = new Map<string, number>()
const recentFeedbacks = new Map<string, { count: number; since: number }>()

/**
 * Seed feedbackCounts from the agents table so discovery rules don't
 * fire false first_blood signals for agents outside the event fetch window.
 */
export async function seedDiscoveryFromDB(): Promise<void> {
  if (!supabase) return

  const { data, error } = await supabase
    .from('agents')
    .select('chain_id,agent_id,feedback_count')
    .gt('feedback_count', 0)

  if (error || !data) return

  for (const row of data) {
    const key = `${row.chain_id}:${row.agent_id}`
    feedbackCounts.set(key, row.feedback_count)
  }
}

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
    const ts = event.timestamp ?? Date.now()
    if (!entry) recentFeedbacks.set(key, { count: 1, since: ts })
    else entry.count++
  }

  for (const signal of signals) {
    if (signal) useDiscoveryStore.getState().push(signal)
  }
}
