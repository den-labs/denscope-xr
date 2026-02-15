import type { DiscoverySignal } from '@/types/discovery'
import { ChainBadge } from '@/components/shared/ChainBadge'

const severityBorder = {
  info: 'border-l-accent',
  warning: 'border-l-warning',
  critical: 'border-l-critical',
}

const severityPill = {
  info: 'status-pill status-pill-accent',
  warning: 'status-pill status-pill-warning',
  critical: 'status-pill status-pill-critical',
}

export function SignalCard({ signal }: { signal: DiscoverySignal }) {
  return (
    <div
      className={`bg-surface border border-border border-l-2 p-4 ${severityBorder[signal.severity]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-sm text-text-primary">
            {signal.title}
          </h3>
          <span className="font-mono text-xs text-text-muted">
            {signal.kind} / {signal.agentIds[0] ?? '---'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={severityPill[signal.severity]}>
            {signal.severity}
          </span>
          <ChainBadge chainId={signal.chainId} />
        </div>
      </div>

      <p className="text-sm text-text-secondary mt-2">{signal.description}</p>

      <time className="font-mono text-[10px] text-text-muted uppercase mt-3 block">
        {new Date(signal.timestamp).toLocaleTimeString()}
      </time>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          className="text-xs border border-border px-3 py-1 text-text-secondary hover:text-text-primary hover:border-border-bright transition-colors"
        >
          Open Agent
        </button>
        <button
          type="button"
          className="text-xs border border-border px-3 py-1 text-text-secondary hover:text-text-primary hover:border-border-bright transition-colors"
        >
          Context Graph
        </button>
      </div>
    </div>
  )
}
