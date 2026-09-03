import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  authorizePaidRequest,
  deliverPaidResult,
  respondWithReplay,
} from '@/lib/x402/middleware'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

const VALID_STATUS = new Set(['open', 'resolved', 'all'])

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)
  const endpointPath = `/api/v1/agent/${chain}/${id}/signals`

  const auth = await authorizePaidRequest(req.headers, {
    path: endpointPath,
    priceKey: 'signals',
    description: 'Risk signals for ERC-8004 agent',
  })
  if (!auth.ok) return auth.error
  if (auth.method === 'x402-replay') return respondWithReplay(auth.delivered)

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'open'
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Available: open, resolved, all' },
      { status: 400 },
    )
  }

  // Precondition: an agent DenScope has never indexed has no signals to sell.
  // Checked before settlement so an unknown id costs the caller nothing.
  const { data: agent, error: agentError } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()

  if (agentError) {
    console.error('signals: agent lookup failed', { chainId, agentId, code: agentError.code })
    return NextResponse.json({ error: 'Signals lookup failed' }, { status: 500 })
  }
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

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

  const { data, error } = await query
  if (error) {
    console.error('signals: query failed', { chainId, agentId, code: error.code })
    return NextResponse.json({ error: 'Signals lookup failed' }, { status: 500 })
  }

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

  const delivery = await deliverPaidResult(
    auth,
    { signals, count: signals.length },
    { chainId, agentId },
  )
  if (!delivery.ok) return delivery.error

  return NextResponse.json(delivery.body, {
    status: delivery.status,
    headers: delivery.headers,
  })
}
