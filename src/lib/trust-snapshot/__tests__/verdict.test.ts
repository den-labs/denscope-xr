import { describe, expect, it } from 'vitest'
import { deriveVerdict } from '../verdict'

describe('deriveVerdict', () => {
  describe('safety override (N1)', () => {
    it('returns caution when critical incident exists, even with null score', () => {
      expect(
        deriveVerdict({ score: null, confidence: 'low', openCriticalIncidents: 1 })
      ).toBe('caution')
    })

    it('returns caution when critical incident exists, even with high score', () => {
      expect(
        deriveVerdict({ score: 95, confidence: 'high', openCriticalIncidents: 1 })
      ).toBe('caution')
    })

    it('returns caution for multiple critical incidents', () => {
      expect(
        deriveVerdict({ score: 80, confidence: 'high', openCriticalIncidents: 3 })
      ).toBe('caution')
    })
  })

  describe('insufficient-data', () => {
    it('returns insufficient-data when score is null and no critical incidents', () => {
      expect(
        deriveVerdict({ score: null, confidence: 'low', openCriticalIncidents: 0 })
      ).toBe('insufficient-data')
    })
  })

  describe('ready band (score >= 75)', () => {
    it('returns ready for score 75 + high confidence', () => {
      expect(
        deriveVerdict({ score: 75, confidence: 'high', openCriticalIncidents: 0 })
      ).toBe('ready')
    })

    it('returns ready for score 100 + high confidence', () => {
      expect(
        deriveVerdict({ score: 100, confidence: 'high', openCriticalIncidents: 0 })
      ).toBe('ready')
    })

    it('returns warming-up for score 80 + medium confidence', () => {
      expect(
        deriveVerdict({ score: 80, confidence: 'medium', openCriticalIncidents: 0 })
      ).toBe('warming-up')
    })

    it('returns warming-up for score 80 + low confidence', () => {
      expect(
        deriveVerdict({ score: 80, confidence: 'low', openCriticalIncidents: 0 })
      ).toBe('warming-up')
    })
  })

  describe('warming-up band (score 50-74) — P0-3 fix', () => {
    it('returns warming-up for score 50 + any confidence (low)', () => {
      expect(
        deriveVerdict({ score: 50, confidence: 'low', openCriticalIncidents: 0 })
      ).toBe('warming-up')
    })

    it('returns warming-up for score 60 + low confidence (the gap case)', () => {
      expect(
        deriveVerdict({ score: 60, confidence: 'low', openCriticalIncidents: 0 })
      ).toBe('warming-up')
    })

    it('returns warming-up for score 74 + medium confidence', () => {
      expect(
        deriveVerdict({ score: 74, confidence: 'medium', openCriticalIncidents: 0 })
      ).toBe('warming-up')
    })
  })

  describe('caution band (score < 50)', () => {
    it('returns caution for score 49', () => {
      expect(
        deriveVerdict({ score: 49, confidence: 'high', openCriticalIncidents: 0 })
      ).toBe('caution')
    })

    it('returns caution for score 0', () => {
      expect(
        deriveVerdict({ score: 0, confidence: 'low', openCriticalIncidents: 0 })
      ).toBe('caution')
    })
  })
})
