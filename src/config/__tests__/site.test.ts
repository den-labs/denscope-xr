import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { siteHost, siteUrl } from '../site'

describe('siteUrl', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL
  })

  it('throws when NEXT_PUBLIC_APP_URL is missing', () => {
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('throws when NEXT_PUBLIC_APP_URL is empty string', () => {
    process.env.NEXT_PUBLIC_APP_URL = ''
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('returns the env value unchanged when no trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.denscope.xyz'
    expect(siteUrl()).toBe('https://www.denscope.xyz')
  })

  it('strips trailing slash from env value', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.denscope.xyz/'
    expect(siteUrl()).toBe('https://www.denscope.xyz')
  })
})

describe('siteHost', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL
  })

  it('extracts host from URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.denscope.xyz'
    expect(siteHost()).toBe('www.denscope.xyz')
  })

  it('extracts host including subdomain', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.denscope.xyz'
    expect(siteHost()).toBe('staging.denscope.xyz')
  })
})
