import type { PaymentRequiredResponse } from './types'
import { x402Config } from './config'

interface CreatePaymentRequiredOptions {
  resourceUrl: string
  description: string
  priceKey: string
}

/**
 * Build a 402 Payment Required response body + base64-encoded header.
 * Amount is always serialized as string (pitfall #4 from implementation guide).
 */
export function createPaymentRequired(opts: CreatePaymentRequiredOptions): {
  body: PaymentRequiredResponse
  header: string
} {
  const price = x402Config.pricing[opts.priceKey] ?? 0.001
  const microUnits = Math.round(price * 1_000_000)

  const body: PaymentRequiredResponse = {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: x402Config.network,
        amount: String(microUnits),
        asset: x402Config.assetAddress,
        payTo: x402Config.payTo,
        maxTimeoutSeconds: 30,
        extra: {
          assetTransferMethod: 'eip3009',
          name: x402Config.assetName,
          version: '2',
        },
      },
    ],
    resource: {
      url: opts.resourceUrl,
      description: opts.description,
      mimeType: 'application/json',
    },
    error: 'missing payment header',
  }

  const header = Buffer.from(JSON.stringify(body)).toString('base64')

  return { body, header }
}
