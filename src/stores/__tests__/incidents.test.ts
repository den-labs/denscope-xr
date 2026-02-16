import { describe, it, expect, beforeEach } from 'vitest'
import { useIncidentStore } from '@/stores/incidents'
import type { Incident } from '@/types/incidents'

const mockIncident: Incident = {
  id: 'test-1',
  chainId: 42220,
  agentId: 5,
  signalKind: 'reputation_drop',
  severity: 'warning',
  title: 'Test',
  description: 'Test incident',
  whyItMatters: 'Test',
  triggeredAt: '2026-02-16T00:00:00Z',
  metadata: {},
}

describe('useIncidentStore', () => {
  beforeEach(() => {
    useIncidentStore.getState().clear()
  })

  it('starts empty', () => {
    expect(useIncidentStore.getState().incidents).toEqual([])
  })

  it('sets incidents', () => {
    useIncidentStore.getState().setIncidents([mockIncident])
    expect(useIncidentStore.getState().incidents).toHaveLength(1)
  })

  it('pushes a new incident to the front', () => {
    useIncidentStore.getState().setIncidents([mockIncident])
    const newIncident = { ...mockIncident, id: 'test-2', title: 'New' }
    useIncidentStore.getState().push(newIncident)
    expect(useIncidentStore.getState().incidents[0].id).toBe('test-2')
  })

  it('marks an incident as resolved', () => {
    useIncidentStore.getState().setIncidents([mockIncident])
    useIncidentStore.getState().resolve('test-1')
    const resolved = useIncidentStore.getState().incidents[0]
    expect(resolved.resolvedAt).toBeTruthy()
  })
})
