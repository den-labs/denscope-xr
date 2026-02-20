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

type AgentStoreState = {
  agents: Map<string, AgentSummary>
  upsertFromEvent: (event: ScopeEvent) => void
  cacheMetadata: (key: string, metadata: AgentMetadata) => void
  clear: () => void
}

export const useAgentStore = create<AgentStoreState>()((set, get) => ({
  agents: new Map(),

  upsertFromEvent: (event) => {
    const key = `${event.chainId}:${event.agentId}`
    const agents = new Map(get().agents)
    const existing = agents.get(key) ?? {
      agentId: event.agentId,
      chainId: event.chainId,
      owner: '',
      agentURI: '',
      feedbackCount: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      lastEventBlock: 0,
    }

    existing.lastEventBlock = event.block

    switch (event.kind) {
      case 'register': {
        const d = event.data as { agentURI: string; owner: string }
        existing.owner = d.owner
        existing.agentURI = d.agentURI
        existing.registeredAt = event.timestamp
        break
      }
      case 'uri_update': {
        const d = event.data as { newURI: string }
        existing.agentURI = d.newURI
        existing.metadata = undefined
        break
      }
      case 'feedback': {
        const d = event.data as FeedbackData
        const feedbackValue = toBigIntSafe((d as { value?: unknown }).value)
        existing.feedbackCount++
        if (feedbackValue != null && feedbackValue > BigInt(0)) existing.positiveFeedback++
        else if (feedbackValue != null && feedbackValue < BigInt(0)) existing.negativeFeedback++
        break
      }
    }

    agents.set(key, { ...existing })
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
