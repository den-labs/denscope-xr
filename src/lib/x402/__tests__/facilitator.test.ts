import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config', () => ({
  x402Config: {
    facilitatorUrl: 'https://facilitator.test',
  },
}))

import { verifyX402Payment, settleX402Payment } from '../facilitator'
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

// Encode a fake X-PAYMENT header
const fakePayload = { x402Version: 2, payload: { signature: '0xSIG' } }
const fakePaymentHeader = Buffer.from(JSON.stringify(fakePayload)).toString('base64')

describe('verifyX402Payment', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns valid result on successful verify', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: true, payer: '0xAGENT', network: 'eip155:42220' }), { status: 200 })
    )

    const result = await verifyX402Payment(fakePaymentHeader, mockRequirements)
    expect(result.valid).toBe(true)
    expect(result.payer).toBe('0xAGENT')
  })

  it('returns error on invalid payment', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: false, invalidReason: 'bad signature' }), { status: 200 })
    )

    const result = await verifyX402Payment(fakePaymentHeader, mockRequirements)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('bad signature')
  })

  it('returns error on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('server error', { status: 500 })
    )

    const result = await verifyX402Payment(fakePaymentHeader, mockRequirements)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('500')
  })

  it('returns error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'))

    const result = await verifyX402Payment(fakePaymentHeader, mockRequirements)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('network down')
  })
})

describe('settleX402Payment', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns success with tx hash on successful settle', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, transaction: '0xTXHASH', network: 'eip155:42220', payer: '0xAGENT' }),
        { status: 200 }
      )
    )

    const result = await settleX402Payment(fakePaymentHeader, mockRequirements)
    expect(result.success).toBe(true)
    expect(result.transaction).toBe('0xTXHASH')
    expect(result.payer).toBe('0xAGENT')
  })

  it('returns error on failed settlement', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errorReason: 'insufficient funds' }), { status: 200 })
    )

    const result = await settleX402Payment(fakePaymentHeader, mockRequirements)
    expect(result.success).toBe(false)
    expect(result.error).toBe('insufficient funds')
  })

  it('returns error on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('bad gateway', { status: 502 })
    )

    const result = await settleX402Payment(fakePaymentHeader, mockRequirements)
    expect(result.success).toBe(false)
    expect(result.error).toContain('502')
  })
})
