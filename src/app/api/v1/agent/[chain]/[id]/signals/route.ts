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

  const status = req.nextUrl.searchParams.get('status') ?? 'open'

  let query = supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('triggered_at', { ascending: false })
    .limit(50)

  if (status === 'open') {
    query = query.is('resolved_at', null)
  } else if (status === 'resolved') {
    query = query.not('resolved_at', 'is', null)
  }

  const { data } = await query

  const signals = (data ?? []).map((row) => ({
    id: row.id,
    signalKind: row.signal_kind,
    severity: row.severity,
    title: row.title,
    description: row.description,
    whyItMatters: row.why_it_matters,
    sourceTxHash: row.source_tx_hash,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
  }))

  return NextResponse.json(
    { signals, count: signals.length },
    { headers: buildRateLimitHeaders(auth.rateLimit) }
  )
}
