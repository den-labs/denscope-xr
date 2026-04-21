import { create } from 'zustand'
import type { AgentSummary, AgentMetadata } from '@/types/agents'
import type { ScopeEvent, FeedbackData } from '@/types/events'

function toBigIntSafe(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    return BigInt(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    try {
      return BigInt(trimmed)
    } catch {
      return null
    }
  }
  return null
}

function defaultSummary(event: ScopeEvent): AgentSummary {
  return {
    agentId: event.agentId,
    chainId: event.chainId,
    owner: '',
    agentURI: '',
    feedbackCount: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    lastEventBlock: 0,
  }
}

function applyEventInPlace(summary: AgentSummary, event: ScopeEvent): void {
  summary.lastEventBlock = event.block
  switch (event.kind) {
    case 'register': {
      const d = event.data as { agentURI: string; owner: string }
      summary.owner = d.owner
      summary.agentURI = d.agentURI
      summary.registeredAt = event.timestamp
      break
    }
    case 'uri_update': {
      const d = event.data as { newURI: string }
      summary.agentURI = d.newURI
      summary.metadata = undefined
      break
    }
    case 'feedback': {
      const d = event.data as FeedbackData
      const feedbackValue = toBigIntSafe((d as { value?: unknown }).value)
      summary.feedbackCount++
      if (feedbackValue != null && feedbackValue > BigInt(0)) summary.positiveFeedback++
      else if (feedbackValue != null && feedbackValue < BigInt(0)) summary.negativeFeedback++
      break
    }
  }
}

type AgentStoreState = {
  agents: Map<string, AgentSummary>
  upsertFromEvent: (event: ScopeEvent) => void
  upsertFromEvents: (events: ScopeEvent[]) => void
  cacheMetadata: (key: string, metadata: AgentMetadata) => void
  clear: () => void
}

export const useAgentStore = create<AgentStoreState>()((set, get) => ({
  agents: new Map(),

  upsertFromEvent: (event) => {
    const key = `${event.chainId}:${event.agentId}`
    const agents = new Map(get().agents)
    const existing = { ...(agents.get(key) ?? defaultSummary(event)) }
    applyEventInPlace(existing, event)
    agents.set(key, existing)
    set({ agents })
  },

  upsertFromEvents: (events) => {
    if (events.length === 0) return
    const agents = new Map(get().agents)
    for (const event of events) {
      const key = `${event.chainId}:${event.agentId}`
      const existing = { ...(agents.get(key) ?? defaultSummary(event)) }
      applyEventInPlace(existing, event)
      agents.set(key, existing)
    }
    set({ agents })
  },

  cacheMetadata: (key, metadata) => {
    const agents = new Map(get().agents)
    const existing = agents.get(key)
    if (!existing) return
    agents.set(key, { ...existing, metadata })
    set({ agents })
  },

  clear: () => set({ agents: new Map() }),
}))
