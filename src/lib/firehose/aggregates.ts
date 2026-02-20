import type { DenEvent } from './types'

export type AgentAggregate = {
  targetId: string
  posSum: number
  negSum: number
  count: number
  ratePerMin: number
}

export type AggregateSelectors = {
  windowMs: number
  agents: AgentAggregate[]
  topLiked: (n: number) => AgentAggregate[]
  topDisliked: (n: number) => AgentAggregate[]
  mostReviewed: (n: number) => AgentAggregate[]
  hotAgents: (n: number) => AgentAggregate[]
}

type AggregateOptions = {
  windowMs?: number
  nowMs?: number
}

const DEFAULT_WINDOW_MS = 10 * 60 * 1000

function sortStable(
  agents: AgentAggregate[],
  metric: (a: AgentAggregate) => number,
): AgentAggregate[] {
  return [...agents].sort((a, b) => {
    const delta = metric(b) - metric(a)
    if (delta !== 0) return delta
    return b.count - a.count
  })
}

export function buildFeedbackAggregates(
  events: readonly DenEvent[],
  options: AggregateOptions = {},
): AggregateSelectors {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const nowMs = options.nowMs ?? Date.now()
  const cutoff = nowMs - windowMs
  const minutes = windowMs / 60_000

  const byTarget = new Map<string, AgentAggregate>()
  for (const event of events) {
    if (event.kind !== 'feedback') continue
    if (event.ts < cutoff) continue

    const existing = byTarget.get(event.targetId) ?? {
      targetId: event.targetId,
      posSum: 0,
      negSum: 0,
      count: 0,
      ratePerMin: 0,
    }

    existing.count += 1
    if (event.value > 0) existing.posSum += event.value
    else if (event.value < 0) existing.negSum += event.value
    existing.ratePerMin = existing.count / minutes
    byTarget.set(event.targetId, existing)
  }

  const agents = Array.from(byTarget.values())

  return {
    windowMs,
    agents,
    topLiked: (n: number) => sortStable(agents, (a) => a.posSum).slice(0, n),
    topDisliked: (n: number) => sortStable(agents, (a) => Math.abs(a.negSum)).slice(0, n),
    mostReviewed: (n: number) => sortStable(agents, (a) => a.count).slice(0, n),
    hotAgents: (n: number) => sortStable(agents, (a) => a.ratePerMin).slice(0, n),
  }
}
