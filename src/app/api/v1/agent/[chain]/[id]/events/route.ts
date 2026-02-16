import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100)
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0)
  const kind = req.nextUrl.searchParams.get('kind')

  let query = supabaseAdmin
    .from('scope_events')
    .select('*', { count: 'exact' })
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('block_number', { ascending: false })
    .range(offset, offset + limit - 1)

  if (kind) {
    query = query.eq('kind', kind)
  }

  const { data, count } = await query

  const events = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    blockNumber: row.block_number,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    data: row.data,
    eventTimestamp: row.event_timestamp,
    createdAt: row.created_at,
  }))

  return NextResponse.json(
    {
      events,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        hasMore: offset + limit < (count ?? 0),
      },
    },
    { headers: buildRateLimitHeaders(auth.rateLimit) }
  )
}
