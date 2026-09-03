import { NextResponse } from 'next/server'
import { stellarConfig, isStellarRailEnabled } from '@/lib/x402/config'
import { siteUrl } from '@/config/site'

/**
 * Resource Ownership Convention v1.
 *
 * A public, protocol-level claim: "this origin sells this exact resource, and
 * payment for it goes to this address on this network." It is what lets a
 * catalogue tell an authentic DenScope resource from someone else's listing of
 * the same URL, because only this origin can serve this document.
 *
 * The convention is x402Seek's, and it is implemented here from its frozen v1
 * shape rather than imported: DenScope is an independent seller and must not
 * depend on the discovery layer being available, or on its code at all.
 *
 * Constraints the document must satisfy, and does:
 *   - HTTPS (the origin is);
 *   - the exact resource URL, no wildcard;
 *   - same origin as the resource itself;
 *   - no redirect dependency — this path is served directly.
 *
 * Declares nothing when the Stellar rail is unconfigured. An ownership claim
 * with an empty `payTo` is worse than no claim: it is a claim that resolves to
 * nobody, which a first-settlement TOFU binding could latch onto.
 */

const PAID_RESOURCE_PATH = '/api/v1/trust/evaluate'

export const dynamic = 'force-dynamic'

export async function GET() {
  const origin = process.env.X402_BASE_URL ?? siteUrl()

  const resources = isStellarRailEnabled()
    ? [
        {
          resource: `${origin}${PAID_RESOURCE_PATH}`,
          payTo: stellarConfig.payTo,
          network: stellarConfig.network,
        },
      ]
    : []

  return NextResponse.json(
    { version: 1, kind: 'resource-ownership', resources },
    {
      headers: {
        'Content-Type': 'application/json',
        // Public and stable, but short-lived enough that rotating the pilot
        // seller does not leave a stale claim cached for hours.
        'Cache-Control': 'public, max-age=300',
      },
    },
  )
}
