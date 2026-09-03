/**
 * Client IP resolution, and the trust assumption behind it.
 *
 * TRUST MODEL — DenScope runs directly on Vercel with a custom domain and no
 * proxy in front of it. Vercel's request-headers reference states, verbatim:
 *
 *   x-forwarded-for — "The public IP address of the client that made the
 *   request. If you are trying to use Vercel behind a proxy, we currently
 *   overwrite the X-Forwarded-For header and do not forward external IPs.
 *   This restriction is in place to prevent IP spoofing."
 *
 *   x-vercel-forwarded-for — "identical to the x-forwarded-for header. However,
 *   x-forwarded-for could be overwritten if you're using a proxy on top of Vercel."
 *
 * Two consequences that this module depends on:
 *
 *  1. Vercel OVERWRITES rather than appends, so a client-supplied
 *     `X-Forwarded-For` never reaches us. That is what makes this usable as a
 *     rate-limit key at all. It stops being true if the Enterprise "Trusted
 *     Proxy" feature is ever purchased and enabled — that feature exists
 *     precisely to honour a custom X-Forwarded-For. DenScope is not on that
 *     plan; if it ever is, this file must be revisited before it is deployed.
 *
 *  2. `x-vercel-forwarded-for` is preferred because it survives a proxy being
 *     placed on top of Vercel, which is the one configuration change that would
 *     silently turn `x-forwarded-for` into attacker-controlled data.
 *
 * Related prior art: the x402Seek facilitator shipped SR-01, where every
 * visitor behind Railway shared a single rate-limit bucket, and its follow-up
 * note records that the proxy depth was *measured* rather than assumed. The
 * `source` field below exists so the same class of bug is observable here
 * instead of silent.
 */

export type ClientIpSource =
  | 'x-vercel-forwarded-for'
  | 'x-real-ip'
  | 'x-forwarded-for'
  | 'unresolved'

export interface ResolvedClientIp {
  /** Rate-limit key. `unknown` when no trusted header was present. */
  ip: string
  /** Which header answered. Surfaced so a misconfiguration is observable. */
  source: ClientIpSource
}

/** Bucket everyone shares when no trusted header is present. */
export const UNRESOLVED_IP = 'unknown'

function firstEntry(raw: string | null): string | null {
  if (!raw) return null
  // Vercel overwrites this header with a single public IP, so there is nothing
  // to walk. Taking the first entry (rather than the last) is correct precisely
  // because no untrusted hop is prepended; if Vercel ever appended instead,
  // this would be the spoofable end and the precedence above would be wrong.
  const first = raw.split(',')[0]?.trim()
  return first && first.length > 0 ? first : null
}

/**
 * Resolve the client IP from platform-set headers.
 *
 * Never throws. When nothing is resolvable it returns the shared
 * {@link UNRESOLVED_IP} bucket rather than skipping the limit — an
 * unidentifiable caller must not get an unlimited allowance. In local
 * development every request lands in that shared bucket, which is intended.
 */
export function resolveClientIp(headers: Headers): ResolvedClientIp {
  const vercel = firstEntry(headers.get('x-vercel-forwarded-for'))
  if (vercel) return { ip: vercel, source: 'x-vercel-forwarded-for' }

  const realIp = firstEntry(headers.get('x-real-ip'))
  if (realIp) return { ip: realIp, source: 'x-real-ip' }

  const forwarded = firstEntry(headers.get('x-forwarded-for'))
  if (forwarded) return { ip: forwarded, source: 'x-forwarded-for' }

  return { ip: UNRESOLVED_IP, source: 'unresolved' }
}
