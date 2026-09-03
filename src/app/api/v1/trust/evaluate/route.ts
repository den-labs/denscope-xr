import { NextRequest, NextResponse } from 'next/server'
import {
  authorizePaidRequest,
  deliverPaidResult,
  respondWithReplay,
} from '@/lib/x402/middleware'
import { recordEvaluation } from '@/lib/trustops/log'
import { composeEvaluation } from '@/lib/evaluation/compose'
import { isValidPreset } from '@/lib/evaluation/presets'
import type { PresetId } from '@/types/evaluation'

const ENDPOINT_PATH = '/api/v1/trust/evaluate'

const ENDPOINT = {
  path: ENDPOINT_PATH,
  priceKey: 'evaluate',
  description: 'Contextual trust evaluation for ERC-8004 agent',
}

/** Bounded to keep a fixed-price request a fixed-cost request. */
const MAX_HINT_CHARS = 512

export async function POST(req: NextRequest) {
  // Authorises only. Verifies the payment, refuses garbage, answers a replay —
  // but settles nothing. Everything below can still fail for free.
  const auth = await authorizePaidRequest(req.headers, ENDPOINT)
  if (!auth.ok) return auth.error

  // This exact payment already bought a result. Return it: no recomputation,
  // no second settlement.
  if (auth.method === 'x402-replay') return respondWithReplay(auth.delivered)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const chainId = Number(body.chainId)
  const agentId = Number(body.agentId)
  const preset = body.preset as string

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'chainId and agentId are required' }, { status: 400 })
  }

  if (!preset || !isValidPreset(preset)) {
    return NextResponse.json(
      { error: 'Invalid preset. Available: default_safety, agent_to_agent, defi_counterparty' },
      { status: 400 },
    )
  }

  for (const field of ['context', 'objective'] as const) {
    const value = body[field]
    if (value !== undefined && (typeof value !== 'string' || value.length > MAX_HINT_CHARS)) {
      return NextResponse.json(
        { error: `${field} must be a string of at most ${MAX_HINT_CHARS} characters` },
        { status: 400 },
      )
    }
  }

  let result
  try {
    result = await composeEvaluation({
      chainId,
      agentId,
      preset: preset as PresetId,
      context: body.context as string | undefined,
      sensitivity: body.sensitivity as 'low' | 'normal' | 'high' | undefined,
      objective: body.objective as string | undefined,
    })
  } catch (error) {
    // Precondition failures and internal faults alike return without settling.
    // The caller keeps their money and can retry with the same authorisation.
    if (error instanceof Error && error.message === 'Agent not found') {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    console.error('evaluate: computation failed', {
      chainId,
      agentId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 })
  }

  // The result exists. Only now does anything cost the caller money.
  const delivery = await deliverPaidResult(auth, result, { chainId, agentId })
  if (!delivery.ok) return delivery.error

  await recordEvaluation({
    chainId,
    agentId,
    endpoint: ENDPOINT_PATH,
    preset,
    authMethod: auth.method === 'x402' ? 'x402' : 'api_key',
  })

  return NextResponse.json(delivery.body, {
    status: delivery.status,
    headers: delivery.headers,
  })
}
