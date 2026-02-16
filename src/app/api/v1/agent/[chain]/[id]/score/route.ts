import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'
import { toTrustScore } from '@/types/trust-score'

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
  }, { headers: buildRateLimitHeaders(auth.rateLimit) })
}
