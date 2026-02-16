import { describe, it, expect } from 'vitest'
import { wagmiConfig } from '@/config/wagmi'

describe('wagmiConfig', () => {
  it('has Celo and Celo Sepolia chains', () => {
    const chainIds = wagmiConfig.chains.map((c) => c.id)
    expect(chainIds).toContain(42220)
    expect(chainIds).toContain(11142220)
  })
})
