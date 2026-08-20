/**
 * Rail selection.
 *
 * The rail is chosen from CONFIGURATION and nothing else. There is deliberately
 * no parameter here that a request could reach: a caller cannot pick the
 * network, the asset, the price, the payee or the facilitator by sending a
 * header, a body field or a query string. Selecting a rail is a deploy-time
 * decision.
 *
 * The pilot runs one rail at a time per deployment. `X402_STELLAR_PAY_TO` being
 * set is what moves the paid surface to Stellar testnet; absent it, the
 * deployed Celo behaviour is exactly what it was.
 */

import { isStellarRailEnabled } from '../config'
import { evmRail } from './evm'
import { stellarRail } from './stellar'
import type { PaymentRail } from './types'

export type { PaymentRail, PaymentIdentity, RailInspection } from './types'
export { evmRail } from './evm'
export { stellarRail } from './stellar'

/**
 * The rail this deployment sells through.
 *
 * Resolved per call rather than cached at module scope so that configuration
 * read from the environment stays honest under test and across serverless cold
 * starts. It is a branch on two constants — there is nothing to memoise.
 */
export function activeRail(): PaymentRail {
  return isStellarRailEnabled() ? stellarRail : evmRail
}
