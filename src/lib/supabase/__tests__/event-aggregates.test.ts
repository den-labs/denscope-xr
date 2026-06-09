import { describe, it, expect, vi, beforeEach } from 'vitest'

// Thenable query-builder mock: every filter returns the builder, and the builder
// resolves to { count, data } when awaited — so any terminal filter works.
function createBuilder(result: { count?: number; data?: unknown[] }) {
  const calls: { method: string; args: unknown[] }[] = []
  const builder: Record<string, unknown> = {}
  const chain = (method: string) =>
    vi.fn((...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    })
  builder.select = chain('select')
  builder.eq = chain('eq')
  builder.gte = chain('gte')
  builder.is = chain('is')
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ count: result.count ?? 0, data: result.data ?? [], error: null })
  return { builder, calls }
}

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

const { fetchRecentEventCount, fetchValidationEventCount, fetchHasRecentReputationDrop } =
  await import('@/lib/supabase/event-aggregates')

describe('fetchRecentEventCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts scope_events since the given ISO timestamp', async () => {
    const { builder, calls } = createBuilder({ count: 7 })
    mockFrom.mockReturnValue(builder)

    const n = await fetchRecentEventCount(42220, 1870, '2026-05-01T00:00:00Z')

    expect(mockFrom).toHaveBeenCalledWith('scope_events')
    expect(n).toBe(7)
    expect(calls).toContainEqual({ method: 'eq', args: ['chain_id', 42220] })
    expect(calls).toContainEqual({ method: 'eq', args: ['agent_id', 1870] })
    expect(calls).toContainEqual({ method: 'gte', args: ['event_timestamp', '2026-05-01T00:00:00Z'] })
  })

  it('returns 0 when count is null', async () => {
    const { builder } = createBuilder({ count: undefined })
    mockFrom.mockReturnValue(builder)
    expect(await fetchRecentEventCount(42220, 1870, '2026-05-01T00:00:00Z')).toBe(0)
  })
})

describe('fetchValidationEventCount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts validation_res events for the agent', async () => {
    const { builder, calls } = createBuilder({ count: 3 })
    mockFrom.mockReturnValue(builder)

    const n = await fetchValidationEventCount(42220, 1870)

    expect(n).toBe(3)
    expect(calls).toContainEqual({ method: 'eq', args: ['kind', 'validation_res'] })
  })
})

describe('fetchHasRecentReputationDrop', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when a reputation_drop incident exists since the timestamp', async () => {
    const { builder, calls } = createBuilder({ count: 1 })
    mockFrom.mockReturnValue(builder)

    const res = await fetchHasRecentReputationDrop(42220, 1870, '2026-05-01T00:00:00Z')

    expect(res).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('incidents')
    expect(calls).toContainEqual({ method: 'eq', args: ['signal_kind', 'reputation_drop'] })
    expect(calls).toContainEqual({ method: 'gte', args: ['triggered_at', '2026-05-01T00:00:00Z'] })
  })

  it('returns false when there are no such incidents', async () => {
    const { builder } = createBuilder({ count: 0 })
    mockFrom.mockReturnValue(builder)
    expect(await fetchHasRecentReputationDrop(42220, 1870, '2026-05-01T00:00:00Z')).toBe(false)
  })
})
