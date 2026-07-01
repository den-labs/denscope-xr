import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordEvaluation } from '../log'

const mockInsert = vi.fn(() => Promise.resolve({ error: null }))
const fromTables: string[] = []

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      fromTables.push(table)
      return { insert: mockInsert }
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  fromTables.length = 0
})

describe('recordEvaluation', () => {
  it('inserts a row into evaluation_log with mapped columns', async () => {
    await recordEvaluation({
      chainId: 42220,
      agentId: 5,
      endpoint: '/api/v1/trust/evaluate',
      preset: 'default_safety',
      authMethod: 'x402',
    })

    expect(fromTables).toContain('evaluation_log')
    expect(mockInsert).toHaveBeenCalledWith({
      chain_id: 42220,
      agent_id: 5,
      endpoint: '/api/v1/trust/evaluate',
      preset: 'default_safety',
      auth_method: 'x402',
    })
  })

  it('omits preset when not provided', async () => {
    await recordEvaluation({
      chainId: 1,
      agentId: 2,
      endpoint: '/api/v1/trust/evaluate',
      authMethod: 'api_key',
    })

    expect(mockInsert).toHaveBeenCalledWith({
      chain_id: 1,
      agent_id: 2,
      endpoint: '/api/v1/trust/evaluate',
      preset: null,
      auth_method: 'api_key',
    })
  })

  it('does not throw when the insert fails (fire-and-forget)', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'boom' } } as never)

    await expect(
      recordEvaluation({
        chainId: 1,
        agentId: 2,
        endpoint: '/api/v1/trust/evaluate',
        authMethod: 'api_key',
      }),
    ).resolves.toBeUndefined()
  })
})
