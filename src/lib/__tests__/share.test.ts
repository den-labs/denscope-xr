import { describe, it, expect } from 'vitest'
import {
  buildAgentPageUrl,
  buildXIntentUrl,
  buildCertificateShareText,
  buildOwnerShareText,
} from '../share'

describe('buildAgentPageUrl', () => {
  it('builds correct path with chain and agent id', () => {
    const url = buildAgentPageUrl(42220, 5)
    expect(url).toMatch(/\/agent\/42220\/5$/)
  })

  it('works with testnet chain id', () => {
    const url = buildAgentPageUrl(11142220, 126)
    expect(url).toMatch(/\/agent\/11142220\/126$/)
  })
})

describe('buildXIntentUrl', () => {
  it('encodes text as x.com intent URL', () => {
    const url = buildXIntentUrl('Hello World')
    expect(url).toBe('https://x.com/intent/post?text=Hello%20World')
  })

  it('encodes special characters', () => {
    const url = buildXIntentUrl('Test\nLine 2')
    expect(url).toContain('text=Test%0ALine%202')
  })
})

describe('buildCertificateShareText', () => {
  it('uses agent name and chain name when available', () => {
    const text = buildCertificateShareText({ chainId: 42220, agentId: 126, name: 'Esusu AI' })
    expect(text).toContain('Esusu AI')
    expect(text).toContain('@Celo')
    expect(text).toContain('Community Trust Snapshot')
    expect(text).toContain('/agent/42220/126')
    expect(text).toContain('@denlabs_app')
  })

  it('falls back to Agent #id when no name', () => {
    const text = buildCertificateShareText({ chainId: 42220, agentId: 5 })
    expect(text).toContain('Agent #5')
  })

  it('handles unknown chain gracefully', () => {
    const text = buildCertificateShareText({ chainId: 99999, agentId: 1 })
    expect(text).toContain('Chain 99999')
  })
})

describe('buildOwnerShareText', () => {
  it('includes owner-specific messaging', () => {
    const text = buildOwnerShareText({ chainId: 42220, agentId: 126, name: 'Esusu AI' })
    expect(text).toContain('I shipped my ERC-8004 agent')
    expect(text).toContain('Esusu AI')
    expect(text).toContain('Community Trust Snapshot + feedback signals')
    expect(text).toContain('/agent/42220/126')
  })

  it('falls back to Agent #id when no name', () => {
    const text = buildOwnerShareText({ chainId: 11142220, agentId: 3 })
    expect(text).toContain('Agent #3')
    expect(text).toContain('Celo Sepolia')
  })
})
