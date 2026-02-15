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
      {events.length === 0 ? (
        <div className="flex h-full items-center justify-center text-zinc-600">
          <div className="text-center">
            <p className="text-lg">Waiting for events...</p>
            <p className="mt-1 text-sm">Listening on ERC-8004 contracts</p>
          </div>
        </div>
      ) : (
        <div className="py-2">
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
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">paused -- move mouse away to resume</span>
        </div>
      )}
    </div>
  )
}
