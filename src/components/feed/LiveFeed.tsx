'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEventStore } from '@/stores/events'
import type { FeedFilters } from '@/hooks/useFeedFilters'
import { FeedLine } from './FeedLine'
import { PulseEffect } from './PulseEffect'
import { CertificatePreview } from './CertificatePreview'

export function LiveFeed({ onAgentClick, onFirstHover, filters }: { onAgentClick?: (key: string) => void; onFirstHover?: () => void; filters?: FeedFilters }) {
  const events = useEventStore((s) => s.events)
  const [paused, setPaused] = useState(false)

  // Hover preview state
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const firstHoverFired = useRef(false)

  const handleHoverEnter = useCallback((agentKey: string, rect: DOMRect) => {
    clearTimeout(leaveTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setHoveredAgent(agentKey)
      setHoverRect(rect)
      if (!firstHoverFired.current) {
        firstHoverFired.current = true
        onFirstHover?.()
      }
    }, 300)
  }, [onFirstHover])

  const handleHoverLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      setHoveredAgent(null)
      setHoverRect(null)
    }, 50)
  }, [])

  const handleTooltipEnter = useCallback(() => {
    clearTimeout(leaveTimerRef.current)
  }, [])

  const handleTooltipLeave = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => {
      setHoveredAgent(null)
      setHoverRect(null)
    }, 50)
  }, [])

  const filteredEvents = useMemo(() => {
    if (!filters) return events
    return events.filter((e) => {
      if (filters.kinds.size > 0 && !filters.kinds.has(e.kind)) return false
      if (filters.chainId !== null && e.chainId !== filters.chainId) return false
      if (filters.agentId !== '' && e.agentId !== Number(filters.agentId)) return false
      return true
    })
  }, [events, filters])

  return (
    <div
      className="h-full overflow-y-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Column Headers */}
      <div className="sticky top-0 z-10 grid grid-cols-[120px_100px_100px_1fr_120px_auto_auto] gap-0 border-b border-border bg-surface px-4 py-2">
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Timestamp</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Event Type</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Protocol</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Agent Identity</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Tx Hash</span>
        <span />
        <span />
      </div>

      {events.length === 0 ? (
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">Waiting for events...</p>
            <p className="mt-1 text-sm">Listening on ERC-8004 contracts</p>
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">No events match filters</p>
            <p className="mt-1 text-sm">Try adjusting your filter criteria</p>
          </div>
        </div>
      ) : (
        <div className="py-0">
          <AnimatePresence initial={false}>
            {filteredEvents.map((event) => (
              <motion.div
                key={`${event.txHash}:${event.logIndex}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PulseEffect>
                  <FeedLine
                    event={event}
                    onClick={() => onAgentClick?.(`${event.chainId}:${event.agentId}`)}
                    onHoverEnter={handleHoverEnter}
                    onHoverLeave={handleHoverLeave}
                  />
                </PulseEffect>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Hover preview tooltip (desktop only) */}
      {hoveredAgent && hoverRect && (
        <CertificatePreview
          agentKey={hoveredAgent}
          rect={hoverRect}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
        />
      )}

      {paused && (
        <div className="pointer-events-none fixed bottom-12 left-1/2 -translate-x-1/2">
          <span className="bg-surface border border-border px-3 py-1 text-xs text-text-muted font-mono">paused -- move mouse away to resume</span>
        </div>
      )}
    </div>
  )
}
