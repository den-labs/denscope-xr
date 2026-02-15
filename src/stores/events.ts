import { create } from 'zustand'
import type { ScopeEvent } from '@/types/events'
import { MAX_FEED_EVENTS } from '@/config/constants'

type EventStoreState = {
  events: ScopeEvent[]
  push: (event: ScopeEvent) => void
  pushBatch: (events: ScopeEvent[]) => void
  clear: () => void
}

export const useEventStore = create<EventStoreState>()((set) => ({
  events: [],

  push: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, MAX_FEED_EVENTS),
    })),

  pushBatch: (events) =>
    set((state) => ({
      events: [...[...events].reverse(), ...state.events].slice(
        0,
        MAX_FEED_EVENTS,
      ),
    })),

  clear: () => set({ events: [] }),
}))
