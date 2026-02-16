import { http, createConfig } from 'wagmi'
import { celo, celoSepolia } from 'wagmi/chains'
import { injected } from '@wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoSepolia.id]: http('https://forno.celo-sepolia.celo-testnet.org'),
  },
  ssr: true,
})
