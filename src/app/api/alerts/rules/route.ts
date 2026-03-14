import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/auth/session'
import { buildDefaultRules } from '@/lib/supabase/alerts'

export async function GET(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const chainId = req.nextUrl.searchParams.get('chainId')
  const agentId = req.nextUrl.searchParams.get('agentId')

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Missing chainId or agentId' }, { status: 400 })
  }

  // Verify caller owns this agent
  const { data: profile } = await supabaseAdmin
    .from('owner_profiles')
    .select('wallet_address')
    .eq('chain_id', Number(chainId))
    .eq('agent_id', Number(agentId))
    .eq('wallet_address', session.address)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Not the owner of this agent' }, { status: 403 })
  }

  const { data } = await supabaseAdmin
    .from('alert_rules')
    .select('*')
    .eq('chain_id', Number(chainId))
    .eq('agent_id', Number(agentId))
    .order('rule_type')

  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { chainId, agentId } = await req.json()

    if (!chainId || !agentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const rows = buildDefaultRules({
      ownerAddress: session.address,
      chainId,
      agentId,
    })

    const { data, error } = await supabaseAdmin
      .from('alert_rules')
      .upsert(rows, { onConflict: 'chain_id,agent_id,rule_type' })
      .select()

    if (error) {
      console.error('Alert rules init error:', error)
      return NextResponse.json({ error: 'Failed to create alert rules' }, { status: 500 })
    }

    return NextResponse.json({ rules: data })
  } catch (err) {
    console.error('Alert rules error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { ruleId, enabled, webhookUrl } = await req.json()

    if (!ruleId) {
      return NextResponse.json({ error: 'Missing ruleId' }, { status: 400 })
    }

    // Verify caller owns the rule
    const { data: rule } = await supabaseAdmin
      .from('alert_rules')
      .select('owner_address')
      .eq('id', ruleId)
      .maybeSingle()

    if (!rule || rule.owner_address !== session.address) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
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
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ rule: data })
  } catch (err) {
    console.error('Alert rules patch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
