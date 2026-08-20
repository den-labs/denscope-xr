// @vitest-environment node
//
// Rail selection is per ENDPOINT, not per deployment.
//
// Production serves two paid resources: /signals on Celo and /trust/evaluate,
// which the pilot moves to Stellar. A deployment-wide switch would drag
// /signals onto a rail that has no price for it, turning a working 402 into a
// 500 the moment X402_STELLAR_PAY_TO is set in Vercel.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/config/site', () => ({ siteUrl: () => 'https://www.denscope.xyz' }))

vi.mock('../../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config')>()
  return {
    ...actual,
    isStellarRailEnabled: () => true,
    stellarConfig: {
      payTo: 'GC4I5CKZ2MLRSMTHOEHVYMFDYVTKEQ3LCUKXCJ7ZWL43PKRSOCFHO4XP',
      network: 'stellar:testnet',
      facilitatorUrl: 'https://facilitator.testnet.x402seek.xyz',
      price: 0.001,
    },
    x402Config: {
      payTo: '0xPAYTO',
      network: 'eip155:42220',
      assetAddress: '0xUSDC',
      assetName: 'USD Coin',
      resourceBaseUrl: () => 'https://www.denscope.xyz',
      facilitatorUrl: 'https://facilitator.ultravioletadao.xyz',
      pricing: { evaluate: 0.001, score: 0.001, signals: 0.0005 },
    },
  }
})

import { activeRail } from '../index'

const evaluate = {
  path: '/api/v1/trust/evaluate',
  priceKey: 'evaluate',
  description: 'Contextual trust evaluation for ERC-8004 agent',
}
const signals = {
  path: '/api/v1/agent/42220/5/signals',
  priceKey: 'signals',
  description: 'Risk signals',
}

describe('rail selection with the Stellar pilot enabled', () => {
  it('routes the pilot resource to Stellar', () => {
    expect(activeRail(evaluate).network).toBe('stellar:testnet')
  })

  it('leaves /signals on Celo', () => {
    // The pilot moves ONE resource. Enabling it must not touch the other.
    expect(activeRail(signals).network).toBe('eip155:42220')
  })

  it('still serves a 402 for /signals rather than throwing', async () => {
    // The regression this file exists for: a deployment-wide switch made
    // /signals answer 500, because the Stellar rail has no price for it.
    await expect(activeRail(signals).paymentRequired(signals)).resolves.toMatchObject({
      header: expect.any(String),
    })
  })

  it('quotes /signals in EVM 6-decimal units, not Stellar 7', async () => {
    const req = await activeRail(signals).requirements(signals)
    expect(req).toMatchObject({ network: 'eip155:42220', amount: '500' })
  })
})
