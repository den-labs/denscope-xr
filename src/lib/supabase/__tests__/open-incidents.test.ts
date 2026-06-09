import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fluent query-builder mock; terminal `.is('resolved_at', null)` resolves to { data }
function createQueryBuilderMock(data: unknown[] = []) {
  const state = { eqCalls: [] as [string, unknown][], isCalls: [] as [string, unknown][] }
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn().mockReturnValue(builder)
  builder.eq = vi.fn((...args: unknown[]) => {
    state.eqCalls.push(args as [string, unknown])
    return builder
  })
  builder.is = vi.fn((...args: unknown[]) => {
    state.isCalls.push(args as [string, unknown])
    return Promise.resolve({ data, error: null })
  })
  return { builder, state }
}

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

const { fetchOpenIncidents } = await import('@/lib/supabase/open-incidents')

const row = (over: Record<string, unknown>) => ({
  id: 'i1',
  signal_kind: 'reputation_drop',
  severity: 'warning',
  triggered_at: '2026-05-01T00:00:00Z',
  resolved_at: null,
  ...over,
})

describe('fetchOpenIncidents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters by chain_id, agent_id and resolved_at IS NULL', async () => {
    const { builder, state } = createQueryBuilderMock([])
    mockFrom.mockReturnValue(builder)

    await fetchOpenIncidents(42220, 1870)

    expect(mockFrom).toHaveBeenCalledWith('incidents')
    expect(state.eqCalls).toContainEqual(['chain_id', 42220])
    expect(state.eqCalls).toContainEqual(['agent_id', 1870])
    expect(state.isCalls).toContainEqual(['resolved_at', null])
  })

  it('maps DB rows to OpenIncident shape', async () => {
    const { builder } = createQueryBuilderMock([
      row({ id: 'abc', signal_kind: 'sybil_cluster', severity: 'critical', triggered_at: '2026-05-02T10:00:00Z' }),
    ])
    mockFrom.mockReturnValue(builder)

    const result = await fetchOpenIncidents(42220, 1870)

    expect(result).toEqual([
      { id: 'abc', severity: 'critical', kind: 'sybil_cluster', openedAt: '2026-05-02T10:00:00Z' },
    ])
  })

  it('sorts by severity desc (critical > warning > info), then openedAt desc', async () => {
    const { builder } = createQueryBuilderMock([
      row({ id: 'info-old', severity: 'info', triggered_at: '2026-05-01T00:00:00Z' }),
      row({ id: 'warn', severity: 'warning', triggered_at: '2026-05-03T00:00:00Z' }),
      row({ id: 'crit-old', severity: 'critical', triggered_at: '2026-05-01T00:00:00Z' }),
      row({ id: 'crit-new', severity: 'critical', triggered_at: '2026-05-05T00:00:00Z' }),
    ])
    mockFrom.mockReturnValue(builder)

    const result = await fetchOpenIncidents(42220, 1870)

    expect(result.map((r) => r.id)).toEqual(['crit-new', 'crit-old', 'warn', 'info-old'])
  })

  it('returns [] when supabase has no data', async () => {
    const { builder } = createQueryBuilderMock([])
    mockFrom.mockReturnValue(builder)

    const result = await fetchOpenIncidents(42220, 1870)
    expect(result).toEqual([])
  })
})
