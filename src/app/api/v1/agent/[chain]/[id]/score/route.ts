import { NextRequest, NextResponse } from 'next/server'
import { siteUrl } from '@/config/site'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'
import { toTrustScore } from '@/types/trust-score'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

/**
 * Trust score — FREE, API key only.
 *
 * This endpoint used to charge $0.001 per call over x402. It no longer does.
 * The v1 formula is published at /docs/api#trust-score-formula and every input
 * is public on-chain data, so anyone with the events can recompute the number
 * themselves: charging for it was gating a lookup rather than selling analysis.
 *
 * The boundary DenScope now holds is "free = what the chain says, paid = what
 * DenScope concludes". The paid product is the contextual decision at
 * /api/v1/trust/evaluate, which turns this score plus incidents, freshness and
 * a risk preset into a recommended action.
 *
 * Removing payment here also shrinks the surface that has to be economically
 * correct: /score can no longer take money and return 404.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const headers = buildRateLimitHeaders(auth.rateLimit)

  const { data } = await supabaseAdmin
    .from('trust_scores')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()

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
    }, { headers })
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
  }, { headers })
}
