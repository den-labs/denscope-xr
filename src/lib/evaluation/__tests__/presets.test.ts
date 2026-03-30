import { describe, it, expect } from 'vitest'
import { getPreset, PRESETS, isValidPreset } from '@/lib/evaluation/presets'

describe('presets', () => {
  it('returns default_safety preset', () => {
    const preset = getPreset('default_safety')
    expect(preset.id).toBe('default_safety')
    expect(preset.minFeedbacks).toBe(3)
    expect(preset.trustBand.high).toBe(60)
  })

  it('returns agent_to_agent preset', () => {
    const preset = getPreset('agent_to_agent')
    expect(preset.id).toBe('agent_to_agent')
    expect(preset.minFeedbacks).toBe(5)
    expect(preset.sybilWeight).toBe('elevated')
  })

  it('returns defi_counterparty preset', () => {
    const preset = getPreset('defi_counterparty')
    expect(preset.id).toBe('defi_counterparty')
    expect(preset.minFeedbacks).toBe(10)
    expect(preset.incidentTolerance).toBe(0)
    expect(preset.trustBand.high).toBe(75)
  })

  it('defi_counterparty is stricter than default_safety', () => {
    const safe = getPreset('default_safety')
    const defi = getPreset('defi_counterparty')
    expect(defi.minFeedbacks).toBeGreaterThan(safe.minFeedbacks)
    expect(defi.allowThreshold).toBeGreaterThan(safe.allowThreshold)
    expect(defi.staleDays).toBeLessThan(safe.staleDays)
  })

  it('validates known preset IDs', () => {
    expect(isValidPreset('default_safety')).toBe(true)
    expect(isValidPreset('agent_to_agent')).toBe(true)
    expect(isValidPreset('defi_counterparty')).toBe(true)
    expect(isValidPreset('unknown')).toBe(false)
  })

  it('all presets have consistent threshold ordering', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(preset.trustBand.high).toBeGreaterThan(preset.trustBand.medium)
      expect(preset.trustBand.medium).toBeGreaterThan(preset.trustBand.low)
      expect(preset.allowThreshold).toBeGreaterThanOrEqual(preset.reviewThreshold)
    }
  })
})
