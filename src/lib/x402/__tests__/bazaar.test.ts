// @vitest-environment node
//
// Catalog eligibility (B1-B16).
//
// The facilitator catalogues a settled payment only when its payload carries a
// valid Bazaar extension and a resource URL. These tests reproduce that exact
// condition locally, using the SAME official validators the facilitator calls
// (`@x402/extensions@2.23.0`), so DenScope never depends on the
// facilitator-stellar repository at runtime or in tests.
//
// Nothing here signs, pays, settles, or touches a network.

import { describe, it, expect, vi } from 'vitest'
import {
  BAZAAR,
  extractDiscoveryInfo,
  validateDiscoveryExtension,
  validateDiscoveryExtensionSpec,
} from '@x402/extensions/bazaar'

const PAY_TO = 'GC4I5CKZ2MLRSMTHOEHVYMFDYVTKEQ3LCUKXCJ7ZWL43PKRSOCFHO4XP'
const USDC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
const RESOURCE_URL = 'https://www.denscope.xyz/api/v1/trust/evaluate'

vi.mock('@/config/site', () => ({ siteUrl: () => 'https://www.denscope.xyz' }))

vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>()
  return {
    ...actual,
    stellarConfig: {
      payTo: 'GC4I5CKZ2MLRSMTHOEHVYMFDYVTKEQ3LCUKXCJ7ZWL43PKRSOCFHO4XP',
      network: 'stellar:testnet',
      facilitatorUrl: 'https://facilitator.testnet.x402seek.xyz',
      price: 0.001,
    },
  }
})

import { stellarRail } from '../rails/stellar'
import { buildBazaarExtension } from '../bazaar'
import { buildPaymentPayload } from '../buyer-payload'

const endpoint = {
  path: '/api/v1/trust/evaluate',
  priceKey: 'evaluate',
  description: 'Contextual trust evaluation for ERC-8004 agent',
}

type Body = {
  x402Version: number
  accepts: Record<string, unknown>[]
  resource: Record<string, unknown>
  extensions?: Record<string, unknown>
}

async function live402(): Promise<Body> {
  const { body } = await stellarRail.paymentRequired(endpoint)
  return body as Body
}

/** The payload a conforming buyer would send, with a placeholder transaction. */
async function futurePayload(overrides: Partial<Body> = {}) {
  const body = { ...(await live402()), ...overrides }
  return buildPaymentPayload(body, body.accepts[0] as never, {
    x402Version: 2,
    payload: { transaction: 'UNSIGNED-PLACEHOLDER' },
  })
}

// ---------------------------------------------------------------------------
describe('B1-B6 — the seller advertises valid discovery metadata', () => {
  it('B1 — the unpaid Stellar 402 exposes extensions.bazaar', async () => {
    const body = await live402()
    expect(body.extensions).toBeDefined()
    expect(body.extensions?.[BAZAAR.key]).toBeTypeOf('object')
  })

  it('B2 — the extension passes the official spec and schema validators', async () => {
    const bazaar = (await live402()).extensions?.[BAZAAR.key]
    expect(validateDiscoveryExtensionSpec(bazaar as never)).toMatchObject({ valid: true })
    expect(validateDiscoveryExtension(bazaar as never)).toMatchObject({ valid: true })
  })

  it('B3 — resource.url is exactly the canonical DenScope resource', async () => {
    const body = await live402()
    expect(body.resource.url).toBe(RESOURCE_URL)
    expect(String(body.resource.url)).not.toContain('*')
    expect(new URL(String(body.resource.url)).protocol).toBe('https:')
  })

  it('B4 — the declared method is POST', async () => {
    const bazaar = (await live402()).extensions?.[BAZAAR.key] as {
      info: { input: { method: string; bodyType: string } }
    }
    expect(bazaar.info.input.method).toBe('POST')
    expect(bazaar.info.input.bodyType).toBe('json')
  })

  it('B5 — the input schema matches the route contract and invents nothing', async () => {
    const bazaar = buildBazaarExtension()[BAZAAR.key] as {
      schema: { properties: { input: { properties: { body: Record<string, unknown> } } } }
      info: { input: { body: Record<string, unknown> } }
    }
    // The builder places the declared inputSchema directly as `body`.
    const props = bazaar.schema.properties.input.properties.body
    // Exactly the fields route.ts reads — no more.
    expect(Object.keys(props).sort()).toEqual(
      ['agentId', 'chainId', 'context', 'objective', 'preset', 'sensitivity'].sort(),
    )
    expect((props.preset as { enum: string[] }).enum).toEqual([
      'default_safety', 'agent_to_agent', 'defi_counterparty',
    ])
    // The 512-char bound the route actually enforces.
    expect((props.context as { maxLength: number }).maxLength).toBe(512)
    expect((props.objective as { maxLength: number }).maxLength).toBe(512)
  })

  it('B6 — the output example is truthful, static and carries no live data', async () => {
    const bazaar = (await live402()).extensions?.[BAZAAR.key] as {
      info: { output?: { example?: { evaluation: Record<string, unknown> } } }
    }
    const ev = bazaar.info.output?.example?.evaluation
    expect(ev).toBeDefined()
    // Fields the shipped response actually returns.
    expect(ev).toHaveProperty('recommended_action')
    expect(ev).toHaveProperty('limitations')
    expect(ev).toHaveProperty('dataAsOf')
    // And it says the accepted-but-inert hints are inert.
    expect(JSON.stringify(ev!.limitations)).toContain('do NOT affect this result')
    // Static: no buyer, seller, or transaction values leak into discovery.
    const serialised = JSON.stringify(ev)
    expect(serialised).not.toContain(PAY_TO)
    expect(serialised).not.toContain('GBNFR7NL')
    expect(serialised).not.toMatch(/[0-9a-f]{64}/)
  })
})

describe('B7-B9 — the buyer preserves it, and the result is catalog-eligible', () => {
  it('B7 — resource survives payload construction unchanged', async () => {
    const body = await live402()
    const payload = await futurePayload()
    expect((payload as { resource?: unknown }).resource).toEqual(body.resource)
  })

  it('B8 — extensions.bazaar survives payload construction unchanged', async () => {
    const body = await live402()
    const payload = await futurePayload()
    expect((payload as { extensions?: unknown }).extensions).toEqual(body.extensions)
  })

  it('B9 — the future payload passes every catalog gate', async () => {
    const payload = await futurePayload()
    const accepted = (await live402()).accepts[0]
    const bazaar = (payload as { extensions?: Record<string, unknown> }).extensions?.[BAZAAR.key]

    // 1. would NOT produce `skipped: no-bazaar-extension`
    expect(bazaar).toBeTypeOf('object')
    // 2. would NOT produce INVALID_SCHEMA
    expect(validateDiscoveryExtensionSpec(bazaar as never)).toMatchObject({ valid: true })
    expect(validateDiscoveryExtension(bazaar as never)).toMatchObject({ valid: true })
    // 3. would NOT produce INVALID_METADATA
    const discovered = extractDiscoveryInfo(payload as never, accepted as never)
    expect(discovered).not.toBeNull()
    expect(discovered!.resourceUrl).toBe(RESOURCE_URL)
    expect(discovered!.serviceName).toBe('DenScope Trust Evaluation')
  })

  it('is protocol-generic: a 402 with no metadata yields a payload with none', async () => {
    // The propagation must not know what a seller is. Given nothing, it forwards
    // nothing rather than inventing a default.
    const bare = buildPaymentPayload(
      { x402Version: 2 },
      { scheme: 'exact', network: 'stellar:testnet', amount: '1', asset: 'C', payTo: 'G', maxTimeoutSeconds: 60, extra: {} } as never,
      { x402Version: 2, payload: { transaction: 't' } },
    )
    expect(bare).not.toHaveProperty('resource')
    expect(bare).not.toHaveProperty('extensions')
  })
})

describe('B10-B12 — the negative cases the facilitator would reject', () => {
  it('B10 — a payload without the extension reproduces no-bazaar-extension', async () => {
    const payload = await futurePayload({ extensions: undefined })
    const raw = (payload as { extensions?: Record<string, unknown> }).extensions?.[BAZAAR.key]
    // The facilitator's exact first gate.
    expect(!raw || typeof raw !== 'object').toBe(true)
  })

  it('B11 — a payload without resource.url cannot yield discovery metadata', async () => {
    const payload = await futurePayload({ resource: undefined })
    const accepted = (await live402()).accepts[0]
    // Measured, not assumed: upstream does `new URL(paymentPayload.resource?.url ?? "")`
    // and THROWS on the empty string rather than returning null. The facilitator
    // wraps catalogSettlement in try/catch, so this surfaces as a rejection —
    // CATALOG_WRITE_FAILED rather than INVALID_METADATA. Either way: no listing.
    expect(() => extractDiscoveryInfo(payload as never, accepted as never)).toThrow()
  })

  it('B12 — malformed extensions fail official validation', () => {
    // The two validators divide the work, which is why the facilitator calls
    // BOTH. Asserting only one would let real breakage through.
    //
    // spec  -> structural: is `info` present, is `input.type` a known kind
    // schema-> is the client-supplied JSON Schema itself well formed
    expect(validateDiscoveryExtensionSpec({ schema: {} } as never).valid).toBe(false)
    expect(validateDiscoveryExtensionSpec({ info: { input: { type: 'ftp' } } } as never).valid).toBe(false)
    expect(validateDiscoveryExtension({ info: { input: { type: 'http' } } } as never).valid).toBe(false)
  })
})

describe('B13 — discovery metadata is not payment authority', () => {
  it('cannot override network, scheme, asset, payTo or amount', async () => {
    const body = await live402()
    const real = body.accepts[0]

    // A hostile 402 clone whose discovery block lies about every economic fact.
    const lying = {
      ...body,
      resource: { ...body.resource, payTo: 'GATTACKER', amount: '1', network: 'stellar:pubnet' },
      extensions: {
        [BAZAAR.key]: {
          ...(body.extensions![BAZAAR.key] as Record<string, unknown>),
          payTo: 'GATTACKER', amount: '1', asset: 'CEVIL', network: 'stellar:pubnet',
        },
      },
    }
    const payload = buildPaymentPayload(lying, real as never, {
      x402Version: 2, payload: { transaction: 'x' },
    })

    // `accepted` is what the facilitator derives economic facts from, and it is
    // untouched by anything the discovery block claims.
    expect((payload as { accepted: Record<string, unknown> }).accepted).toEqual(real)
    expect((payload as { accepted: Record<string, unknown> }).accepted.payTo).toBe(PAY_TO)
    expect((payload as { accepted: Record<string, unknown> }).accepted.amount).toBe('10000')
    expect((payload as { accepted: Record<string, unknown> }).accepted.asset).toBe(USDC)
    expect((payload as { accepted: Record<string, unknown> }).accepted.network).toBe('stellar:testnet')
  })

  it('leaves the advertised economic requirements exactly as before', async () => {
    const req = await stellarRail.requirements(endpoint)
    expect(req).toMatchObject({
      scheme: 'exact', network: 'stellar:testnet',
      amount: '10000', asset: USDC, payTo: PAY_TO,
    })
  })
})

describe('B16 — these tests touch no network', () => {
  it('builds the 402 and the payload with fetch never called', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await futurePayload()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
