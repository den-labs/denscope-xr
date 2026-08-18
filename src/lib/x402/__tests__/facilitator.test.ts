import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof import('../config')>('../config')
  return {
    ...actual,
    FACILITATOR_TIMEOUT_MS: 15_000,
    facilitatorGuard: vi.fn(() => ({
      ok: true as const,
      url: 'https://facilitator.ultravioletadao.xyz',
      host: 'facilitator.ultravioletadao.xyz',
    })),
  }
})

import { verifyX402Payment, settleX402Payment } from '../facilitator'
import { facilitatorGuard } from '../config'
import type { PaymentRequirement } from '../types'

const mockRequirements: PaymentRequirement = {
  scheme: 'exact',
  network: 'eip155:42220',
  amount: '1000',
  asset: '0xUSDC',
  payTo: '0xPAYTO',
  maxTimeoutSeconds: 30,
  extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
}

const payload = { x402Version: 2, payload: { signature: '0xSIG' } }

describe('verifyX402Payment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(facilitatorGuard).mockReturnValue({
      ok: true,
      url: 'https://facilitator.ultravioletadao.xyz',
      host: 'facilitator.ultravioletadao.xyz',
    })
  })

  it('returns valid result on successful verify', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ isValid: true, payer: '0xAGENT', network: 'eip155:42220' }),
        { status: 200 },
      ),
    )

    const result = await verifyX402Payment(payload, mockRequirements)
    expect(result.valid).toBe(true)
    expect(result.payer).toBe('0xAGENT')
  })

  it('returns error on invalid payment', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidReason: 'bad signature' }), { status: 200 }),
    )

    const result = await verifyX402Payment(payload, mockRequirements)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('bad signature')
  })

  it('returns a status token on HTTP failure without echoing the upstream body (SEC-07)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('internal detail that must not leak', { status: 500 }),
    )

    const result = await verifyX402Payment(payload, mockRequirements)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('facilitator_error:500')
    expect(result.error).not.toContain('internal detail')
  })

  it('returns a closed token on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    const result = await verifyX402Payment(payload, mockRequirements)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('facilitator_unreachable')
    expect(result.error).not.toContain('network down')
  })

  it('caps an over-long invalidReason rather than relaying it whole', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidReason: 'x'.repeat(5000) }), { status: 200 }),
    )

    const result = await verifyX402Payment(payload, mockRequirements)
    expect(result.error).toHaveLength(200)
  })

  // R8 — facilitator invariant
  it('refuses to call an unapproved facilitator and makes NO network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.mocked(facilitatorGuard).mockReturnValue({ ok: false, reason: 'not_approved' })

    const result = await verifyX402Payment(payload, mockRequirements)

    expect(result.valid).toBe(false)
    expect(result.error).toBe('facilitator_not_approved:not_approved')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('uses the guard-returned URL, not raw config', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: true, payer: '0xA' }), { status: 200 }),
    )
    vi.mocked(facilitatorGuard).mockReturnValue({
      ok: true,
      url: 'https://facilitator.example',
      host: 'facilitator.example',
    })

    await verifyX402Payment(payload, mockRequirements)
    expect(fetchSpy.mock.calls[0][0]).toBe('https://facilitator.example/verify')
  })
})

describe('settleX402Payment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(facilitatorGuard).mockReturnValue({
      ok: true,
      url: 'https://facilitator.ultravioletadao.xyz',
      host: 'facilitator.ultravioletadao.xyz',
    })
  })

  it('returns success with tx hash on successful settle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, transaction: '0xTXHASH', network: 'eip155:42220', payer: '0xAGENT' }),
        { status: 200 },
      ),
    )

    const result = await settleX402Payment(payload, mockRequirements)
    expect(result.success).toBe(true)
    expect(result.transaction).toBe('0xTXHASH')
    expect(result.payer).toBe('0xAGENT')
  })

  it('returns error on failed settlement', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errorReason: 'insufficient funds' }), { status: 200 }),
    )

    const result = await settleX402Payment(payload, mockRequirements)
    expect(result.success).toBe(false)
    expect(result.error).toBe('insufficient funds')
  })

  it('returns a status token on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))

    const result = await settleX402Payment(payload, mockRequirements)
    expect(result.success).toBe(false)
    expect(result.error).toBe('facilitator_error:502')
  })

  // R8 — the guard protects settlement too, not just verification
  it('refuses to settle through an unapproved facilitator', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    vi.mocked(facilitatorGuard).mockReturnValue({ ok: false, reason: 'unset' })

    const result = await settleX402Payment(payload, mockRequirements)

    expect(result.success).toBe(false)
    expect(result.error).toBe('facilitator_not_approved:unset')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
