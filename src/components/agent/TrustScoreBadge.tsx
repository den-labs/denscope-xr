import type { TrustScore } from '@/types/trust-score'

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 50) return 'text-accent'
  if (score >= 25) return 'text-warning'
  return 'text-critical'
}

function confidencePill(confidence: string): string {
  switch (confidence) {
    case 'high': return 'status-pill-success'
    case 'medium': return 'status-pill-accent'
    default: return 'status-pill-neutral'
  }
}

export function TrustScoreBadge({ score }: { score: TrustScore }) {
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <span className={`font-display text-5xl font-bold ${scoreColor(score.score)}`}>
          {score.score}
        </span>
        <div className="pb-1 space-y-1">
          <span className="text-xs text-text-muted font-mono">/ 100</span>
          <span className={`status-pill ${confidencePill(score.confidence)} text-[10px] block`}>
            {score.confidence.toUpperCase()} CONFIDENCE
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <BreakdownRow label="Positive Ratio" value={score.positiveRatio} weight={0.40} />
        <BreakdownRow label="Age" value={score.ageScore} weight={0.20} />
        <BreakdownRow label="Activity" value={score.activityScore} weight={0.20} />
        {score.incidentPenalty > 0 && (
          <BreakdownRow label="Incident Penalty" value={-score.incidentPenalty} weight={0.10} negative />
        )}
      </div>

      <div className="flex gap-4 text-[10px] text-text-muted font-mono pt-1 border-t border-border">
        <span>{score.feedbackCount} feedbacks</span>
        <span>{score.positiveCount} positive</span>
        <span>{score.negativeCount} negative</span>
        {score.openIncidents > 0 && (
          <span className="text-warning">{score.openIncidents} open incidents</span>
        )}
      </div>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  weight,
  negative,
}: {
  label: string
  value: number
  weight: number
  negative?: boolean
}) {
  const barWidth = Math.abs(value) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-muted font-mono w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-background border border-border relative">
        <div
          className={`h-full ${negative ? 'bg-critical' : 'bg-accent'}`}
          style={{ width: `${Math.min(barWidth, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-secondary w-16 text-right">
        {negative ? '-' : ''}{(Math.abs(value) * weight * 100).toFixed(1)}pts
      </span>
    </div>
  )
}
