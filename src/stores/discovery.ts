import { create } from 'zustand'
import type { DiscoverySignal } from '@/types/discovery'
import { MAX_DISCOVERY_SIGNALS } from '@/config/constants'

type DiscoveryStoreState = {
  signals: DiscoverySignal[]
  push: (signal: DiscoverySignal) => void
  clear: () => void
}

export const useDiscoveryStore = create<DiscoveryStoreState>()((set) => ({
  signals: [],

  push: (signal) =>
    set((state) => ({
      signals: [signal, ...state.signals].slice(0, MAX_DISCOVERY_SIGNALS),
    })),

  clear: () => set({ signals: [] }),
}))
