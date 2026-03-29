import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabaseAdmin before importing the module under test
vi.mock('@/lib/supabase/admin', () => {
  const mockFrom = vi.fn()
  return {
    supabaseAdmin: { from: mockFrom },
  }
})

import { collectMetrics } from '../collect'
import type { MetricsPayload } from '../collect'
import { supabaseAdmin } from '@/lib/supabase/admin'

/* ---------- helpers ---------- */

/** Build a mock query chain that resolves to { data, error, count } */
function mockQuery(result: {
  data?: unknown
  error?: { message: string } | null
  count?: number | null
}) {
  const terminal = {
    ...result,
    data: result.data ?? [],
    error: result.error ?? null,
    count: result.count ?? null,
  }
  // Chainable AND thenable: .select().gte().not() etc. — each returns the proxy
  // await resolves via .then() to terminal
  const chain: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_: unknown, prop: string) {
      if (prop === 'then') {
        // Make the proxy thenable so `await` resolves to terminal
        return (resolve: (v: unknown) => void) => resolve(terminal)
      }
      if (['data', 'error', 'count'].includes(prop)) {
        return terminal[prop as keyof typeof terminal]
      }
      // Any chained method (.select, .gte, .not, .eq, etc.) returns the proxy itself
      return (..._args: unknown[]) => new Proxy(chain, handler)
    },
  }
  return new Proxy(chain, handler)
}

function setupHappyPath() {
  const from = vi.mocked(supabaseAdmin.from)
  from.mockImplementation((_table: string) => mockQuery({ count: 0 }) as never)
}

function setupFailure(table: string, message: string) {
  const from = vi.mocked(supabaseAdmin.from)
  from.mockImplementation((t: string) => {
    if (t === table) {
      return mockQuery({ error: { message } }) as never
    }
    return mockQuery({ count: 0 }) as never
  })
}

/* ---------- tests ---------- */

describe('collectMetrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('return shape (MetricsPayload contract)', () => {
    it('returns a typed MetricsPayload with collectedAt ISO timestamp', async () => {
      setupHappyPath()
      const payload: MetricsPayload = await collectMetrics()

      expect(payload.collectedAt).toBeDefined()
      // ISO 8601 format check
      expect(new Date(payload.collectedAt).toISOString()).toBe(
        payload.collectedAt,
      )
    })

    it('has adoption, usage, and trustSurface groups', async () => {
      setupHappyPath()
      const payload = await collectMetrics()

      expect(payload).toHaveProperty('adoption')
      expect(payload).toHaveProperty('usage')
      expect(payload).toHaveProperty('trustSurface')
    })
  })

  describe('conversion math', () => {
    it('computes conversionRate as 0 when no API keys exist', async () => {
      setupHappyPath() // all counts return 0
      const payload = await collectMetrics()

      expect(payload.adoption.conversionRate).toBe(0)
    })
  })

  describe('error propagation', () => {
    it('throws when a Supabase query fails (no silent zeros)', async () => {
      setupFailure('api_keys', 'relation "api_keys" does not exist')

      await expect(collectMetrics()).rejects.toThrow()
    })
  })
})
