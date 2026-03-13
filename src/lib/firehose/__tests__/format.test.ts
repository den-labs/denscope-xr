import { describe, it, expect } from 'vitest'
import { formatShortAddr, formatTapeRow } from '../format'
import type { DenEvent } from '../types'

function makeEvent(overrides: Partial<DenEvent> = {}): DenEvent {
  return {
    id: 'test-1',
    ts: 1000,
    chainId: 42220,
    kind: 'feedback',
    sourceId: '42220:0xabcdef1234567890abcdef1234567890abcdef12',
    targetId: '42220:7',
    value: 0,
    ...overrides,
  }
}

describe('formatShortAddr', () => {
  it('returns short address as-is', () => {
    expect(formatShortAddr('0x123')).toBe('0x123')
  })

  it('returns address of exactly 10 chars as-is', () => {
    expect(formatShortAddr('0x12345678')).toBe('0x12345678')
  })

  it('truncates long address', () => {
    const addr = '0xabcdef1234567890abcdef1234567890abcdef12'
    expect(formatShortAddr(addr)).toBe('0xabc...f12')
  })
})

describe('formatTapeRow', () => {
  it('formats positive value with + prefix', () => {
    const row = formatTapeRow(makeEvent({ value: 1.5 }))
    expect(row).toMatch(/^\+ FEEDBACK/)
    expect(row).toContain('v=+1.50')
  })

  it('formats negative value with - prefix', () => {
    const row = formatTapeRow(makeEvent({ value: -0.75 }))
    expect(row).toMatch(/^- FEEDBACK/)
    expect(row).toContain('v=-0.75')
  })

  it('formats zero value with space prefix', () => {
    const row = formatTapeRow(makeEvent({ value: 0 }))
    expect(row).toMatch(/^ {2}FEEDBACK/)
    expect(row).toContain('v=0')
  })

  it('parses chainId-prefixed source and numeric target', () => {
    const row = formatTapeRow(makeEvent({
      sourceId: '42220:0xabcdef1234567890abcdef1234567890abcdef12',
      targetId: '42220:42',
      value: 1,
    }))
    expect(row).toContain('0xabc...f12')
    expect(row).toContain('-> #42')
  })

  it('uses raw targetId when not numeric after prefix', () => {
    const row = formatTapeRow(makeEvent({
      targetId: '42220:not-a-number',
      value: 1,
    }))
    expect(row).toContain('-> 42220:not-a-number')
  })
})
