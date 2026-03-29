import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build a fluent mock that tracks the query builder chain
function createQueryBuilderMock(data: unknown[] = []) {
  const state = { eqCalls: [] as [string, unknown][], orArg: '' }
  const builder: Record<string, unknown> = {}

  builder.select = vi.fn().mockReturnValue(builder)
  builder.eq = vi.fn((...args: unknown[]) => {
    state.eqCalls.push(args as [string, unknown])
    return builder
  })
  builder.or = vi.fn((arg: string) => {
    state.orArg = arg
    return builder
  })
  builder.limit = vi.fn().mockResolvedValue({ data, error: null })

  return { builder, state }
}

// Mock the supabase client module before importing searchAgents
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

// Dynamic import after mock registration
const { searchAgents } = await import('@/lib/supabase/search-agents')

describe('searchAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('numeric query with chainId filters by agent_id AND chain_id', async () => {
    const { builder, state } = createQueryBuilderMock([
      { chain_id: 1187947933, agent_id: 5, owner: '0xabc', uri: '', feedback_count: 0, positive_count: 0, negative_count: 0, first_seen: null },
    ])
    mockFrom.mockReturnValue(builder)

    const result = await searchAgents('5', 20, 1187947933)

    expect(mockFrom).toHaveBeenCalledWith('agents')
    expect(builder.eq).toHaveBeenCalledWith('agent_id', 5)
    expect(state.eqCalls).toContainEqual(['chain_id', 1187947933])
    expect(result).toHaveLength(1)
    expect(result[0].chainId).toBe(1187947933)
    expect(result[0].agentId).toBe(5)
  })

  it('numeric query without chainId does NOT filter by chain_id', async () => {
    const { builder, state } = createQueryBuilderMock([])
    mockFrom.mockReturnValue(builder)

    await searchAgents('5', 20, null)

    expect(builder.eq).toHaveBeenCalledWith('agent_id', 5)
    const chainIdCalls = state.eqCalls.filter(([col]) => col === 'chain_id')
    expect(chainIdCalls).toHaveLength(0)
  })

  it('text search with chainId filters by chain_id', async () => {
    const { builder, state } = createQueryBuilderMock([
      { chain_id: 42220, agent_id: 1, owner: '0xabc', uri: 'https://agent.com', feedback_count: 3, positive_count: 2, negative_count: 1, first_seen: '2025-01-01T00:00:00Z' },
    ])
    mockFrom.mockReturnValue(builder)

    const result = await searchAgents('0xabc', 20, 42220)

    expect(builder.or).toHaveBeenCalledWith(
      expect.stringContaining('0xabc'),
    )
    expect(state.eqCalls).toContainEqual(['chain_id', 42220])
    expect(result).toHaveLength(1)
    expect(result[0].owner).toBe('0xabc')
  })

  it('returns empty array for empty query', async () => {
    const result = await searchAgents('   ', 20, 42220)
    expect(result).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('maps DB row to AgentSummary correctly', async () => {
    const { builder } = createQueryBuilderMock([
      { chain_id: 42220, agent_id: 10, owner: '0xdef', uri: 'ipfs://Qm...', feedback_count: 5, positive_count: 4, negative_count: 1, first_seen: '2025-06-15T12:00:00Z' },
    ])
    mockFrom.mockReturnValue(builder)

    const [agent] = await searchAgents('10', 10, 42220)

    expect(agent).toEqual({
      agentId: 10,
      chainId: 42220,
      owner: '0xdef',
      agentURI: 'ipfs://Qm...',
      feedbackCount: 5,
      positiveFeedback: 4,
      negativeFeedback: 1,
      lastEventBlock: 0,
      registeredAt: new Date('2025-06-15T12:00:00Z').getTime(),
    })
  })
})
