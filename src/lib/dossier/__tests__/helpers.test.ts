import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getAgentStatus,
  formatRelativeTime,
  getSybilRisk,
  summarizeActivity,
} from '@/lib/dossier/helpers'

describe('getAgentStatus', () => {
  it('returns NEW/neutral for null score', () => {
    const result = getAgentStatus(null)
    expect(result).toEqual({ label: 'NEW', variant: 'neutral' })
  })

  it('returns HEALTHY/success for score 75', () => {
    const result = getAgentStatus(75)
    expect(result).toEqual({ label: 'HEALTHY', variant: 'success' })
  })

  it('returns WARNING/warning for score 45', () => {
    const result = getAgentStatus(45)
    expect(result).toEqual({ label: 'WARNING', variant: 'warning' })
  })

  it('returns CRITICAL/critical for score 15', () => {
    const result = getAgentStatus(15)
    expect(result).toEqual({ label: 'CRITICAL', variant: 'critical' })
  })

  it('returns HEALTHY at boundary score 60', () => {
    const result = getAgentStatus(60)
    expect(result.label).toBe('HEALTHY')
  })

  it('returns WARNING at boundary score 30', () => {
    const result = getAgentStatus(30)
    expect(result.label).toBe('WARNING')
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns em dash for null', () => {
    expect(formatRelativeTime(null)).toBe('\u2014')
  })

  it('returns "just now" for less than 1 minute ago', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    const thirtySecondsAgo = new Date('2026-02-16T11:59:30Z').toISOString()
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now')
  })

  it('returns "15m ago" for 15 minutes ago', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    const fifteenMinAgo = new Date('2026-02-16T11:45:00Z').toISOString()
    expect(formatRelativeTime(fifteenMinAgo)).toBe('15m ago')
  })

  it('returns "3h ago" for 3 hours ago', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    const threeHoursAgo = new Date('2026-02-16T09:00:00Z').toISOString()
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago')
  })

  it('returns "3d ago" for 3 days ago', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    const threeDaysAgo = new Date('2026-02-13T12:00:00Z').toISOString()
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
  })
})

describe('getSybilRisk', () => {
  it('returns LOW/success when no sybil incidents', () => {
    const result = getSybilRisk({ openSybil: 0, resolvedSybil: 0 })
    expect(result).toEqual({ level: 'LOW', variant: 'success' })
  })

  it('returns HIGH/critical when open sybil incidents exist', () => {
    const result = getSybilRisk({ openSybil: 2, resolvedSybil: 0 })
    expect(result).toEqual({ level: 'HIGH', variant: 'critical' })
  })

  it('returns MEDIUM/warning when only resolved sybil incidents', () => {
    const result = getSybilRisk({ openSybil: 0, resolvedSybil: 3 })
    expect(result).toEqual({ level: 'MEDIUM', variant: 'warning' })
  })
})

describe('summarizeActivity', () => {
  it('includes "Registered" for an agent with firstSeen', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    const result = summarizeActivity({
      firstSeen: '2026-02-10T12:00:00Z',
      uriUpdateCount: 0,
      feedbackCount: 0,
      avgFeedback: 0,
      totalEvents: 5,
    })
    expect(result.some((s) => s.includes('Registered'))).toBe(true)
    vi.useRealTimers()
  })

  it('includes "feedback" when feedbackCount > 0', () => {
    const result = summarizeActivity({
      firstSeen: '2026-02-10T12:00:00Z',
      uriUpdateCount: 0,
      feedbackCount: 8,
      avgFeedback: 3.5,
      totalEvents: 10,
    })
    expect(result.some((s) => s.includes('feedback'))).toBe(true)
  })

  it('includes "URI updated" when uriUpdateCount > 0', () => {
    const result = summarizeActivity({
      firstSeen: '2026-02-10T12:00:00Z',
      uriUpdateCount: 3,
      feedbackCount: 0,
      avgFeedback: 0,
      totalEvents: 5,
    })
    expect(result.some((s) => s.includes('URI updated'))).toBe(true)
  })

  it('includes "Awaiting" when no activity', () => {
    const result = summarizeActivity({
      firstSeen: null,
      uriUpdateCount: 0,
      feedbackCount: 0,
      avgFeedback: 0,
      totalEvents: 1,
    })
    expect(result.some((s) => s.includes('Awaiting'))).toBe(true)
  })
})
