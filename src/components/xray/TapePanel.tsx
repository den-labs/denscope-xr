'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useGraphStore } from '@/stores/graph'
import { eventsFromEdges } from '@/lib/firehose/fromEdges'
import { formatTapeRow } from '@/lib/firehose/format'
import type { DenEvent } from '@/lib/firehose/types'

type TapeFilter = 'all' | 'positive' | 'negative' | 'neutral'

type TapePanelProps = {
  onSelectAgent: (agentKey: string) => void
}

const MAX_TAPE_EVENTS = 200

function eventMatchesFilter(event: DenEvent, filter: TapeFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'positive') return event.value > 0
  if (filter === 'negative') return event.value < 0
  return event.value === 0
}

export function TapePanel({ onSelectAgent }: TapePanelProps) {
  const edges = useGraphStore((s) => s.edges)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<TapeFilter>('all')
  const [events, setEvents] = useState<DenEvent[]>([])
  const bufferedRef = useRef<DenEvent[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const denEvents = eventsFromEdges(edges, 0, Date.now())
    const incoming: DenEvent[] = []

    for (const event of denEvents) {
      if (seenIdsRef.current.has(event.id)) continue
      seenIdsRef.current.add(event.id)
      incoming.push(event)
    }

    if (incoming.length === 0) return
    incoming.sort((a, b) => b.ts - a.ts)

    if (paused) {
      bufferedRef.current = [...incoming, ...bufferedRef.current].slice(0, MAX_TAPE_EVENTS)
      return
    }

    setEvents((prev) => [...incoming, ...prev].slice(0, MAX_TAPE_EVENTS))
  }, [edges, paused])

  useEffect(() => {
    if (paused || bufferedRef.current.length === 0) return
    setEvents((prev) => [...bufferedRef.current, ...prev].slice(0, MAX_TAPE_EVENTS))
    bufferedRef.current = []
  }, [paused])

  const visibleEvents = useMemo(
    () => events.filter((event) => eventMatchesFilter(event, filter)),
    [events, filter],
  )

  async function handleRowClick(event: DenEvent) {
    onSelectAgent(event.targetId)
    const copyValue = event.txHash ?? event.id
    if (!navigator?.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(copyValue)
    } catch {
      // Clipboard can fail on unsupported/non-secure contexts.
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(['all', 'positive', 'negative', 'neutral'] as TapeFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
                  filter === key
                    ? 'border-text-primary bg-text-primary text-bg'
                    : 'border-border text-text-secondary hover:text-text-primary hover:border-border-bright'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPaused((p) => !p)}
            className="px-2 py-1 text-[11px] font-mono uppercase border border-border text-text-secondary hover:text-text-primary hover:border-border-bright transition-colors"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
        <p className="font-mono text-[10px] text-text-muted">
          {paused ? `Paused • ${bufferedRef.current.length} buffered` : 'Live'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {visibleEvents.length === 0 ? (
          <div className="px-4 py-6 font-mono text-xs text-text-muted">
            No feedback events yet.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {visibleEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => { void handleRowClick(event) }}
                className="block w-full px-4 py-2 text-left font-mono text-[11px] text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                title={event.txHash ?? event.id}
              >
                {formatTapeRow(event)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
