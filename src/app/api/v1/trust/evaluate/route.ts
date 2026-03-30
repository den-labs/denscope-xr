import { NextRequest, NextResponse } from 'next/server'
import { authenticateHybrid, buildHybridHeaders } from '@/lib/x402/middleware'
import { recordX402Payment } from '@/lib/x402/payments'
import { composeEvaluation } from '@/lib/evaluation/compose'
import { isValidPreset } from '@/lib/evaluation/presets'
import type { PresetId } from '@/types/evaluation'

const ENDPOINT_PATH = '/api/v1/trust/evaluate'

export async function POST(req: NextRequest) {
  const auth = await authenticateHybrid(req.headers, {
    path: ENDPOINT_PATH,
    priceKey: 'evaluate',
    description: 'Contextual trust evaluation for ERC-8004 agent',
  })
  if (!auth.ok) return auth.error

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

  try {
    const result = await composeEvaluation({
      chainId,
      agentId,
      preset: preset as PresetId,
      context: body.context as string | undefined,
      sensitivity: body.sensitivity as 'low' | 'normal' | 'high' | undefined,
      objective: body.objective as string | undefined,
    })

    // Record x402 payment (fire-and-forget)
    if (auth.method === 'x402') {
      recordX402Payment({
        chainId,
        agentId,
        endpoint: ENDPOINT_PATH,
        x402: auth.x402,
        priceKey: 'evaluate',
      })
    }

    return NextResponse.json(result, { headers: buildHybridHeaders(auth) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Agent not found') {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    throw error
  }
}
