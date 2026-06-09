import type { TrustSnapshotData } from '@/lib/trust-snapshot/types'
import { INTENT_CLASS, scoreColor, VERDICT_DISPLAY } from './display'

interface MobileStickyHeaderProps {
  snapshot: TrustSnapshotData
  agentName: string
  agentId: number
}

/**
 * Mobile-only sticky header keeping Score + Verdict + CTA in view while
 * scrolling. Never duplicates Share (P1-6). For `insufficient-data` the CTA row
 * is hidden — only score + verdict show (N8).
 */
export function MobileStickyHeader({ snapshot, agentName, agentId }: MobileStickyHeaderProps) {
  const verdict = VERDICT_DISPLAY[snapshot.verdict]
  const cta = snapshot.recommendedAction
  const showCta = snapshot.verdict !== 'insufficient-data'

  return (
    <div className="sticky top-0 z-20 space-y-1.5 border-b border-border bg-background/95 p-3 backdrop-blur sm:hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-text-primary">
          {agentName} <span className="font-mono text-xs text-text-muted">#{agentId}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className={`font-display text-lg font-bold ${scoreColor(snapshot.score)}`}>
            {snapshot.score ?? '—'}
          </span>
          <span className={`status-pill status-pill-${verdict.tone} text-[10px]`}>{verdict.label}</span>
        </div>
      </div>

      {showCta && (
        <a
          href={cta.href ?? '#evidence'}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium transition ${INTENT_CLASS[cta.intent]}`}
        >
          <span aria-hidden>▶</span>
          {cta.label}
        </a>
      )}
    </div>
  )
}
