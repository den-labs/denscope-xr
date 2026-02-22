import type { TrustScore } from '@/types/trust-score'

export type ShareCardStateKey =
  | 'insufficient_signal'
  | 'monitoring'
  | 'trustworthy'
  | 'high_risk'

export type ShareCardState = {
  key: ShareCardStateKey
  label: string
  accentColor: string
  accentSoft: string
  evidenceLine: string
}

function formatFeedbackEvidence(feedbackCount: number): string {
  return `Basado en ${feedbackCount} feedbacks ERC-8004`
}

export function getShareCardState(score: TrustScore | null): ShareCardState {
  if (!score || score.feedbackCount < 5) {
    return {
      key: 'insufficient_signal',
      label: 'Sin suficiente señal',
      accentColor: '#6B7280',
      accentSoft: 'rgba(107, 114, 128, 0.22)',
      evidenceLine: 'Aún no hay suficiente feedback ERC-8004',
    }
  }

  const positivePct = score.positiveRatio * 100

  if (
    score.feedbackCount >= 15
    && positivePct <= 35
    && (score.confidence === 'medium' || score.confidence === 'high')
  ) {
    return {
      key: 'high_risk',
      label: 'Alto riesgo',
      accentColor: '#EF4444',
      accentSoft: 'rgba(239, 68, 68, 0.20)',
      evidenceLine: formatFeedbackEvidence(score.feedbackCount),
    }
  }

  if (
    score.feedbackCount >= 15
    && positivePct >= 70
    && (score.confidence === 'medium' || score.confidence === 'high')
  ) {
    return {
      key: 'trustworthy',
      label: 'Confiable',
      accentColor: '#22C55E',
      accentSoft: 'rgba(34, 197, 94, 0.20)',
      evidenceLine: formatFeedbackEvidence(score.feedbackCount),
    }
  }

  return {
    key: 'monitoring',
    label: 'En observación',
    accentColor: '#F59E0B',
    accentSoft: 'rgba(245, 158, 11, 0.20)',
    evidenceLine: formatFeedbackEvidence(score.feedbackCount),
  }
}

