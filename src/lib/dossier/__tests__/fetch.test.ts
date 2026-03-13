import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchDossierData } from '../fetch'

describe('fetchDossierData', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  function mockFetch(responses: Record<string, unknown>) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      for (const [pattern, data] of Object.entries(responses)) {
        if (url.includes(pattern)) {
          return { json: async () => data } as Response
        }
      }
      return { json: async () => [] } as Response
    })
  }

  it('returns defaults when agent not found', async () => {
    mockFetch({})
    const result = await fetchDossierData(42220, 999)
    expect(result).toEqual({
      firstSeen: null,
      lastSeen: null,
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      totalEvents: 0,
      uriUpdateCount: 0,
      uniqueInteractors: 0,
      avgFeedbackValue: 0,
      openSybilCount: 0,
      resolvedSybilCount: 0,
    })
  })

  it('computes correct dossier data from Supabase responses', async () => {
    mockFetch({
      'agents?': [{
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-03-01T00:00:00Z',
        feedback_count: 10,
        positive_count: 8,
        negative_count: 2,
      }],
      'scope_events?chain_id=eq.42220&agent_id=eq.1&select=kind': [
        { kind: 'feedback' },
        { kind: 'feedback' },
        { kind: 'uri_update' },
        { kind: 'registration' },
      ],
      'scope_events?chain_id=eq.42220&agent_id=eq.1&kind=eq.feedback': [
        { data: { clientAddress: '0xA', value: '80' } },
        { data: { clientAddress: '0xB', value: '60' } },
      ],
      'incidents?chain_id=eq.42220&agent_id=eq.1&signal_kind=eq.sybil_cluster&resolved_at=is.null': [
        { id: 'inc-1' },
      ],
      'incidents?chain_id=eq.42220&agent_id=eq.1&signal_kind=eq.sybil_cluster&resolved_at=not.is.null': [
        { id: 'inc-2' },
        { id: 'inc-3' },
      ],
    })

    const result = await fetchDossierData(42220, 1)
    expect(result.firstSeen).toBe('2026-01-01T00:00:00Z')
    expect(result.lastSeen).toBe('2026-03-01T00:00:00Z')
    expect(result.feedbackCount).toBe(10)
    expect(result.positiveCount).toBe(8)
    expect(result.negativeCount).toBe(2)
    expect(result.totalEvents).toBe(4)
    expect(result.uriUpdateCount).toBe(1)
    expect(result.uniqueInteractors).toBe(2)
    expect(result.avgFeedbackValue).toBe(70)
    expect(result.openSybilCount).toBe(1)
    expect(result.resolvedSybilCount).toBe(2)
  })

  it('computes uniqueInteractors from distinct clientAddresses', async () => {
    mockFetch({
      'agents?': [{ first_seen: null, last_seen: null, feedback_count: 3, positive_count: 3, negative_count: 0 }],
      'scope_events?chain_id=eq.42220&agent_id=eq.5&select=kind': [],
      'scope_events?chain_id=eq.42220&agent_id=eq.5&kind=eq.feedback': [
        { data: { clientAddress: '0xA', value: '10' } },
        { data: { clientAddress: '0xA', value: '20' } },
        { data: { clientAddress: '0xB', value: '30' } },
      ],
    })

    const result = await fetchDossierData(42220, 5)
    expect(result.uniqueInteractors).toBe(2)
  })

  it('computes avgFeedbackValue rounded', async () => {
    mockFetch({
      'agents?': [{ first_seen: null, last_seen: null, feedback_count: 3, positive_count: 3, negative_count: 0 }],
      'scope_events?chain_id=eq.42220&agent_id=eq.5&select=kind': [],
      'scope_events?chain_id=eq.42220&agent_id=eq.5&kind=eq.feedback': [
        { data: { clientAddress: '0xA', value: '10' } },
        { data: { clientAddress: '0xB', value: '11' } },
        { data: { clientAddress: '0xC', value: '12' } },
      ],
    })

    const result = await fetchDossierData(42220, 5)
    expect(result.avgFeedbackValue).toBe(11) // Math.round(33/3) = 11
  })

  it('counts uriUpdateCount from events with kind uri_update', async () => {
    mockFetch({
      'agents?': [{ first_seen: null, last_seen: null, feedback_count: 0, positive_count: 0, negative_count: 0 }],
      'scope_events?chain_id=eq.42220&agent_id=eq.2&select=kind': [
        { kind: 'uri_update' },
        { kind: 'uri_update' },
        { kind: 'registration' },
      ],
      'scope_events?chain_id=eq.42220&agent_id=eq.2&kind=eq.feedback': [],
    })

    const result = await fetchDossierData(42220, 2)
    expect(result.uriUpdateCount).toBe(2)
    expect(result.totalEvents).toBe(3)
  })

  it('counts sybil incidents from open and resolved queries', async () => {
    mockFetch({
      'agents?': [{ first_seen: null, last_seen: null, feedback_count: 0, positive_count: 0, negative_count: 0 }],
      'scope_events?chain_id=eq.42220&agent_id=eq.3&select=kind': [],
      'scope_events?chain_id=eq.42220&agent_id=eq.3&kind=eq.feedback': [],
      'incidents?chain_id=eq.42220&agent_id=eq.3&signal_kind=eq.sybil_cluster&resolved_at=is.null': [
        { id: '1' }, { id: '2' }, { id: '3' },
      ],
      'incidents?chain_id=eq.42220&agent_id=eq.3&signal_kind=eq.sybil_cluster&resolved_at=not.is.null': [
        { id: '4' },
      ],
    })

    const result = await fetchDossierData(42220, 3)
    expect(result.openSybilCount).toBe(3)
    expect(result.resolvedSybilCount).toBe(1)
  })
})
