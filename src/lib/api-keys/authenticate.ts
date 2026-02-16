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

  // Upsert daily usage counter
  const today = new Date().toISOString().slice(0, 10)
  const { data: usage } = await supabaseAdmin
    .from('api_usage_log')
    .upsert(
      { api_key_id: keyRow.id, usage_date: today, request_count: 1 },
      { onConflict: 'api_key_id,usage_date' }
    )
    .select('request_count')
    .single()

  // If row already existed, increment
  if (usage && usage.request_count === 1) {
    // Fresh insert, count is 1
  } else if (usage) {
    await supabaseAdmin
      .from('api_usage_log')
      .update({ request_count: usage.request_count + 1 })
      .eq('api_key_id', keyRow.id)
      .eq('usage_date', today)
  }

  const requestCount = usage?.request_count ?? 1
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
