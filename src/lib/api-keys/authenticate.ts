import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashApiKey, validateKeyFormat } from '@/lib/api-keys/generate'
import { isRateLimited, type RateLimitResult } from '@/lib/api-keys/rate-limit'

export function extractApiKey(headers: Headers): string | null {
  const authHeader = headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return headers.get('X-API-Key')
}

export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resetAt,
  }
}

export type AuthResult =
  | { ok: true; keyId: string; rateLimit: RateLimitResult }
  | { ok: false; error: NextResponse }

export async function authenticateApiKey(headers: Headers): Promise<AuthResult> {
  const rawKey = extractApiKey(headers)

  if (!rawKey) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Missing API key. Provide via Authorization: Bearer <key> or X-API-Key header.' },
        { status: 401 }
      ),
    }
  }

  if (!validateKeyFormat(rawKey)) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 401 }
      ),
    }
  }

  const keyHash = await hashApiKey(rawKey)

  const { data: keyRow } = await supabaseAdmin
    .from('api_keys')
    .select('id, daily_limit, enabled')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!keyRow) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    }
  }

  if (!keyRow.enabled) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'API key is disabled' }, { status: 403 }),
    }
  }

  // Atomic increment via Supabase RPC
  const today = new Date().toISOString().slice(0, 10)
  const { data: rpcResult, error: rpcError } = await supabaseAdmin
    .rpc('increment_api_usage', { p_api_key_id: keyRow.id, p_usage_date: today })

  if (rpcError) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Rate limit service unavailable' }, { status: 503 }),
    }
  }
  const requestCount = rpcResult as number
  const rateLimit = isRateLimited({ requestCount, dailyLimit: keyRow.daily_limit })

  if (rateLimit.limited) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Rate limit exceeded', ...rateLimit },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit),
        }
      ),
    }
  }

  // Update last_used_at
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)

  return { ok: true, keyId: keyRow.id, rateLimit }
}
