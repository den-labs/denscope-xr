'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEventStore } from '@/stores/events'
import { FeedLine } from './FeedLine'
import { PulseEffect } from './PulseEffect'

export function LiveFeed({ onAgentClick }: { onAgentClick?: (key: string) => void }) {
  const events = useEventStore((s) => s.events)
  const [paused, setPaused] = useState(false)

  return (
    <div
      className="h-full overflow-y-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Column Headers */}
      <div className="sticky top-0 z-10 grid grid-cols-[120px_100px_100px_1fr_120px_40px] gap-0 border-b border-border bg-surface px-4 py-2">
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Timestamp</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Event Type</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Protocol</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Agent Identity</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Tx Hash</span>
        <span />
      </div>

      {events.length === 0 ? (
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">Waiting for events...</p>
            <p className="mt-1 text-sm">Listening on ERC-8004 contracts</p>
          </div>
        </div>
      ) : (
        <div className="py-0">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <motion.div
                key={`${event.txHash}:${event.logIndex}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PulseEffect>
                  <FeedLine event={event} onClick={() => onAgentClick?.(`${event.chainId}:${event.agentId}`)} />
                </PulseEffect>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {paused && (
        <div className="pointer-events-none fixed bottom-12 left-1/2 -translate-x-1/2">
          <span className="bg-surface border border-border px-3 py-1 text-xs text-text-muted font-mono">paused -- move mouse away to resume</span>
        </div>
      )}
    </div>
  )
}
