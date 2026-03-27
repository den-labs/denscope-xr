import { describe, it, expect } from 'vitest'
import { chains, getChain } from '../chains'

describe('chains', () => {
  it('has Celo Mainnet configured', () => {
    const chain = getChain(42220)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Celo')
    expect(chain!.contracts.identity).toMatch(/^0x/)
    expect(chain!.contracts.reputation).toMatch(/^0x/)
  })

  it('has Celo Sepolia configured', () => {
    const chain = getChain(11142220)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Celo Sepolia')
    expect(chain!.contracts.identity).toMatch(/^0x/)
    expect(chain!.contracts.reputation).toMatch(/^0x/)
  })

  it('has SKALE Base configured', () => {
    const chain = getChain(1187947933)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('SKALE Base')
    expect(chain!.contracts.identity).toMatch(/^0x/)
    expect(chain!.contracts.reputation).toMatch(/^0x/)
    expect(chain!.badge.label).toBe('SKALE Base')
    expect(chain!.badge.color).toBe('#4FC3F7')
    expect(chain!.backfillWindow).toBe(2000)
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
