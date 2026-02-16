import { create } from 'zustand'
import type { AlertRule } from '@/types/alerts'

type AlertStoreState = {
  rules: AlertRule[]
  setRules: (rules: AlertRule[]) => void
  updateRule: (ruleId: string, updates: Partial<AlertRule>) => void
  clear: () => void
}

export const useAlertStore = create<AlertStoreState>()((set) => ({
  rules: [],

  setRules: (rules) => set({ rules }),

  updateRule: (ruleId, updates) =>
    set((state) => ({
      rules: state.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    })),

  clear: () => set({ rules: [] }),
}))
