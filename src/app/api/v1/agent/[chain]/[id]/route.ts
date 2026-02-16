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

  const agentKey = `${chainId}:${agentId}`
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', agentKey)
    .maybeSingle()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const { data: profile } = await supabaseAdmin
    .from('owner_profiles')
    .select('wallet_address, display_name, claimed_at')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()

  return NextResponse.json({
    agent: {
      chainId,
      agentId,
      owner: agent.owner,
      uri: agent.uri,
      metadata: agent.metadata,
      feedbackCount: agent.feedback_count,
      positiveCount: agent.positive_count,
      negativeCount: agent.negative_count,
      firstSeen: agent.first_seen,
      lastSeen: agent.last_seen,
      claimed: !!profile,
      claimedBy: profile?.wallet_address ?? null,
      displayName: profile?.display_name ?? null,
    },
  }, { headers: buildRateLimitHeaders(auth.rateLimit) })
}
