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
  {
    id: 11142220,
    name: 'Celo Sepolia',
    rpc: {
      http:
        process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC_URL ??
        'https://forno.celo-sepolia.celo-testnet.org',
    },
    contracts: {
      identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
      reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    },
    explorer: 'https://sepolia.celoscan.io',
    badge: { label: 'Sepolia', color: '#FCFF52' },
    backfillWindow: 500,
    backfillChunkSize: 10,
    confirmations: 1,
    pollingInterval: 5000,
  },
  {
    id: 1187947933,
    name: 'SKALE Base',
    rpc: {
      http:
        process.env.NEXT_PUBLIC_SKALE_BASE_RPC_URL ??
        'https://skale-base.skalenodes.com/v1/base',
      ws: 'wss://skale-base.skalenodes.com/v1/ws/base',
    },
    contracts: {
      identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    },
    explorer: 'https://skale-base-explorer.skalenodes.com',
    badge: { label: 'SKALE Base', color: '#4FC3F7' },
    backfillWindow: 2000,
    backfillChunkSize: 10,
    confirmations: 1,
    pollingInterval: 5000,
  },
]

export function getChain(chainId: number): ChainConfig | undefined {
  return chains.find((c) => c.id === chainId)
}
