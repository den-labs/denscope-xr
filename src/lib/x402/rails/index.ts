/**
 * Rail selection.
 *
 * The rail is chosen from CONFIGURATION and nothing else. There is deliberately
 * no parameter here that a request could reach: a caller cannot pick the
 * network, the asset, the price, the payee or the facilitator by sending a
 * header, a body field or a query string. Selecting a rail is a deploy-time
 * decision.
 *
 * Selection is per RESOURCE, not per deployment. Production sells more than one
 * paid resource and the pilot moves exactly one of them: setting
 * `X402_STELLAR_PAY_TO` puts `/trust/evaluate` on Stellar testnet and leaves
 * `/signals` on Celo, untouched. A deployment-wide switch would instead drag
 * `/signals` onto a rail with no price for it and turn its 402 into a 500.
 */

import { isStellarRailEnabled } from '../config'
import { evmRail } from './evm'
import { stellarRail } from './stellar'
import type { PaymentRail, RailEndpoint } from './types'

export type { PaymentRail, PaymentIdentity, RailInspection } from './types'
export { evmRail } from './evm'
export { stellarRail } from './stellar'

/**
 * The rail that sells this endpoint.
 *
 * Resolved per call rather than cached at module scope so that configuration
 * read from the environment stays honest under test and across serverless cold
 * starts. It is a branch on two constants — there is nothing to memoise.
 *
 * @param endpoint - Resource being sold. Never caller-supplied.
 */
export function activeRail(endpoint: RailEndpoint): PaymentRail {
  if (isStellarRailEnabled() && stellarRail.supports(endpoint)) return stellarRail
  return evmRail
}
