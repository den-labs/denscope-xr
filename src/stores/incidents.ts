import { create } from 'zustand'
import type { Incident } from '@/types/incidents'

type IncidentStoreState = {
  incidents: Incident[]
  setIncidents: (incidents: Incident[]) => void
  push: (incident: Incident) => void
  resolve: (incidentId: string) => void
  clear: () => void
}

export const useIncidentStore = create<IncidentStoreState>()((set) => ({
  incidents: [],

  setIncidents: (incidents) => set({ incidents }),

  push: (incident) =>
    set((state) => ({
      incidents: [incident, ...state.incidents],
    })),

  resolve: (incidentId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId
          ? { ...i, resolvedAt: new Date().toISOString() }
          : i
      ),
    })),

  clear: () => set({ incidents: [] }),
}))
