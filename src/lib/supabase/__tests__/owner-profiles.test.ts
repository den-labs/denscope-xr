import { describe, it, expect } from 'vitest'
import { buildClaimRow, type OwnerProfile } from '@/lib/supabase/owner-profiles'

describe('owner-profiles helpers', () => {
  it('builds a claim row from params', () => {
    const row = buildClaimRow({
      walletAddress: '0xabc',
      chainId: 42220,
      agentId: 5,
    })
    expect(row).toEqual({
      wallet_address: '0xabc',
      chain_id: 42220,
      agent_id: 5,
    })
  })
})

describe('OwnerProfile type', () => {
  it('has required fields', () => {
    const profile: OwnerProfile = {
      id: 'uuid',
      wallet_address: '0x123',
      chain_id: 42220,
      agent_id: 1,
      display_name: null,
      claimed_at: '2026-02-16T00:00:00Z',
    }
    expect(profile.wallet_address).toBe('0x123')
  })
})
