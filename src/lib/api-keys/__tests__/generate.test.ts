import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey, validateKeyFormat } from '@/lib/api-keys/generate'

describe('generateApiKey', () => {
  it('generates a key with ds_ prefix', () => {
    const key = generateApiKey()
    expect(key).toMatch(/^ds_[a-f0-9]{48}$/)
  })

  it('generates unique keys', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a).not.toBe(b)
  })
})

describe('hashApiKey', () => {
  it('returns a SHA-256 hex hash', async () => {
    const hash = await hashApiKey('ds_abc123')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await hashApiKey('ds_test')
    const b = await hashApiKey('ds_test')
    expect(a).toBe(b)
  })
})

describe('validateKeyFormat', () => {
  it('accepts valid keys', () => {
    expect(validateKeyFormat('ds_abcdef1234567890abcdef1234567890abcdef1234567890')).toBe(true)
  })

  it('rejects keys without prefix', () => {
    expect(validateKeyFormat('abcdef1234567890')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateKeyFormat('')).toBe(false)
  })
})
