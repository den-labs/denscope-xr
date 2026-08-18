/**
 * Bounds how often an anonymous caller can make DenScope call the facilitator
 * (SEC-04).
 *
 * The attack this closes: `/verify` is reached before any authentication and
 * costs the attacker nothing, because a payload that never settles is never
 * paid for. Each attempt occupied a serverless function for up to 30 seconds
 * and produced an unauthenticated outbound request to a facilitator DenLabs
 * does not operate. Shape validation (see payload.ts) removes the free variant;
 * this removes the volume.
 *
 * Fixed one-minute window, counted in Postgres so it holds across serverless
 * instances — the same reason `increment_api_usage` lives there rather than in
 * process memory.
 *
 * FAIL CLOSED. If the counter cannot be consulted the attempt is refused. This
 * costs nothing in practice: the paid routes read their evidence from the same
 * database, so a Postgres outage already means the request cannot be served.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

/** Verification attempts allowed per bucket per window. */
export const VERIFY_ATTEMPT_LIMIT = 30
export const VERIFY_WINDOW_SECONDS = 60

export interface VerifyLimitResult {
  allowed: boolean
  /** Attempts consumed in the current window, including this one. */
  count: number
  limit: number
  /** Seconds until the current window rolls over. */
  retryAfterSeconds: number
  /** False when the counter itself was unreachable. */
  available: boolean
}

/** Start of the fixed window containing `now`, as an ISO timestamp. */
export function windowStart(now: number = Date.now()): string {
  const ms = VERIFY_WINDOW_SECONDS * 1000
  return new Date(Math.floor(now / ms) * ms).toISOString()
}

function retryAfter(now: number): number {
  const ms = VERIFY_WINDOW_SECONDS * 1000
  return Math.ceil((ms - (now % ms)) / 1000)
}

/**
 * Consume one verification attempt for `bucket`.
 *
 * @param bucket - Rate-limit key, normally the resolved client IP.
 */
export async function consumeVerifyAttempt(
  bucket: string,
  now: number = Date.now(),
): Promise<VerifyLimitResult> {
  const base = {
    limit: VERIFY_ATTEMPT_LIMIT,
    retryAfterSeconds: retryAfter(now),
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('increment_x402_verify_attempts', {
      p_bucket: bucket,
      p_window_start: windowStart(now),
    })

    if (error || typeof data !== 'number') {
      return { ...base, allowed: false, count: 0, available: false }
    }

    return { ...base, allowed: data <= VERIFY_ATTEMPT_LIMIT, count: data, available: true }
  } catch {
    return { ...base, allowed: false, count: 0, available: false }
  }
}
