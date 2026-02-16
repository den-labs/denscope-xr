import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('x402 config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('uses Celo mainnet defaults when no env vars set', async () => {
    delete process.env.X402_PAY_TO
    delete process.env.X402_NETWORK
    const { x402Config, isX402Enabled } = await import('../config')
    expect(x402Config.network).toBe('eip155:42220')
    expect(x402Config.facilitatorUrl).toBe('https://facilitator.ultravioletadao.xyz')
    expect(isX402Enabled()).toBe(false)
  })

  it('reads env vars when present', async () => {
    process.env.X402_PAY_TO = '0xABC'
    process.env.X402_NETWORK = 'eip155:11142220'
    const { x402Config, isX402Enabled } = await import('../config')
    expect(x402Config.payTo).toBe('0xABC')
    expect(x402Config.network).toBe('eip155:11142220')
    expect(isX402Enabled()).toBe(true)
  })

  it('has correct default pricing', async () => {
    const { x402Config } = await import('../config')
    expect(x402Config.pricing.score).toBe(0.001)
    expect(x402Config.pricing.signals).toBe(0.0005)
  })
})
