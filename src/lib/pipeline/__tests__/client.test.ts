import { describe, it, expect, vi } from 'vitest'

vi.mock('viem', () => ({
  createPublicClient: vi.fn().mockReturnValue({ type: 'mock-client' }),
  http: vi.fn().mockReturnValue('mock-transport'),
}))

vi.mock('viem/chains', () => ({
  celo: { id: 42220, name: 'Celo' },
  celoSepolia: { id: 11142220, name: 'Celo Sepolia' },
  skaleBase: { id: 1187947933, name: 'SKALE Base' },
}))

import { createPublicClient, http } from 'viem'
import { createChainClient } from '../client'

describe('createChainClient', () => {
  it('creates client with Celo chain and correct transport', () => {
    const config = { id: 42220, rpc: { http: 'https://forno.celo.org' } }
    const client = createChainClient(config as never)

    expect(http).toHaveBeenCalledWith('https://forno.celo.org')
    expect(createPublicClient).toHaveBeenCalledWith({
      chain: { id: 42220, name: 'Celo' },
      transport: 'mock-transport',
    })
    expect(client).toEqual({ type: 'mock-client' })
  })

  it('creates client with Celo Sepolia chain', () => {
    vi.mocked(createPublicClient).mockClear()
    vi.mocked(http).mockClear()

    const config = { id: 11142220, rpc: { http: 'https://forno.celo-sepolia.org' } }
    createChainClient(config as never)

    expect(http).toHaveBeenCalledWith('https://forno.celo-sepolia.org')
    expect(createPublicClient).toHaveBeenCalledWith({
      chain: { id: 11142220, name: 'Celo Sepolia' },
      transport: 'mock-transport',
    })
  })

  it('creates client with SKALE Base chain', () => {
    vi.mocked(createPublicClient).mockClear()
    vi.mocked(http).mockClear()

    const config = { id: 1187947933, rpc: { http: 'https://skale-base.skalenodes.com/v1/base' } }
    createChainClient(config as never)

    expect(http).toHaveBeenCalledWith('https://skale-base.skalenodes.com/v1/base')
    expect(createPublicClient).toHaveBeenCalledWith({
      chain: { id: 1187947933, name: 'SKALE Base' },
      transport: 'mock-transport',
    })
  })
})
