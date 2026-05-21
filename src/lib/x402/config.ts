/** x402 server config — reads from env vars with Celo mainnet defaults */

import { siteUrl } from '@/config/site'

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

  /** Public base URL for resource field */
  baseUrl: process.env.X402_BASE_URL ?? siteUrl(),

  /** UltravioletaDAO facilitator URL */
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

/** Whether x402 is configured (payTo must be set) */
export function isX402Enabled(): boolean {
  return x402Config.payTo.length > 0
}
