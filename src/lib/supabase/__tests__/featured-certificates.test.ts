import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchFeaturedCertificates } from '../featured-certificates'

const mockFrom = vi.fn()

vi.mock('../client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

function mockQuery(data: unknown[] | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      not: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  }
}

function mockQueryWithNotIn(data: unknown[] | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      not: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data, error }),
          }),
        }),
      }),
    }),
  }
}

const topCerts = [
  { chain_id: 42220, agent_id: 1, hash: 'h1', issued_at: '2026-03-29T00:00:00Z', trust_scores: { score: 92 } },
  { chain_id: 42220, agent_id: 2, hash: 'h2', issued_at: '2026-03-28T00:00:00Z', trust_scores: { score: 87 } },
  { chain_id: 1187947933, agent_id: 3, hash: 'h3', issued_at: '2026-03-27T00:00:00Z', trust_scores: { score: 84 } },
]

const recentCerts = [
  { chain_id: 42220, agent_id: 4, hash: 'h4', issued_at: '2026-03-29T12:00:00Z', trust_scores: { score: 73 } },
  { chain_id: 1187947933, agent_id: 5, hash: 'h5', issued_at: '2026-03-29T11:00:00Z', trust_scores: { score: 68 } },
  { chain_id: 42220, agent_id: 6, hash: 'h6', issued_at: '2026-03-29T10:00:00Z', trust_scores: { score: 61 } },
]

describe('fetchFeaturedCertificates', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('returns top-score and recent certificates', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery(topCerts))
      .mockReturnValueOnce(mockQueryWithNotIn(recentCerts))

    const result = await fetchFeaturedCertificates()
    expect(result.topScore).toHaveLength(3)
    expect(result.recent).toHaveLength(3)
    expect(result.topScore[0].score).toBe(92)
    expect(result.recent[0].agentId).toBe(4)
  })

  it('returns empty arrays when no certificates exist', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery([]))
      .mockReturnValueOnce(mockQueryWithNotIn([]))

    const result = await fetchFeaturedCertificates()
    expect(result.topScore).toHaveLength(0)
    expect(result.recent).toHaveLength(0)
  })

  it('handles partial data gracefully', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery(topCerts.slice(0, 1)))
      .mockReturnValueOnce(mockQueryWithNotIn(recentCerts.slice(0, 2)))

    const result = await fetchFeaturedCertificates()
    expect(result.topScore).toHaveLength(1)
    expect(result.recent).toHaveLength(2)
  })

  it('excludes top-score agent IDs from recent query', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery(topCerts))
      .mockReturnValueOnce(mockQueryWithNotIn(recentCerts))

    await fetchFeaturedCertificates()
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })
})
