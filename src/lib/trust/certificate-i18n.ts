import type { ShareCardStateKey } from './share-card-state'

export type CertificateLang = 'en' | 'es'

export type CertificateLabels = {
  title: string
  trustScore: string
  signals: string
  controller: string
  verify: string
  unnamedAgent: string
  noController: string
  stateLabels: Record<ShareCardStateKey, string>
  /** For insufficient_signal seal: [line1, line2] */
  insufficientSealLines: [string, string]
}

const en: CertificateLabels = {
  title: 'DenScope Agent Trust Certificate',
  trustScore: 'Trust Score',
  signals: 'Signals',
  controller: 'Controller',
  verify: 'verify',
  unnamedAgent: 'Unnamed Agent',
  noController: 'No Controller',
  stateLabels: {
    trustworthy: 'TRUSTWORTHY',
    monitoring: 'MONITORING',
    high_risk: 'HIGH RISK',
    insufficient_signal: 'INSUFFICIENT DATA',
  },
  insufficientSealLines: ['INSUFFICIENT', 'DATA'],
}

const es: CertificateLabels = {
  title: 'Certificado de Confianza del Agente DenScope',
  trustScore: 'Puntaje de Confianza',
  signals: 'Señales',
  controller: 'Controlador',
  verify: 'verificar',
  unnamedAgent: 'Agente sin nombre',
  noController: 'Sin Controlador',
  stateLabels: {
    trustworthy: 'CONFIABLE',
    monitoring: 'EN OBSERVACIÓN',
    high_risk: 'ALTO RIESGO',
    insufficient_signal: 'DATOS INSUFICIENTES',
  },
  insufficientSealLines: ['DATOS', 'INSUFICIENTES'],
}

const labelMaps: Record<CertificateLang, CertificateLabels> = { en, es }

export function getCertificateLabels(lang: CertificateLang): CertificateLabels {
  return labelMaps[lang] ?? labelMaps.en
}
