import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { incidentId } = await req.json()

    if (!incidentId) {
      return NextResponse.json(
        { error: 'Missing required field: incidentId' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('incidents')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', incidentId)
      .is('resolved_at', null)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Incident not found or already resolved' },
        { status: 404 }
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
