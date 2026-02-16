import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const chainId = req.nextUrl.searchParams.get('chainId')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 50)

  let query = supabaseAdmin
    .from('agents')
    .select('id, chain_id, agent_id, owner, uri, metadata, feedback_count, positive_count, negative_count, first_seen, last_seen')
    .order('feedback_count', { ascending: false })
    .limit(limit)

  if (chainId) {
    query = query.eq('chain_id', Number(chainId))
  }

  if (q) {
    const numericId = Number(q)
    if (!isNaN(numericId) && numericId > 0) {
      query = query.eq('agent_id', numericId)
    } else if (q.startsWith('0x')) {
      query = query.ilike('owner', `${q}%`)
    }
  }

  const { data } = await query

  const agents = (data ?? []).map((row) => ({
    chainId: row.chain_id,
    agentId: row.agent_id,
    owner: row.owner,
    uri: row.uri,
    feedbackCount: row.feedback_count,
    positiveCount: row.positive_count,
    negativeCount: row.negative_count,
  }))

  return NextResponse.json(
    { agents, count: agents.length },
    { headers: buildRateLimitHeaders(auth.rateLimit) }
  )
}
