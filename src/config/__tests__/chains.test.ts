import { describe, it, expect } from 'vitest'
import { chains, getChain } from '../chains'

describe('chains', () => {
  it('has Celo Alfajores configured', () => {
    const chain = getChain(44787)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Celo Alfajores')
    expect(chain!.contracts.identity).toMatch(/^0x/)
    expect(chain!.contracts.reputation).toMatch(/^0x/)
  })

  it('has Celo Mainnet configured', () => {
    const chain = getChain(42220)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Celo')
  })

  it('returns undefined for unknown chain', () => {
    expect(getChain(99999)).toBeUndefined()
  })

  it('all chains have required fields', () => {
    for (const chain of chains) {
      expect(chain.backfillWindow).toBeGreaterThan(0)
      expect(chain.backfillChunkSize).toBeGreaterThan(0)
      expect(chain.confirmations).toBeGreaterThanOrEqual(0)
      expect(chain.pollingInterval).toBeGreaterThan(0)
    }
  })
})
