'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGraphStore } from '@/stores/graph'
import { useAgentStore } from '@/stores/agents'
import { eventsFromEdges } from '@/lib/firehose/fromEdges'
import { buildFeedbackAggregates, type AgentAggregate } from '@/lib/firehose/aggregates'

type LeadersPanelProps = {
  onSelectAgent: (agentKey: string) => void
}

const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 5

function parseAgentId(targetId: string): number | null {
  const i = targetId.indexOf(':')
  const raw = i === -1 ? targetId : targetId.slice(i + 1)
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

function metric(
  row: AgentAggregate,
  kind: 'liked' | 'disliked' | 'reviewed' | 'hot',
): string {
  if (kind === 'liked') return row.posSum.toFixed(2)
  if (kind === 'disliked') return Math.abs(row.negSum).toFixed(2)
  if (kind === 'reviewed') return String(row.count)
  return `${row.ratePerMin.toFixed(2)}/min`
}

export function LeadersPanel({ onSelectAgent }: LeadersPanelProps) {
  const edges = useGraphStore((s) => s.edges)
  const agents = useAgentStore((s) => s.agents)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5_000)
    return () => window.clearInterval(id)
  }, [])

  const denEvents = useMemo(() => eventsFromEdges(edges, 0, nowMs), [edges, nowMs])
  const agg = useMemo(
    () => buildFeedbackAggregates(denEvents, { windowMs: WINDOW_MS, nowMs }),
    [denEvents, nowMs],
  )

  const groups = useMemo(() => ([
    { key: 'liked' as const, title: 'Top liked agents', rows: agg.topLiked(LIMIT) },
    { key: 'disliked' as const, title: 'Top disliked agents', rows: agg.topDisliked(LIMIT) },
    { key: 'reviewed' as const, title: 'Most reviewed', rows: agg.mostReviewed(LIMIT) },
    { key: 'hot' as const, title: 'Hot (events/min)', rows: agg.hotAgents(LIMIT) },
  ]), [agg])

  function labelFor(targetId: string): string {
    const fromStore = agents.get(targetId)?.metadata?.name
    if (fromStore) return fromStore
    const parsed = parseAgentId(targetId)
    return parsed != null ? `#${parsed}` : targetId
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="font-mono text-[10px] text-text-muted">Rolling window: last 10 minutes</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {groups.map((group) => (
          <section key={group.key} className="space-y-2">
            <h3 className="font-mono text-[11px] uppercase text-text-secondary">{group.title}</h3>
            {group.rows.length === 0 ? (
              <p className="font-mono text-xs text-text-muted">No events yet.</p>
            ) : (
              <div className="divide-y divide-border/60 border border-border">
                {group.rows.map((row) => (
                  <button
                    key={`${group.key}:${row.targetId}`}
                    onClick={() => onSelectAgent(row.targetId)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface transition-colors"
                  >
                    <span className="truncate font-mono text-xs text-text-primary">
                      {labelFor(row.targetId)}
                    </span>
                    <span className="font-mono text-xs text-text-secondary">
                      {metric(row, group.key)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
