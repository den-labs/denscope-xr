import type { TrustSnapshotData } from '@/lib/trust-snapshot/types'
import { INTENT_CLASS, scoreColor, VERDICT_DISPLAY } from './display'

interface HeroBlockProps {
  snapshot: TrustSnapshotData
  agentName: string
  chainLabel: string
  agentId: number
  claimed: boolean
}

/**
 * Trust Snapshot hero — canonical score + verdict + one-line summary + CTA.
 * Server-renderable (no client state). Layout §5.1.
 */
export function HeroBlock({ snapshot, agentName, chainLabel, agentId, claimed }: HeroBlockProps) {
  const verdict = VERDICT_DISPLAY[snapshot.verdict]
  const { recommendedAction: cta } = snapshot

  return (
    <section className="space-y-4">
      {/* Identity strip */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-lg font-bold text-text-primary">{agentName}</h1>
        <span className="font-mono text-xs text-text-muted">#{agentId}</span>
        <span className="status-pill status-pill-neutral text-[10px]">{chainLabel}</span>
        {claimed && (
          <span className="status-pill status-pill-success text-[10px]">CLAIMED</span>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        {/* Big score */}
        <div className="flex items-end gap-2">
          <span className={`font-display text-6xl font-bold leading-none ${scoreColor(snapshot.score)}`}>
            {snapshot.score ?? '—'}
          </span>
          <span className="pb-2 font-mono text-xs text-text-muted">/ 100</span>
        </div>

        {/* Verdict + summary + CTA */}
        <div className="flex-1 space-y-2 border-l-0 sm:border-l sm:border-border sm:pl-4">
          <div className="flex items-center gap-2">
            <span className={`status-pill status-pill-${verdict.tone} text-xs font-semibold`}>
              {verdict.label}
            </span>
            <span className="font-mono text-[10px] uppercase text-text-muted">
              confidence: {snapshot.confidence}
            </span>
          </div>
          <p className="text-sm text-text-secondary">{snapshot.summary}</p>
          <a
            href={cta.href ?? '#evidence'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition ${INTENT_CLASS[cta.intent]}`}
          >
            <span aria-hidden>▶</span>
            {cta.label}
          </a>
        </div>
      </div>
    </section>
  )
}
