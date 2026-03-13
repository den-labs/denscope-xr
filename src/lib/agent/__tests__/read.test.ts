import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReadContract = vi.fn()

vi.mock('@/lib/pipeline/client', () => ({
  createChainClient: () => ({ readContract: mockReadContract }),
}))

vi.mock('@/config/contracts', () => ({
  identityRegistryAbi: [{ name: 'ownerOf' }, { name: 'tokenURI' }],
}))

import { readAgentOwner, readAgentURI } from '../read'
import type { ChainConfig } from '@/config/chains'

const chain: ChainConfig = {
  id: 42220,
  name: 'Celo',
  rpc: { http: 'https://forno.celo.org' },
  contracts: {
    identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  },
  explorer: 'https://celoscan.io',
  badge: { label: 'Celo', color: '#FCFF52' },
  backfillWindow: 50000,
  backfillChunkSize: 500,
  confirmations: 1,
  pollingInterval: 5000,
}

describe('readAgentOwner', () => {
  beforeEach(() => {
    mockReadContract.mockReset()
  })

  it('returns owner address on success', async () => {
    mockReadContract.mockResolvedValue('0xOwnerAddress')
    const result = await readAgentOwner(chain, 42)
    expect(result).toBe('0xOwnerAddress')
  })

  it('returns null when readContract throws', async () => {
    mockReadContract.mockRejectedValue(new Error('not found'))
    const result = await readAgentOwner(chain, 999)
    expect(result).toBeNull()
  })

  it('passes correct args to readContract', async () => {
    mockReadContract.mockResolvedValue('0xOwner')
    await readAgentOwner(chain, 7)
    expect(mockReadContract).toHaveBeenCalledWith({
      address: chain.contracts.identity,
      abi: expect.any(Array),
      functionName: 'ownerOf',
      args: [BigInt(7)],
    })
  })
})

describe('readAgentURI', () => {
  beforeEach(() => {
    mockReadContract.mockReset()
  })

  it('returns URI string on success', async () => {
    mockReadContract.mockResolvedValue('ipfs://QmTest123')
    const result = await readAgentURI(chain, 10)
    expect(result).toBe('ipfs://QmTest123')
  })

  it('returns null when readContract throws', async () => {
    mockReadContract.mockRejectedValue(new Error('no token'))
    const result = await readAgentURI(chain, 999)
    expect(result).toBeNull()
  })

  it('passes correct args to readContract', async () => {
    mockReadContract.mockResolvedValue('https://example.com/meta.json')
    await readAgentURI(chain, 15)
    expect(mockReadContract).toHaveBeenCalledWith({
      address: chain.contracts.identity,
      abi: expect.any(Array),
      functionName: 'tokenURI',
      args: [BigInt(15)],
    })
  })
})
