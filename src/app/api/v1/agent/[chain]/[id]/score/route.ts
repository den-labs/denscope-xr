import { NextRequest, NextResponse } from 'next/server'
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

  if (!data) {
    return NextResponse.json(
      { error: 'Trust score not available. Agent may have no events yet.' },
      { status: 404 }
    )
  }

  // Record x402 payment (fire-and-forget)
  if (auth.method === 'x402') {
    recordX402Payment({ chainId, agentId, endpoint: endpointPath, x402: auth.x402, priceKey: 'score' })
  }

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
    formula: 'https://denscope.vercel.app/docs/api#trust-score-formula',
  }, { headers: buildHybridHeaders(auth) })
}
