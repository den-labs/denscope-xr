import type { ShareCardStateKey } from './share-card-state'
import type { TrustBand, RecommendedAction, RiskLevel, DecisionConfidence, PresetId } from '@/types/evaluation'

export type CertificatePayload = {
  agentId: number
  chainId: number
  chainName: string
  name: string | null
  controller: string | null
  score: number
  state: ShareCardStateKey
  signalCount: number
  positiveCount: number
  negativeCount: number
  // v2 evaluation fields (optional for backward compat)
  trust_band?: TrustBand
  recommended_action?: RecommendedAction
  risk_level?: RiskLevel
  decision_confidence?: DecisionConfidence
  preset?: PresetId
  flags?: string[]
}

export type CertificatePalette = {
  titleBar: string
  sealFill: string
  sealBorder: string
  sealDashed: boolean
}

export const certificatePalettes: Record<ShareCardStateKey, CertificatePalette> = {
  trustworthy: {
    titleBar: '#065F46',
    sealFill: '#059669',
    sealBorder: '#D4AF37',
    sealDashed: false,
  },
  monitoring: {
    titleBar: '#9A3412',
    sealFill: '#EA580C',
    sealBorder: '#F59E0B',
    sealDashed: false,
  },
  high_risk: {
    titleBar: '#991B1B',
    sealFill: '#DC2626',
    sealBorder: '#7F1D1D',
    sealDashed: false,
  },
  insufficient_signal: {
    titleBar: '#374151',
    sealFill: 'transparent',
    sealBorder: '#6B7280',
    sealDashed: true,
  },
}

/** Normalize string fields for deterministic hashing */
export function normalizeCertificatePayload(raw: {
  agentId: number
  chainId: number
  chainName: string
  name: string | null | undefined
  controller: string | null | undefined
  score: number
  state: ShareCardStateKey
  signalCount: number
  positiveCount: number
  negativeCount: number
  trust_band?: TrustBand
  recommended_action?: RecommendedAction
  risk_level?: RiskLevel
  decision_confidence?: DecisionConfidence
  preset?: PresetId
  flags?: string[]
}): CertificatePayload {
  const normString = (v: string | null | undefined): string | null => {
    if (v == null) return null
    const trimmed = v.trim()
    return trimmed === '' ? null : trimmed
  }

  const result: CertificatePayload = {
    agentId: raw.agentId,
    chainId: raw.chainId,
    chainName: raw.chainName.toLowerCase().trim(),
    name: normString(raw.name),
    controller: normString(raw.controller)?.toLowerCase() ?? null,
    score: raw.score,
    state: raw.state,
    signalCount: raw.signalCount,
    positiveCount: raw.positiveCount,
    negativeCount: raw.negativeCount,
  }

  // v2 evaluation fields — only include when present
  if (raw.trust_band !== undefined) result.trust_band = raw.trust_band
  if (raw.recommended_action !== undefined) result.recommended_action = raw.recommended_action
  if (raw.risk_level !== undefined) result.risk_level = raw.risk_level
  if (raw.decision_confidence !== undefined) result.decision_confidence = raw.decision_confidence
  if (raw.preset !== undefined) result.preset = raw.preset
  if (raw.flags !== undefined) result.flags = [...raw.flags].sort()

  return result
}

/** Fixed-order JSON array for deterministic hashing */
export function canonicalize(p: CertificatePayload): string {
  const base: unknown[] = [
    p.agentId,
    p.chainId,
    p.chainName,
    p.name,
    p.controller,
    p.score,
    p.state,
    p.signalCount,
    p.positiveCount,
    p.negativeCount,
  ]

  // v2 evaluation fields — appended only when present so v1 hashes stay stable
  if (p.trust_band !== undefined) base.push(p.trust_band)
  if (p.recommended_action !== undefined) base.push(p.recommended_action)
  if (p.risk_level !== undefined) base.push(p.risk_level)
  if (p.decision_confidence !== undefined) base.push(p.decision_confidence)
  if (p.preset !== undefined) base.push(p.preset)
  if (p.flags !== undefined) base.push(p.flags)

  return JSON.stringify(base)
}

/** SHA-256 hash of canonicalized payload, returned as 64-char hex */
export async function generateCertificateHash(
  payload: CertificatePayload,
): Promise<string> {
  const canonical = canonicalize(payload)
  const data = new TextEncoder().encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Truncate 64-char hash to display format: first4...last4 */
export function truncateHash(hash: string): string {
  if (hash.length < 8) return hash
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`
}

/** Get base URL from env, never hardcode domain */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://denscope.vercel.app'
}
