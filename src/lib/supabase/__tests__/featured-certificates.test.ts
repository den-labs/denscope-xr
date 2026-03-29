import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchFeaturedCertificates } from '../featured-certificates'

const mockFrom = vi.fn()

vi.mock('../client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

function mockQuery(data: unknown[] | null) {
  return {
    select: vi.fn().mockReturnValue({
      not: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error: null }),
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
      .mockReturnValueOnce(mockQuery(recentCerts))

    const result = await fetchFeaturedCertificates()
    expect(result.topScore).toHaveLength(3)
    expect(result.recent).toHaveLength(3)
    expect(result.topScore[0].score).toBe(92)
    expect(result.recent[0].agentId).toBe(4)
  })

  it('returns empty arrays when no certificates exist', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery([]))
      .mockReturnValueOnce(mockQuery([]))

    const result = await fetchFeaturedCertificates()
    expect(result.topScore).toHaveLength(0)
    expect(result.recent).toHaveLength(0)
  })

  it('handles partial data gracefully', async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery(topCerts.slice(0, 1)))
      .mockReturnValueOnce(mockQuery(recentCerts.slice(0, 2)))

    const result = await fetchFeaturedCertificates()
    expect(result.topScore).toHaveLength(1)
    expect(result.recent).toHaveLength(2)
  })

  it('excludes top-score agents from recent results by chain+agent pair', async () => {
    // Recent rows include an agent that also appeared in top-score (42220:1)
    const recentWithOverlap = [
      { chain_id: 42220, agent_id: 1, hash: 'h-dup', issued_at: '2026-03-29T13:00:00Z', trust_scores: { score: 92 } },
      ...recentCerts,
    ]
    mockFrom
      .mockReturnValueOnce(mockQuery(topCerts))
      .mockReturnValueOnce(mockQuery(recentWithOverlap))

    const result = await fetchFeaturedCertificates()
    // Agent 42220:1 should be excluded from recent
    const recentAgentKeys = result.recent.map((c) => `${c.chainId}:${c.agentId}`)
    expect(recentAgentKeys).not.toContain('42220:1')
    expect(result.recent).toHaveLength(3)
    expect(result.recent[0].agentId).toBe(4)
  })

  it('allows same agent_id on different chains', async () => {
    // Top has agent_id 1 on chain 42220
    // Recent has agent_id 1 on chain 1187947933 (different chain = not a duplicate)
    const recentCrossChain = [
      { chain_id: 1187947933, agent_id: 1, hash: 'h-cross', issued_at: '2026-03-29T13:00:00Z', trust_scores: { score: 70 } },
      ...recentCerts,
    ]
    mockFrom
      .mockReturnValueOnce(mockQuery(topCerts))
      .mockReturnValueOnce(mockQuery(recentCrossChain))

    const result = await fetchFeaturedCertificates()
    // Agent 1 on SKALE should NOT be excluded (different chain from top-score's 42220:1)
    const recentAgentKeys = result.recent.map((c) => `${c.chainId}:${c.agentId}`)
    expect(recentAgentKeys).toContain('1187947933:1')
  })
})
