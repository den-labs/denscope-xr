/** x402 server config — reads from env vars with Celo mainnet defaults */

import { siteUrl } from '@/config/site'

/**
 * Facilitator hosts this deployment is allowed to settle through (SEC-05).
 *
 * Deliberately a code-defined ALLOW list rather than an env var or a deny list.
 * A deny list only catches the mistakes someone thought of; an env-configured
 * allow list can drift silently with the very variable it is supposed to guard.
 *
 * The failure this prevents is specific and has happened before: `@x402/core`'s
 * HTTPFacilitatorClient falls back to `https://x402.org/facilitator` when no URL
 * is configured, which produces a completely working payment flow whose
 * settlement lands somewhere else entirely, with no error anywhere. The
 * x402Seek facilitator shipped exactly that bug (evidence E-06a) and wrote
 * `assertOwnFacilitator()` in response. DenScope had no equivalent.
 *
 * Adding a host here is a reviewed code change. The Stellar testnet pilot will
 * add exactly one entry; it is deliberately not pre-added.
 */
export const APPROVED_FACILITATOR_HOSTS: ReadonlySet<string> = new Set([
  // Celo mainnet — the facilitator the live deployment already settles through.
  'facilitator.ultravioletadao.xyz',
  // Stellar testnet pilot — the hosted DenLabs facilitator. Probed to report
  // `exact` on `stellar:testnet` with `areFeesSponsored: true`. The x402seek
  // hostname is known naming debt, not a second operator.
  'facilitator.testnet.x402seek.xyz',
])

/**
 * Facilitator request timeout.
 *
 * Was 30s, which is the maximum-damage setting for SEC-04: each anonymous
 * garbage payload held a serverless function open for that long. A legitimate
 * `/verify` is a signature check plus a chain read and settles well inside a
 * few seconds; `maxTimeoutSeconds` advertised in the 402 is 30, and a client
 * that has waited 15s for verification has already lost the round trip.
 */
export const FACILITATOR_TIMEOUT_MS = 15_000

export const x402Config = {
  /** Wallet that receives USDC payments */
  payTo: process.env.X402_PAY_TO ?? '',

  /** Blockchain network (CAIP-2 format) — Celo mainnet by default */
  network: process.env.X402_NETWORK ?? 'eip155:42220',

  /** USDC contract address on the target chain */
  assetAddress:
    process.env.X402_ASSET_ADDRESS ??
    '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', // Celo mainnet USDC

  /** Token name for EIP-712 domain */
  assetName: process.env.X402_ASSET_NAME ?? 'USD Coin',

  /** Public base URL for the `resource` field.
   *
   *  Lazy on purpose. `siteUrl()` throws when NEXT_PUBLIC_APP_URL is unset —
   *  which is the correct fail-fast behaviour — but calling it eagerly at module
   *  scope turned that into an import-time crash that took down every route
   *  importing this module, and made the payment config the one module with no
   *  green local coverage (SEC-09). Reading it here defers the throw to the one
   *  place that actually needs a URL: building the 402 `resource`. */
  resourceBaseUrl(): string {
    return process.env.X402_BASE_URL ?? siteUrl()
  },

  /** Facilitator endpoint. Must resolve to an approved host — see
   *  {@link facilitatorGuard}. There is no default that reaches the network:
   *  an unset value is a configuration error, not a fallback. */
  facilitatorUrl:
    process.env.X402_FACILITATOR_URL ??
    'https://facilitator.ultravioletadao.xyz',

  /** Per-endpoint pricing in USD */
  pricing: {
    score: parseFloat(process.env.X402_PRICE_SCORE ?? '0.001'),
    signals: parseFloat(process.env.X402_PRICE_SIGNALS ?? '0.0005'),
    evaluate: parseFloat(process.env.X402_PRICE_EVALUATE ?? '0.001'),
  } as Record<string, number>,
}

/**
 * Stellar testnet pilot configuration.
 *
 * Deliberately a SEPARATE object rather than new keys on `x402Config`: the two
 * rails share no asset, no decimals, no payee and no facilitator, and merging
 * them is how a 6-decimal amount ends up on a 7-decimal chain.
 *
 * Note what is absent. A seller receives; it never authorises and never submits.
 * There is no secret key here, no env var for one, and no code path that would
 * read one. If a change ever appears to need the seller's secret in the
 * application, that is a design regression, not a missing variable.
 */
export const stellarConfig = {
  /** Dedicated DenScope seller account, classic `G…` strkey. Public key only. */
  payTo: process.env.X402_STELLAR_PAY_TO ?? '',

  /** CAIP-2. Testnet for the pilot; pubnet is explicitly out of scope. */
  network: process.env.X402_STELLAR_NETWORK ?? 'stellar:testnet',

  /** Hosted DenLabs facilitator. Must survive {@link facilitatorGuard}. */
  facilitatorUrl:
    process.env.X402_STELLAR_FACILITATOR_URL ??
    'https://facilitator.testnet.x402seek.xyz',

  /**
   * Price in USD. The atomic amount is NEVER computed here — `ExactStellarScheme`
   * `.parsePrice()` does it, which is what makes 0.001 become `10000` (7 decimals)
   * rather than `1000` (the EVM 6-decimal assumption).
   */
  price: parseFloat(process.env.X402_STELLAR_PRICE_EVALUATE ?? '0.001'),
}

/** Whether the Stellar rail is configured. Requires a seller address. */
export function isStellarRailEnabled(): boolean {
  return stellarConfig.payTo.length > 0
}

export type FacilitatorGuardResult =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: 'unset' | 'malformed' | 'not_approved' | 'insecure_transport' }

/**
 * Assert that the configured facilitator is one we intend to settle through.
 *
 * Called before every outbound facilitator request. Never accepts a
 * caller-supplied value — the facilitator is not selectable per request, and
 * this function takes no request input by design.
 */
export function facilitatorGuard(
  raw: string | undefined = process.env.X402_FACILITATOR_URL ?? x402Config.facilitatorUrl,
): FacilitatorGuardResult {
  if (!raw || raw.trim() === '') return { ok: false, reason: 'unset' }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  // Payment authorisations in flight must not be observable. http:// is only
  // tolerated for a loopback facilitator in local development.
  const host = parsed.hostname.toLowerCase()
  const isLoopback = host === 'localhost' || host === '127.0.0.1'
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
    return { ok: false, reason: 'insecure_transport' }
  }

  if (!APPROVED_FACILITATOR_HOSTS.has(host) && !isLoopback) {
    return { ok: false, reason: 'not_approved' }
  }

  return { ok: true, url: raw, host }
}

/** Whether x402 is configured (payTo must be set) */
export function isX402Enabled(): boolean {
  return x402Config.payTo.length > 0
}
