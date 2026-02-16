import { describe, it, expect } from 'vitest'
import { createSiweMessage, generateNonce } from '@/lib/auth/siwe'

const CHECKSUM_ADDRESS = '0x1234567890AbcdEF1234567890aBcdef12345678'

describe('createSiweMessage', () => {
  it('creates a valid SIWE message string', () => {
    const message = createSiweMessage({
      address: CHECKSUM_ADDRESS,
      chainId: 42220,
      nonce: 'abc123def456',
      statement: 'Claim agent ownership on DenScope',
    })
    expect(message).toContain(CHECKSUM_ADDRESS)
    expect(message).toContain('abc123def456')
    expect(message).toContain('Claim agent ownership on DenScope')
  })

  it('includes the domain and URI', () => {
    const message = createSiweMessage({
      address: CHECKSUM_ADDRESS,
      chainId: 42220,
      nonce: 'testnonce123',
    })
    expect(message).toContain('denscope.vercel.app')
  })
})

describe('generateNonce', () => {
  it('generates a 32-char hex string', () => {
    const nonce = generateNonce()
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
  })

  it('generates unique nonces', () => {
    const a = generateNonce()
    const b = generateNonce()
    expect(a).not.toBe(b)
  })
})
