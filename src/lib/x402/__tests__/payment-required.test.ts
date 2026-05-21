import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config so tests are deterministic
vi.mock('../config', () => ({
  x402Config: {
    payTo: '0xTEST_WALLET',
    network: 'eip155:42220',
    assetAddress: '0xUSDC_ADDRESS',
    assetName: 'USD Coin',
    baseUrl: 'https://www.denscope.xyz',
    facilitatorUrl: 'https://facilitator.ultravioletadao.xyz',
    pricing: { score: 0.001, signals: 0.0005 },
  },
}))

import { createPaymentRequired } from '../payment-required'

describe('createPaymentRequired', () => {
  it('generates valid 402 body for score endpoint', () => {
    const { body, header } = createPaymentRequired({
      resourceUrl: 'https://www.denscope.xyz/api/v1/agent/42220/5/score',
      description: 'Trust score query',
      priceKey: 'score',
    })

    expect(body.x402Version).toBe(2)
    expect(body.accepts).toHaveLength(1)
    expect(body.accepts[0].scheme).toBe('exact')
    expect(body.accepts[0].network).toBe('eip155:42220')
    expect(body.accepts[0].payTo).toBe('0xTEST_WALLET')
    expect(body.accepts[0].asset).toBe('0xUSDC_ADDRESS')
    // $0.001 * 1_000_000 = 1000 micro-USDC
    expect(body.accepts[0].amount).toBe('1000')
    expect(typeof body.accepts[0].amount).toBe('string')
    expect(body.accepts[0].extra.assetTransferMethod).toBe('eip3009')
    expect(body.resource.mimeType).toBe('application/json')
    expect(header.length).toBeGreaterThan(0)
  })

  it('generates correct amount for signals pricing', () => {
    const { body } = createPaymentRequired({
      resourceUrl: 'https://www.denscope.xyz/api/v1/agent/42220/5/signals',
      description: 'Signals query',
      priceKey: 'signals',
    })

    // $0.0005 * 1_000_000 = 500 micro-USDC
    expect(body.accepts[0].amount).toBe('500')
  })

  it('amount is always a string (pitfall #4)', () => {
    const { body } = createPaymentRequired({
      resourceUrl: 'https://example.com/test',
      description: 'Test',
      priceKey: 'score',
    })
    expect(typeof body.accepts[0].amount).toBe('string')
  })

  it('header decodes back to the body', () => {
    const { body, header } = createPaymentRequired({
      resourceUrl: 'https://www.denscope.xyz/api/v1/agent/42220/5/score',
      description: 'Trust score',
      priceKey: 'score',
    })
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'))
    expect(decoded).toEqual(body)
  })

  it('falls back to $0.001 for unknown price key', () => {
    const { body } = createPaymentRequired({
      resourceUrl: 'https://example.com/test',
      description: 'Test',
      priceKey: 'nonexistent',
    })
    expect(body.accepts[0].amount).toBe('1000')
  })
})
