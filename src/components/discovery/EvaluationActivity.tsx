import Link from 'next/link'
import type { EvaluationLogEntry } from '@/lib/trustops/collect'

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function EvaluationActivity({ evaluations }: { evaluations: EvaluationLogEntry[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
        Recent Evaluations
      </h2>

      {evaluations.length === 0 ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted font-mono">No evaluations yet</p>
          <p className="text-xs text-text-muted mt-1">
            Evaluations appear when consumers call POST /api/v1/trust/evaluate
          </p>
        </div>
      ) : (
        <div className="border border-border bg-surface divide-y divide-border">
          {evaluations.map((entry, i) => (
            <div key={`${entry.chainId}-${entry.agentId}-${i}`} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                <Link
                  href={`/agent/${entry.chainId}/${entry.agentId}`}
                  className="text-sm font-mono text-text-primary hover:text-accent transition-colors truncate"
                >
                  Agent #{entry.agentId}
                </Link>
                <span className="text-[10px] font-mono text-text-muted shrink-0">
                  Chain {entry.chainId}
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted shrink-0 ml-4">
                {timeAgo(entry.calledAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
