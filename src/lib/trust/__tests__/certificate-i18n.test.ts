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
})
