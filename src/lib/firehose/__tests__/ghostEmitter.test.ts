import { describe, expect, it } from 'vitest'
import { ghostPos, hashToUnit } from '@/lib/firehose/ghostEmitter'

describe('ghostEmitter', () => {
  it('returns deterministic output for same inputs', () => {
    const a = ghostPos(100, 200, '42220:0xabc', 1.25)
    const b = ghostPos(100, 200, '42220:0xabc', 1.25)
    expect(a).toEqual(b)
  })

  it('maps different seeds to different unit values', () => {
    const u1 = hashToUnit('42220:0xabc')
    const u2 = hashToUnit('42220:0xdef')
    expect(u1).not.toBe(u2)
    expect(u1).toBeGreaterThanOrEqual(0)
    expect(u1).toBeLessThan(1)
    expect(u2).toBeGreaterThanOrEqual(0)
    expect(u2).toBeLessThan(1)
  })
})
