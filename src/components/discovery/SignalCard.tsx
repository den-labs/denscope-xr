import Link from 'next/link'
import type { DiscoverySignal } from '@/types/discovery'
import { ChainBadge } from '@/components/shared/ChainBadge'

const severityBorder = {
  info: 'border-l-accent',
  warning: 'border-l-warning',
  critical: 'border-l-danger',
}

const severityPill = {
  info: 'status-pill status-pill-accent',
  warning: 'status-pill status-pill-warning',
  critical: 'status-pill status-pill-critical',
}

export function SignalCard({ signal }: { signal: DiscoverySignal }) {
  return (
    <div
      className={`bg-surface border border-border border-l-2 p-4 shadow-sm dark:shadow-none ${severityBorder[signal.severity]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-sm text-foreground">
            {signal.title}
          </h3>
          <span className="font-mono text-xs text-foreground-muted">
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

      <p className="text-sm text-foreground-secondary mt-2">{signal.description}</p>

      <time className="font-mono text-[11px] text-foreground-muted uppercase mt-3 block">
        {new Date(signal.timestamp).toLocaleTimeString()}
      </time>

      {signal.agentIds[0] != null && (
        <div className="mt-3">
          <Link
            href={`/agent/${signal.chainId}/${signal.agentIds[0]}`}
            className="text-xs border border-border px-3 py-1 text-foreground-secondary hover:text-foreground hover:border-border-bright transition-colors"
          >
            Open Agent
          </Link>
        </div>
      )}
    </div>
  )
}
