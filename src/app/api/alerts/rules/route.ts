// src/app/api/alerts/rules/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildDefaultRules } from '@/lib/supabase/alerts'

// GET: fetch alert rules for an agent
export async function GET(req: NextRequest) {
  const chainId = req.nextUrl.searchParams.get('chainId')
  const agentId = req.nextUrl.searchParams.get('agentId')

  if (!chainId || !agentId) {
    return NextResponse.json(
      { error: 'Missing chainId or agentId' },
      { status: 400 }
    )
  }

  const { data } = await supabaseAdmin
    .from('alert_rules')
    .select('*')
    .eq('chain_id', Number(chainId))
    .eq('agent_id', Number(agentId))
    .order('rule_type')

  return NextResponse.json({ rules: data ?? [] })
}

// POST: initialize default rules for an agent (called after claim)
export async function POST(req: NextRequest) {
  try {
    const { ownerAddress, chainId, agentId } = await req.json()

    if (!ownerAddress || !chainId || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const rows = buildDefaultRules({
      ownerAddress: ownerAddress.toLowerCase(),
      chainId,
      agentId,
    })

    const { data, error } = await supabaseAdmin
      .from('alert_rules')
      .upsert(rows, { onConflict: 'chain_id,agent_id,rule_type' })
      .select()

    if (error) {
      console.error('Alert rules init error:', error)
      return NextResponse.json(
        { error: 'Failed to create alert rules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rules: data })
  } catch (err) {
    console.error('Alert rules error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: toggle rule enabled/disabled or set webhook URL
export async function PATCH(req: NextRequest) {
  try {
    const { ruleId, enabled, webhookUrl } = await req.json()

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing ruleId' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof enabled === 'boolean') updates.enabled = enabled
    if (typeof webhookUrl === 'string') updates.webhook_url = webhookUrl || null

    const { data, error } = await supabaseAdmin
      .from('alert_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ rule: data })
  } catch (err) {
    console.error('Alert rules patch error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
