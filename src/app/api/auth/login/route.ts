import { NextRequest, NextResponse } from 'next/server'
import { verifySiweMessage } from '@/lib/auth/verify'
import { createSession } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SiweMessage } from 'siwe'

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json()

    if (!message || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: message, signature' },
        { status: 400 }
      )
    }

    // Verify nonce exists in DB and consume it atomically
    const siweMsg = new SiweMessage(message)
    const { data: nonceRow, error: nonceErr } = await supabaseAdmin
      .from('nonces')
      .delete()
      .eq('nonce', siweMsg.nonce)
      .gt('expires_at', new Date().toISOString())
      .select()
      .maybeSingle()

    if (nonceErr || !nonceRow) {
      return NextResponse.json(
        { error: 'Invalid or expired nonce' },
        { status: 401 }
      )
    }

    // Verify SIWE signature, bound to the origin that made this request
    const expectedDomain =
      req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
    const result = await verifySiweMessage(message, signature, expectedDomain)
    if (!result.valid) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }

    // Create session (no claim required)
    await createSession(result.address)

    return NextResponse.json({ ok: true, address: result.address.toLowerCase() })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
