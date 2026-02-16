import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/api-keys/generate'

export async function GET(req: NextRequest) {
  const ownerAddress = req.nextUrl.searchParams.get('ownerAddress')
  if (!ownerAddress) {
    return NextResponse.json({ error: 'Missing ownerAddress' }, { status: 400 })
  }

  const { data } = await supabaseAdmin
    .from('api_keys')
    .select('id, key_prefix, label, tier, daily_limit, enabled, last_used_at, created_at')
    .eq('owner_address', ownerAddress.toLowerCase())
    .order('created_at', { ascending: false })

  return NextResponse.json({ keys: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const { ownerAddress, label } = await req.json()
    if (!ownerAddress) {
      return NextResponse.json({ error: 'Missing ownerAddress' }, { status: 400 })
    }

    const { count } = await supabaseAdmin
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('owner_address', ownerAddress.toLowerCase())

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
        owner_address: ownerAddress.toLowerCase(),
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
  try {
    const { keyId, ownerAddress } = await req.json()
    if (!keyId || !ownerAddress) {
      return NextResponse.json({ error: 'Missing keyId or ownerAddress' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('owner_address', ownerAddress.toLowerCase())

    if (error) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('API key delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
