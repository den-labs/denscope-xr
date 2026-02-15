'use client'

import { useState } from 'react'
import { LiveFeed } from '@/components/feed/LiveFeed'
import { XRayPanel } from '@/components/xray/XRayPanel'
import { useEventStore } from '@/stores/events'

export default function FeedPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const eventCount = useEventStore((s) => s.events.length)

  return (
    <div className="flex h-full flex-col">
      {/* Page Title */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wider">
              LIVE FEED
            </h1>
            <p className="text-text-secondary text-xs uppercase tracking-widest font-mono">
              REAL-TIME AGENT OBSERVABILITY LAYER
            </p>
          </div>
          <div className="flex gap-2">
            <button className="border border-border bg-surface px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-text-secondary hover:bg-surface-hover transition-colors">
              Filter
            </button>
            <button className="border border-border bg-surface px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-text-secondary hover:bg-surface-hover transition-colors">
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-6 border-b border-border">
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Head Block</p>
          <p className="text-sm font-mono text-text-primary">58,401,224</p>
        </div>
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Finalized</p>
          <p className="text-sm font-mono text-text-primary">&mdash;</p>
        </div>
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Cursor</p>
          <p className="text-sm font-mono text-text-primary">&mdash;</p>
        </div>
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Network Lag</p>
          <p className="text-sm font-mono text-text-primary">&mdash;</p>
        </div>
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Events/Sec</p>
          <p className="text-sm font-mono text-text-primary">{eventCount}</p>
        </div>
        <div className="bg-surface border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Backfill Status</p>
          <p className="text-sm font-mono text-text-primary">&mdash;</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <LiveFeed onAgentClick={setSelectedAgent} />
        </div>
        <XRayPanel agentKey={selectedAgent} onClose={() => setSelectedAgent(null)} />
      </div>

      {/* Bottom gradient fade overlay */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
    </div>
  )
}
