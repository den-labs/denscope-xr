'use client'

import { useState } from 'react'
import type {
  ImprovementPriority,
  ImprovementSuggestion,
} from '@/lib/trust-snapshot/types'

interface ImprovementListProps {
  improvements: ImprovementSuggestion[]
  claimed: boolean
}

const MAX_VISIBLE = 5

const PRIORITY_CLASS: Record<ImprovementPriority, string> = {
  P1: 'status-pill-warning',
  P2: 'status-pill-accent',
  P3: 'status-pill-neutral',
}

/**
 * Priority-ordered improvement suggestions. Public (non-claimed) views render
 * expanded by default so DenScope's differentiating value is visible (M-3);
 * owner (claimed) views start collapsed. Caps at 5 with a "Show all" reveal.
 */
export function ImprovementList({ improvements, claimed }: ImprovementListProps) {
  const [expanded, setExpanded] = useState(!claimed)
  const [showAll, setShowAll] = useState(false)

  if (improvements.length === 0) return null

  const visible = showAll ? improvements : improvements.slice(0, MAX_VISIBLE)
  const hiddenCount = improvements.length - visible.length

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
          Improvement suggestions
        </h2>
        <span className="font-mono text-xs text-text-muted">
          {improvements.length} suggestion{improvements.length === 1 ? '' : 's'} {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <>
          <ul className="space-y-2">
            {visible.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 border border-border p-3">
                <span className={`status-pill ${PRIORITY_CLASS[s.priority]} text-[10px] shrink-0`}>
                  {s.priority}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-text-primary">{s.title}</p>
                  <p className="text-xs text-text-secondary">{s.body}</p>
                  {s.action && (
                    <a href={s.action.href} className="text-xs text-accent hover:underline">
                      {s.action.label} →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-accent hover:underline"
            >
              Show all suggestions ({hiddenCount} more)
            </button>
          )}
        </>
      )}
    </section>
  )
}
