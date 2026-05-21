import { NextRequest, NextResponse } from 'next/server'
import { siteUrl } from '@/config/site'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateHybrid, buildHybridHeaders } from '@/lib/x402/middleware'
import { recordX402Payment } from '@/lib/x402/payments'
import { toTrustScore } from '@/types/trust-score'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  const endpointPath = `/api/v1/agent/${chain}/${id}/score`
  const auth = await authenticateHybrid(req.headers, {
    path: endpointPath,
    priceKey: 'score',
    description: 'Trust score query for ERC-8004 agent',
  })
  if (!auth.ok) return auth.error

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const { data } = await supabaseAdmin
    .from('trust_scores')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()

  // Record x402 payment (fire-and-forget)
  if (auth.method === 'x402') {
    recordX402Payment({ chainId, agentId, endpoint: endpointPath, x402: auth.x402, priceKey: 'score' })
  }

  // Return computed score, or default score for agents with no feedback yet
  if (data) {
    const score = toTrustScore(data)
    return NextResponse.json({
      score: {
        value: score.score,
        confidence: score.confidence,
        breakdown: {
          positiveRatio: { value: score.positiveRatio, weight: 0.40 },
          ageScore: { value: score.ageScore, weight: 0.20 },
          activityScore: { value: score.activityScore, weight: 0.20 },
          incidentPenalty: { value: score.incidentPenalty, weight: 0.10 },
        },
        stats: {
          feedbackCount: score.feedbackCount,
          positiveCount: score.positiveCount,
          negativeCount: score.negativeCount,
          openIncidents: score.openIncidents,
        },
        updatedAt: score.updatedAt,
      },
      formula: `${siteUrl()}/docs/api#trust-score-formula`,
    }, { headers: buildHybridHeaders(auth) })
  }

  // Agent exists but has no trust score computed yet — return baseline
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  return NextResponse.json({
    score: {
      value: 0,
      confidence: 'low',
      breakdown: {
        positiveRatio: { value: 0, weight: 0.40 },
        ageScore: { value: 0, weight: 0.20 },
        activityScore: { value: 0, weight: 0.20 },
        incidentPenalty: { value: 0, weight: 0.10 },
      },
      stats: { feedbackCount: 0, positiveCount: 0, negativeCount: 0, openIncidents: 0 },
      updatedAt: null,
    },
    formula: `${siteUrl()}/docs/api#trust-score-formula`,
  }, { headers: buildHybridHeaders(auth) })
}
