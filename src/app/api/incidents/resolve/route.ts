import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { incidentId } = await req.json()

    if (!incidentId) {
      return NextResponse.json(
        { error: 'Missing required field: incidentId' },
        { status: 400 }
      )
    }

    // Verify caller owns the agent this incident belongs to
    const { data: incident } = await supabaseAdmin
      .from('incidents')
      .select('chain_id, agent_id')
      .eq('id', incidentId)
      .maybeSingle()

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 })
    }

    const { data: profile } = await supabaseAdmin
      .from('owner_profiles')
      .select('wallet_address')
      .eq('chain_id', incident.chain_id)
      .eq('agent_id', incident.agent_id)
      .eq('wallet_address', session.address)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Not the owner of this agent' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('incidents')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', incidentId)
      .is('resolved_at', null)
      .select('id, chain_id, agent_id, signal_kind, resolved_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Incident already resolved' },
        { status: 409 }
      )
    }

    return NextResponse.json({ resolved: true, incident: data })
  } catch (err) {
    console.error('Resolve incident error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
