'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { LiveFeed } from '@/components/feed/LiveFeed'
import { FeedFiltersBar } from '@/components/feed/FeedFilters'
import { FeedHint } from '@/components/feed/FeedHint'
import { CertificateStation } from '@/components/feed/CertificateStation'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'
import { useFeedFilters } from '@/hooks/useFeedFilters'
import type { Layout } from '@/components/feed/CertificateStation'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

function useLayout(): Layout {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isMedium = useMediaQuery('(min-width: 768px)')
  if (isDesktop) return 'docked'
  if (isMedium) return 'collapsible'
  return 'sheet'
}

export default function FeedPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [hintDismissed, setHintDismissed] = useState(false)
  const dismissedRef = useRef(false)
  const events = useEventStore((s) => s.events)
  const agents = useAgentStore((s) => s.agents)
  const agentCount = agents.size
  const headBlock = events.length > 0 ? events[0].block : 0
  const { filters, setFilters } = useFeedFilters()
  const layout = useLayout()

  // Auto-select first agent when events arrive and no selection yet
  useEffect(() => {
    if (selectedAgent) return
    if (dismissedRef.current) return
    if (events.length === 0) return
    const first = events[0]
    setSelectedAgent(`${first.chainId}:${first.agentId}`)
  }, [events, selectedAgent])

  const handleAgentClick = useCallback((key: string) => {
    dismissedRef.current = false
    setSelectedAgent(key)
  }, [])

  const handleStationClose = useCallback(() => {
    dismissedRef.current = true
    setSelectedAgent(null)
  }, [])

  const filteredCount = useMemo(() => {
    const hasFilter = filters.kinds.size > 0 || filters.chainId !== null || filters.agentId !== ''
    if (!hasFilter) return null
    return events.filter((e) => {
      if (filters.kinds.size > 0 && !filters.kinds.has(e.kind)) return false
      if (filters.chainId !== null && e.chainId !== filters.chainId) return false
      if (filters.agentId !== '' && e.agentId !== Number(filters.agentId)) return false
      return true
    }).length
  }, [events, filters])

  return (
    <div className="flex h-full flex-col">
      {/* Page Title */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider">
          LIVE FEED
        </h1>
        <p className="text-foreground-secondary text-xs uppercase tracking-widest">
          REAL-TIME AGENT OBSERVABILITY LAYER
        </p>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-3 border-b border-border">
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[11px] uppercase tracking-widest text-foreground-muted">Head Block</p>
          <p className="text-sm font-mono text-foreground">{headBlock > 0 ? headBlock.toLocaleString() : '\u2014'}</p>
        </div>
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[11px] uppercase tracking-widest text-foreground-muted">Agents</p>
          <p className="text-sm font-mono text-foreground">{agentCount}</p>
        </div>
        <div className="bg-surface border-border px-4 py-2">
          <p className="text-[11px] uppercase tracking-widest text-foreground-muted">Events</p>
          <p className="text-sm font-mono text-foreground">
            {filteredCount !== null ? `${filteredCount} / ${events.length}` : events.length}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FeedFiltersBar filters={filters} onChange={setFilters} />

      {/* Feed Hint */}
      <FeedHint dismissed={hintDismissed} />

      {/* Main Content — 2-column: [Feed] [Station] */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <LiveFeed
            onAgentClick={handleAgentClick}
            onFirstHover={() => setHintDismissed(true)}
            filters={filters}
            selectedAgentKey={selectedAgent}
          />
        </div>
        <CertificateStation
          agentKey={selectedAgent}
          layout={layout}
          onClose={handleStationClose}
        />
      </div>

      {/* Bottom gradient fade overlay */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg to-transparent" />
    </div>
  )
}
