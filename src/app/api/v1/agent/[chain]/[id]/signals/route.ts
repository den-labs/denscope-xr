import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateHybrid, buildHybridHeaders } from '@/lib/x402/middleware'
import { recordX402Payment } from '@/lib/x402/payments'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  const endpointPath = `/api/v1/agent/${chain}/${id}/signals`
  const auth = await authenticateHybrid(req.headers, {
    path: endpointPath,
    priceKey: 'signals',
    description: 'Risk signals for ERC-8004 agent',
  })
  if (!auth.ok) return auth.error

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

  // Record x402 payment (fire-and-forget)
  if (auth.method === 'x402') {
    recordX402Payment({ chainId, agentId, endpoint: endpointPath, x402: auth.x402, priceKey: 'signals' })
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

  return NextResponse.json(
    { signals, count: signals.length },
    { headers: buildHybridHeaders(auth) }
  )
}
