import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerify = vi.fn()

vi.mock('siwe', () => {
  return {
    SiweMessage: class {
      address = '0xTestAddress'
      domain = 'denscope.vercel.app'
      verify = mockVerify
    },
  }
})

import { verifySiweMessage } from '../verify'

describe('verifySiweMessage', () => {
  beforeEach(() => {
    mockVerify.mockReset()
  })

  it('returns valid true with address on successful verify', async () => {
    mockVerify.mockResolvedValue({ success: true })

    const result = await verifySiweMessage('message', '0xsig')

    expect(result).toEqual({ valid: true, address: '0xTestAddress' })
  })

  it('returns valid false when verify result.success is false', async () => {
    mockVerify.mockResolvedValue({ success: false })

    const result = await verifySiweMessage('message', '0xsig')

    expect(result).toEqual({ valid: false, error: 'Signature verification failed' })
  })

  it('returns valid false with error message on exception', async () => {
    mockVerify.mockRejectedValue(new Error('Invalid signature format'))

    const result = await verifySiweMessage('message', '0xsig')

    expect(result).toEqual({ valid: false, error: 'Invalid signature format' })
  })
})
