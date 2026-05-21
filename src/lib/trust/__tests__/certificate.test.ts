import { describe, it, expect } from 'vitest'
import {
  normalizeCertificatePayload,
  canonicalize,
  generateCertificateHash,
  truncateHash,
  getAppBaseUrl,
  type CertificatePayload,
} from '../certificate'

const basePayload: CertificatePayload = {
  agentId: 1,
  chainId: 42220,
  chainName: 'celo',
  name: 'Test Agent',
  controller: '0xabcdef1234567890abcdef1234567890abcdef12',
  score: 87,
  state: 'trustworthy',
  signalCount: 42,
  positiveCount: 38,
  negativeCount: 4,
}

describe('normalizeCertificatePayload', () => {
  it('lowercases and trims chainName', () => {
    const result = normalizeCertificatePayload({ ...basePayload, chainName: '  Celo  ' })
    expect(result.chainName).toBe('celo')
  })

  it('lowercases and trims controller', () => {
    const result = normalizeCertificatePayload({
      ...basePayload,
      controller: '  0xABCDEF  ',
    })
    expect(result.controller).toBe('0xabcdef')
  })

  it('converts empty string name to null', () => {
    const result = normalizeCertificatePayload({ ...basePayload, name: '' })
    expect(result.name).toBeNull()
  })

  it('converts whitespace-only name to null', () => {
    const result = normalizeCertificatePayload({ ...basePayload, name: '   ' })
    expect(result.name).toBeNull()
  })

  it('converts empty string controller to null', () => {
    const result = normalizeCertificatePayload({ ...basePayload, controller: '' })
    expect(result.controller).toBeNull()
  })

  it('converts undefined name to null', () => {
    const result = normalizeCertificatePayload({ ...basePayload, name: undefined })
    expect(result.name).toBeNull()
  })

  it('converts undefined controller to null', () => {
    const result = normalizeCertificatePayload({ ...basePayload, controller: undefined })
    expect(result.controller).toBeNull()
  })

  it('trims name without lowercasing', () => {
    const result = normalizeCertificatePayload({ ...basePayload, name: '  My Agent  ' })
    expect(result.name).toBe('My Agent')
  })
})

describe('canonicalize', () => {
  it('returns a JSON array string', () => {
    const result = canonicalize(basePayload)
    const parsed = JSON.parse(result)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(10)
  })

  it('is deterministic — same input produces same output', () => {
    const a = canonicalize(basePayload)
    const b = canonicalize({ ...basePayload })
    expect(a).toBe(b)
  })

  it('different input produces different output', () => {
    const a = canonicalize(basePayload)
    const b = canonicalize({ ...basePayload, score: 50 })
    expect(a).not.toBe(b)
  })

  it('preserves null values', () => {
    const result = canonicalize({ ...basePayload, name: null, controller: null })
    const parsed = JSON.parse(result)
    expect(parsed[3]).toBeNull()
    expect(parsed[4]).toBeNull()
  })

  it('fields are in fixed positional order', () => {
    const result = canonicalize(basePayload)
    const parsed = JSON.parse(result)
    expect(parsed[0]).toBe(basePayload.agentId)
    expect(parsed[1]).toBe(basePayload.chainId)
    expect(parsed[2]).toBe(basePayload.chainName)
    expect(parsed[3]).toBe(basePayload.name)
    expect(parsed[4]).toBe(basePayload.controller)
    expect(parsed[5]).toBe(basePayload.score)
    expect(parsed[6]).toBe(basePayload.state)
    expect(parsed[7]).toBe(basePayload.signalCount)
    expect(parsed[8]).toBe(basePayload.positiveCount)
    expect(parsed[9]).toBe(basePayload.negativeCount)
  })
})

describe('generateCertificateHash', () => {
  it('returns a 64-char hex string', async () => {
    const hash = await generateCertificateHash(basePayload)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await generateCertificateHash(basePayload)
    const b = await generateCertificateHash({ ...basePayload })
    expect(a).toBe(b)
  })

  it('different payload produces different hash', async () => {
    const a = await generateCertificateHash(basePayload)
    const b = await generateCertificateHash({ ...basePayload, score: 10 })
    expect(a).not.toBe(b)
  })
})

describe('truncateHash', () => {
  it('returns first4...last4 for 64-char hash', () => {
    const hash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    expect(truncateHash(hash)).toBe('abcd...7890')
  })

  it('returns input unchanged if shorter than 8 chars', () => {
    expect(truncateHash('abc')).toBe('abc')
  })

  it('handles exactly 8 chars', () => {
    expect(truncateHash('abcd1234')).toBe('abcd...1234')
  })
})

describe('getAppBaseUrl', () => {
  it('prefers window.location.origin in browser context', () => {
    // jsdom test env exposes window.location.origin = http://localhost:3000
    expect(getAppBaseUrl()).toBe(window.location.origin)
  })
})

const evalPayload: CertificatePayload = {
  ...basePayload,
  trust_band: 'high',
  recommended_action: 'allow',
  risk_level: 'minimal',
  decision_confidence: 'high',
  preset: 'default_safety',
  flags: ['early_agent', 'low_activity'],
}

describe('certificate v2 — evaluation fields', () => {
  describe('generateCertificateHash', () => {
    it('produces a different hash when evaluation fields are present', async () => {
      const v1Hash = await generateCertificateHash(basePayload)
      const v2Hash = await generateCertificateHash(evalPayload)
      expect(v1Hash).not.toBe(v2Hash)
    })

    it('is deterministic with evaluation fields', async () => {
      const a = await generateCertificateHash(evalPayload)
      const b = await generateCertificateHash({ ...evalPayload })
      expect(a).toBe(b)
    })
  })

  describe('normalizeCertificatePayload', () => {
    it('sorts flags array', () => {
      const result = normalizeCertificatePayload({
        ...basePayload,
        flags: ['low_activity', 'early_agent'],
      })
      expect(result.flags).toEqual(['early_agent', 'low_activity'])
    })

    it('passes through trust_band, recommended_action, risk_level', () => {
      const result = normalizeCertificatePayload(evalPayload)
      expect(result.trust_band).toBe('high')
      expect(result.recommended_action).toBe('allow')
      expect(result.risk_level).toBe('minimal')
      expect(result.decision_confidence).toBe('high')
      expect(result.preset).toBe('default_safety')
    })

    it('omits evaluation fields when not provided', () => {
      const result = normalizeCertificatePayload(basePayload)
      expect(result.trust_band).toBeUndefined()
      expect(result.recommended_action).toBeUndefined()
      expect(result.risk_level).toBeUndefined()
      expect(result.flags).toBeUndefined()
    })
  })

  describe('canonicalize', () => {
    it('includes evaluation fields when present', () => {
      const result = canonicalize(evalPayload)
      const parsed = JSON.parse(result)
      expect(parsed.length).toBeGreaterThan(10)
      expect(parsed).toContain('high')
      expect(parsed).toContain('allow')
      expect(parsed).toContain('minimal')
    })

    it('excludes evaluation fields when absent (v1 compat)', () => {
      const result = canonicalize(basePayload)
      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(10)
    })
  })
})
