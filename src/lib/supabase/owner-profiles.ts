import { supabase } from './client'

export type OwnerProfile = {
  id: string
  wallet_address: string
  chain_id: number
  agent_id: number
  display_name: string | null
  claimed_at: string
}

type ClaimParams = {
  walletAddress: string
  chainId: number
  agentId: number
}

export function buildClaimRow(params: ClaimParams) {
  return {
    wallet_address: params.walletAddress,
    chain_id: params.chainId,
    agent_id: params.agentId,
  }
}

export async function fetchClaimStatus(
  chainId: number,
  agentId: number
): Promise<OwnerProfile | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('owner_profiles')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()
  return data as OwnerProfile | null
}

export async function fetchOwnerAgents(
  walletAddress: string
): Promise<OwnerProfile[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('owner_profiles')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('claimed_at', { ascending: false })
  return (data ?? []) as OwnerProfile[]
}
