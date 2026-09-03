import { describe, it, expect, vi } from 'vitest'

const PAY_TO = 'GDX6H6PL2DYMYW5UUZ6GGUD7UNCCHO6HNQMQDGQM4AMVP3LDGUZ2ZEMQ'

vi.mock('@/config/site', () => ({ siteUrl: () => 'https://www.denscope.xyz' }))

// Hoisted so the mock factory (which vitest lifts above every const) can close
// over it, and so a test can flip `payTo` at runtime.
const stellarConfig = vi.hoisted(() => ({
  payTo: 'GDX6H6PL2DYMYW5UUZ6GGUD7UNCCHO6HNQMQDGQM4AMVP3LDGUZ2ZEMQ',
  network: 'stellar:testnet',
  facilitatorUrl: 'https://facilitator.testnet.x402seek.xyz',
  price: 0.001,
}))

vi.mock('@/lib/x402/config', () => ({
  stellarConfig,
  isStellarRailEnabled: () => stellarConfig.payTo.length > 0,
}))

import { GET } from '../route'

describe('S9 — .well-known/x402 resource ownership', () => {
  it('declares the exact paid resource, payTo and network', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      version: 1,
      kind: 'resource-ownership',
      resources: [
        {
          resource: 'https://www.denscope.xyz/api/v1/trust/evaluate',
          payTo: PAY_TO,
          network: 'stellar:testnet',
        },
      ],
    })
  })

  it('names an exact HTTPS resource URL with no wildcard', async () => {
    const body = (await (await GET()).json()) as {
      resources: { resource: string }[]
    }
    const url = body.resources[0].resource
    expect(url.startsWith('https://')).toBe(true)
    expect(url).not.toContain('*')
    // Same origin as the resource it claims. A claim served from anywhere else
    // proves nothing.
    expect(new URL(url).origin).toBe('https://www.denscope.xyz')
  })

  it('claims nothing when the Stellar rail is unconfigured', async () => {
    // An ownership claim with an empty payTo resolves to nobody, which is worse
    // than no claim at all once a first-settlement TOFU binding sees it.
    stellarConfig.payTo = ''
    try {
      const body = (await (await GET()).json()) as { resources: unknown[] }
      expect(body.resources).toEqual([])
    } finally {
      stellarConfig.payTo = PAY_TO
    }
  })
})
