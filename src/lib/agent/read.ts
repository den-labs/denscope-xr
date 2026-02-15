import { createChainClient } from '@/lib/pipeline/client'
import { identityRegistryAbi } from '@/config/contracts'
import type { ChainConfig } from '@/config/chains'

export async function readAgentOwner(chain: ChainConfig, agentId: number): Promise<string | null> {
  try {
    const client = createChainClient(chain)
    const owner = await client.readContract({
      address: chain.contracts.identity,
      abi: identityRegistryAbi,
      functionName: 'ownerOf',
      args: [BigInt(agentId)],
    })
    return owner as string
  } catch {
    return null
  }
}

export async function readAgentURI(chain: ChainConfig, agentId: number): Promise<string | null> {
  try {
    const client = createChainClient(chain)
    const uri = await client.readContract({
      address: chain.contracts.identity,
      abi: identityRegistryAbi,
      functionName: 'tokenURI',
      args: [BigInt(agentId)],
    })
    return uri as string
  } catch {
    return null
  }
}
