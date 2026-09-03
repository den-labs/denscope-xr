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

  // R9 — SEC-09 baseline: importing the payment config must not require env.
  it('imports without NEXT_PUBLIC_APP_URL set (SEC-09)', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.X402_BASE_URL
    await expect(import('../config')).resolves.toBeDefined()
  })

  it('throws only when a resource URL is actually needed', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.X402_BASE_URL
    const { x402Config } = await import('../config')
    expect(() => x402Config.resourceBaseUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('prefers X402_BASE_URL over the site URL', async () => {
    process.env.X402_BASE_URL = 'https://example.test'
    delete process.env.NEXT_PUBLIC_APP_URL
    const { x402Config } = await import('../config')
    expect(x402Config.resourceBaseUrl()).toBe('https://example.test')
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

// R8 — facilitator invariant (SEC-05)
describe('facilitatorGuard', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('approves the configured Celo facilitator', async () => {
    const { facilitatorGuard } = await import('../config')
    const result = facilitatorGuard('https://facilitator.ultravioletadao.xyz')
    expect(result).toEqual({
      ok: true,
      url: 'https://facilitator.ultravioletadao.xyz',
      host: 'facilitator.ultravioletadao.xyz',
    })
  })

  it('rejects the public x402.org facilitator', async () => {
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('https://x402.org/facilitator')).toEqual({
      ok: false,
      reason: 'not_approved',
    })
  })

  it('rejects an arbitrary unapproved host', async () => {
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('https://facilitator.attacker.example')).toEqual({
      ok: false,
      reason: 'not_approved',
    })
  })

  it('rejects an unset URL rather than falling back', async () => {
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('')).toEqual({ ok: false, reason: 'unset' })
    expect(facilitatorGuard(undefined)).not.toEqual({ ok: false, reason: 'unset' }) // falls to config default
  })

  it('rejects a malformed URL', async () => {
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('not a url')).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects plaintext http to a remote host', async () => {
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('http://facilitator.ultravioletadao.xyz')).toEqual({
      ok: false,
      reason: 'insecure_transport',
    })
  })

  it('allows http only for a loopback facilitator in local development', async () => {
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('http://localhost:4020')).toMatchObject({ ok: true, host: 'localhost' })
    expect(facilitatorGuard('http://127.0.0.1:4020')).toMatchObject({ ok: true })
  })

  it('is not host-case sensitive', async () => {
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('https://Facilitator.UltravioletaDAO.xyz').ok).toBe(true)
  })

  it('approves the Stellar pilot facilitator', async () => {
    // Added as a reviewed code change when the pilot shipped. Before this, the
    // guard refused it, which is the behaviour that must hold for every host
    // that has NOT been through review — see the next test.
    const { facilitatorGuard } = await import('../config')
    expect(facilitatorGuard('https://facilitator.testnet.x402seek.xyz')).toEqual({
      ok: true,
      url: 'https://facilitator.testnet.x402seek.xyz',
      host: 'facilitator.testnet.x402seek.xyz',
    })
  })

  it('refuses a facilitator that merely looks related to an approved one', async () => {
    // The allow list is exact-host. A lookalike is a different operator.
    const { facilitatorGuard } = await import('../config')
    for (const host of [
      'https://facilitator.testnet.x402seek.xyz.evil.tld',
      'https://testnet.x402seek.xyz',
      'https://facilitator.x402seek.xyz',
      'https://x402.org/facilitator',
    ]) {
      expect(facilitatorGuard(host)).toEqual({ ok: false, reason: 'not_approved' })
    }
  })
})
