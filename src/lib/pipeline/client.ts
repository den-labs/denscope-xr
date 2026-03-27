// src/lib/pipeline/client.ts
import { createPublicClient, http, type Chain } from 'viem'
import { celo, celoSepolia, skaleBase } from 'viem/chains'
import type { ChainConfig } from '@/config/chains'

const viemChains: Record<number, Chain> = {
  42220: celo,
  11142220: celoSepolia,
  1187947933: skaleBase,
}

export function createChainClient(config: ChainConfig) {
  const chain = viemChains[config.id]
  return createPublicClient({
    chain,
    transport: http(config.rpc.http),
  })
}
