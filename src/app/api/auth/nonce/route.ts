import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateNonce } from '@/lib/auth/siwe'

export async function GET() {
  const nonce = generateNonce()

  const { error } = await supabaseAdmin
    .from('nonces')
    .insert({ nonce })

  if (error) {
    console.error('Nonce insert error:', error)
    return NextResponse.json({ error: 'Failed to generate nonce' }, { status: 500 })
  }

  return NextResponse.json({ nonce })
}
