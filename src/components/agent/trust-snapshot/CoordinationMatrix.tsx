import type {
  BadgeKey,
  BadgeState,
  CoordinationMatrix as Matrix,
} from '@/lib/trust-snapshot/types'
import { BADGE_LABEL } from './display'

interface CoordinationMatrixProps {
  coordination: Matrix
}

// Display order per wireframe §5.1: derivable first, then PENDING conventions.
const BADGE_ORDER: BadgeKey[] = ['a2a', 'mcp', 'x402', 'docs', 'health', 'oasf', 'source', 'auth']

interface BadgeStyle {
  symbol: string
  className: string
  tooltip: string
}

function styleFor(state: BadgeState): BadgeStyle {
  switch (state.state) {
    case 'connected':
      return { symbol: '✓', className: 'border-success text-success', tooltip: state.evidence }
    case 'detected':
      return { symbol: '•', className: 'border-accent text-accent', tooltip: state.evidence }
    case 'missing':
      return { symbol: '—', className: 'border-border text-text-muted', tooltip: 'Not detected' }
    case 'unknown':
      // Solid muted (agent-specific, fixable as activity accrues).
      return { symbol: '?', className: 'border-border bg-background text-text-muted', tooltip: state.reason }
    case 'pending':
      // Dashed-border muted (schema-level, fixable only when a convention ships).
      return { symbol: '?', className: 'border-dashed border-border text-text-muted', tooltip: state.reason }
  }
}

export function CoordinationMatrix({ coordination }: CoordinationMatrixProps) {
  return (
    <section id="coordination" className="space-y-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
        Coordination readiness
      </h2>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BADGE_ORDER.map((key) => {
          const style = styleFor(coordination[key])
          return (
            <li
              key={key}
              data-badge={key}
              title={style.tooltip}
              className={`flex items-center justify-between gap-1.5 border px-2.5 py-1.5 text-xs ${style.className}`}
            >
              <span className="font-medium">{BADGE_LABEL[key]}</span>
              <span aria-hidden>{style.symbol}</span>
            </li>
          )
        })}
      </ul>

      <p className="font-mono text-[10px] text-text-muted">
        Legend: ✓ connected · • detected · — missing · ? convention pending
      </p>
      <p className="text-[11px] italic text-text-muted">
        Dimensions interpret the score above — they do not replace it.
      </p>
    </section>
  )
}
