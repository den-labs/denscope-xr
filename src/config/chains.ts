export type ChainConfig = {
  id: number
  name: string
  rpc: { http: string; ws?: string }
  contracts: {
    identity: `0x${string}`
    reputation: `0x${string}`
    validation?: `0x${string}`
  }
  explorer: string
  badge: { label: string; color: string }
  backfillWindow: number
  backfillChunkSize: number
  confirmations: number
  pollingInterval: number
}

export const chains: ChainConfig[] = [
  {
    id: 42220,
    name: 'Celo',
    rpc: {
      http:
        process.env.NEXT_PUBLIC_CELO_RPC_URL ?? 'https://forno.celo.org',
    },
    contracts: {
      identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    },
    explorer: 'https://celoscan.io',
    badge: { label: 'Celo', color: '#35D07F' },
    backfillWindow: 500,
    backfillChunkSize: 10,
    confirmations: 1,
    pollingInterval: 5000,
  },
]

export function getChain(chainId: number): ChainConfig | undefined {
  return chains.find((c) => c.id === chainId)
}
