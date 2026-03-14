import { NextRequest, NextResponse } from 'next/server'
import { verifySiweMessage } from '@/lib/auth/verify'
import { createSession } from '@/lib/auth/session'
import { readAgentOwner } from '@/lib/agent/read'
import { getChain } from '@/config/chains'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SiweMessage } from 'siwe'

export async function POST(req: NextRequest) {
  try {
    const { message, signature, chainId, agentId } = await req.json()

    if (!message || !signature || !chainId || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, signature, chainId, agentId' },
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

    // Verify SIWE signature
    const result = await verifySiweMessage(message, signature)
    if (!result.valid) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }

    // Verify on-chain ownership
    const chain = getChain(chainId)
    if (!chain) {
      return NextResponse.json(
        { error: 'Unsupported chain' },
        { status: 400 }
      )
    }

    const onChainOwner = await readAgentOwner(chain, agentId)
    if (!onChainOwner) {
      return NextResponse.json(
        { error: 'Agent not found on-chain' },
        { status: 404 }
      )
    }

    if (result.address.toLowerCase() !== onChainOwner.toLowerCase()) {
      return NextResponse.json(
        { error: 'Wallet address does not match on-chain owner' },
        { status: 403 }
      )
    }

    // Insert into owner_profiles (upsert on unique constraint)
    const { data, error } = await supabaseAdmin
      .from('owner_profiles')
      .upsert(
        {
          wallet_address: result.address.toLowerCase(),
          chain_id: chainId,
          agent_id: agentId,
        },
        { onConflict: 'chain_id,agent_id' }
      )
      .select('chain_id, agent_id, display_name, claimed_at')
      .single()

    if (error) {
      console.error('Claim insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save claim' },
        { status: 500 }
      )
    }

    // Set session cookie
    await createSession(result.address)

    return NextResponse.json({ claimed: true, profile: data })
  } catch (err) {
    console.error('Claim error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
