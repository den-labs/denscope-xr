import { describe, it, expect } from 'vitest'
import { resolveClientIp, UNRESOLVED_IP } from '../client-ip'

describe('resolveClientIp', () => {
  it('prefers x-vercel-forwarded-for, which survives a proxy on top of Vercel', () => {
    const headers = new Headers({
      'x-vercel-forwarded-for': '203.0.113.10',
      'x-real-ip': '198.51.100.5',
      'x-forwarded-for': '192.0.2.1',
    })
    expect(resolveClientIp(headers)).toEqual({
      ip: '203.0.113.10',
      source: 'x-vercel-forwarded-for',
    })
  })

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '198.51.100.5', 'x-forwarded-for': '192.0.2.1' })
    expect(resolveClientIp(headers)).toEqual({ ip: '198.51.100.5', source: 'x-real-ip' })
  })

  it('falls back to x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': '192.0.2.1' })
    expect(resolveClientIp(headers)).toEqual({ ip: '192.0.2.1', source: 'x-forwarded-for' })
  })

  it('takes the first entry of a comma list and trims it', () => {
    // Vercel overwrites this header with a single public IP, so a list only
    // appears if something upstream changed. First entry stays correct because
    // no untrusted hop is prepended.
    const headers = new Headers({ 'x-forwarded-for': ' 192.0.2.1 , 10.0.0.1 ' })
    expect(resolveClientIp(headers).ip).toBe('192.0.2.1')
  })

  it('buckets an unidentifiable caller rather than exempting them', () => {
    const result = resolveClientIp(new Headers())
    expect(result).toEqual({ ip: UNRESOLVED_IP, source: 'unresolved' })
  })

  it('treats an empty header as unresolved', () => {
    const result = resolveClientIp(new Headers({ 'x-forwarded-for': '   ' }))
    expect(result.source).toBe('unresolved')
  })

  it('reports the answering header so a proxy misconfiguration is observable', () => {
    // The x402Seek facilitator shipped SR-01 -- every visitor sharing one
    // bucket behind a proxy. `source` is what makes that visible here.
    expect(resolveClientIp(new Headers({ 'x-real-ip': '1.1.1.1' })).source).toBe('x-real-ip')
  })
})
