import { http, createConfig } from 'wagmi'
import { celo, celoSepolia } from 'wagmi/chains'
import { skaleBase } from 'viem/chains'
import { injected } from '@wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia, skaleBase],
  connectors: [
    injected(),
  ],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoSepolia.id]: http('https://forno.celo-sepolia.celo-testnet.org'),
    [skaleBase.id]: http('https://skale-base.skalenodes.com/v1/base'),
  },
  ssr: true,
})
