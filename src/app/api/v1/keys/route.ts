import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/lib/auth/session'
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/api-keys/generate'

export async function GET() {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { data } = await supabaseAdmin
    .from('api_keys')
    .select('id, key_prefix, label, tier, daily_limit, enabled, last_used_at, created_at')
    .eq('owner_address', session.address)
    .order('created_at', { ascending: false })

  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { label } = await req.json()

    const { count } = await supabaseAdmin
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('owner_address', session.address)

    if (count && count >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 API keys per owner' },
        { status: 409 }
      )
    }

    const rawKey = generateApiKey()
    const keyHash = await hashApiKey(rawKey)
    const keyPrefix = getKeyPrefix(rawKey)

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        owner_address: session.address,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        label: label || 'default',
        tier: 'free',
        daily_limit: 100,
      })
      .select('id, key_prefix, label, tier, daily_limit, created_at')
      .single()

    if (error) {
      console.error('API key create error:', error)
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
    }

    return NextResponse.json({ key: rawKey, metadata: data })
  } catch (err) {
    console.error('API key error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { keyId } = await req.json()
    if (!keyId) {
      return NextResponse.json({ error: 'Missing keyId' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('owner_address', session.address)

    if (error) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('API key delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
