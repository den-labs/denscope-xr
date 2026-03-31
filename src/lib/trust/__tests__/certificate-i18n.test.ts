import { describe, it, expect } from 'vitest'
import { getCertificateLabels } from '../certificate-i18n'

describe('getCertificateLabels', () => {
  it('returns EN labels by default', () => {
    const labels = getCertificateLabels('en')
    expect(labels.title).toBe('DenScope Agent Trust Certificate')
  })

  it('returns ES labels', () => {
    const labels = getCertificateLabels('es')
    expect(labels.title).toBe('Certificado de Confianza del Agente DenScope')
  })

  it('EN and ES have the same keys', () => {
    const en = getCertificateLabels('en')
    const es = getCertificateLabels('es')
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('EN and ES stateLabels have the same keys', () => {
    const en = getCertificateLabels('en')
    const es = getCertificateLabels('es')
    expect(Object.keys(en.stateLabels).sort()).toEqual(
      Object.keys(es.stateLabels).sort(),
    )
  })

  it('insufficientSealLines has exactly 2 lines', () => {
    const en = getCertificateLabels('en')
    const es = getCertificateLabels('es')
    expect(en.insufficientSealLines).toHaveLength(2)
    expect(es.insufficientSealLines).toHaveLength(2)
  })

  it('ES signals label has correct accent', () => {
    const es = getCertificateLabels('es')
    expect(es.signals).toBe('Señales')
  })

  it('ES monitoring label has correct accent', () => {
    const es = getCertificateLabels('es')
    expect(es.stateLabels.monitoring).toBe('EN OBSERVACIÓN')
  })

  it('EN trust band labels exist for all 4 bands', () => {
    const en = getCertificateLabels('en')
    expect(Object.keys(en.trustBandLabels).sort()).toEqual(
      ['high', 'insufficient_signal', 'low', 'medium'],
    )
  })

  it('ES trust band labels exist for all 4 bands', () => {
    const es = getCertificateLabels('es')
    expect(Object.keys(es.trustBandLabels).sort()).toEqual(
      ['high', 'insufficient_signal', 'low', 'medium'],
    )
  })

  it('EN action labels exist for all 3 actions', () => {
    const en = getCertificateLabels('en')
    expect(Object.keys(en.actionLabels).sort()).toEqual(['allow', 'limit', 'review'])
  })

  it('ES action labels exist for all 3 actions', () => {
    const es = getCertificateLabels('es')
    expect(Object.keys(es.actionLabels).sort()).toEqual(['allow', 'limit', 'review'])
  })

  it('EN risk labels exist for all 4 levels', () => {
    const en = getCertificateLabels('en')
    expect(Object.keys(en.riskLabels).sort()).toEqual(
      ['critical', 'elevated', 'minimal', 'moderate'],
    )
  })

  it('ES risk labels exist for all 4 levels', () => {
    const es = getCertificateLabels('es')
    expect(Object.keys(es.riskLabels).sort()).toEqual(
      ['critical', 'elevated', 'minimal', 'moderate'],
    )
  })

  it('EN and ES trustBandLabels have the same keys', () => {
    const en = getCertificateLabels('en')
    const es = getCertificateLabels('es')
    expect(Object.keys(en.trustBandLabels).sort()).toEqual(
      Object.keys(es.trustBandLabels).sort(),
    )
  })

  it('EN and ES actionLabels have the same keys', () => {
    const en = getCertificateLabels('en')
    const es = getCertificateLabels('es')
    expect(Object.keys(en.actionLabels).sort()).toEqual(
      Object.keys(es.actionLabels).sort(),
    )
  })

  it('EN and ES riskLabels have the same keys', () => {
    const en = getCertificateLabels('en')
    const es = getCertificateLabels('es')
    expect(Object.keys(en.riskLabels).sort()).toEqual(
      Object.keys(es.riskLabels).sort(),
    )
  })
})
