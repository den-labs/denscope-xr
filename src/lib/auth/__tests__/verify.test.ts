import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerify = vi.fn()

vi.mock('siwe', () => {
  return {
    SiweMessage: class {
      address = '0xTestAddress'
      domain = 'www.denscope.xyz'
      verify = mockVerify
    },
  }
})

import { verifySiweMessage } from '../verify'

describe('verifySiweMessage', () => {
  beforeEach(() => {
    mockVerify.mockReset()
  })

  it('returns valid true with address when domain matches and verify succeeds', async () => {
    mockVerify.mockResolvedValue({ success: true })

    const result = await verifySiweMessage('message', '0xsig', 'www.denscope.xyz')

    expect(result).toEqual({ valid: true, address: '0xTestAddress' })
    expect(mockVerify).toHaveBeenCalledWith({ signature: '0xsig', domain: 'www.denscope.xyz' })
  })

  it('rejects when the message domain does not match the expected (request) domain', async () => {
    const result = await verifySiweMessage('message', '0xsig', 'evil.example.com')

    expect(result).toEqual({ valid: false, error: 'Domain mismatch' })
    expect(mockVerify).not.toHaveBeenCalled()
  })

  it('returns valid false when verify result.success is false', async () => {
    mockVerify.mockResolvedValue({ success: false })

    const result = await verifySiweMessage('message', '0xsig', 'www.denscope.xyz')

    expect(result).toEqual({ valid: false, error: 'Signature verification failed' })
  })

  it('returns valid false with error message on exception', async () => {
    mockVerify.mockRejectedValue(new Error('Invalid signature format'))

    const result = await verifySiweMessage('message', '0xsig', 'www.denscope.xyz')

    expect(result).toEqual({ valid: false, error: 'Invalid signature format' })
  })
})
