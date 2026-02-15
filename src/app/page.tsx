'use client'

import { useState } from 'react'
import { LiveFeed } from '@/components/feed/LiveFeed'
import { XRayPanel } from '@/components/xray/XRayPanel'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'

export default function FeedPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const events = useEventStore((s) => s.events)
  const agentCount = useAgentStore((s) => s.agents.size)
  const headBlock = events.length > 0 ? events[0].block : 0

  return (
    <div className="flex h-full flex-col">
      {/* Page Title */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider">
          LIVE FEED
        </h1>
        <p className="text-text-secondary text-xs uppercase tracking-widest font-mono">
          REAL-TIME AGENT OBSERVABILITY LAYER
        </p>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-3 border-b border-border">
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Head Block</p>
          <p className="text-sm font-mono text-text-primary">{headBlock > 0 ? headBlock.toLocaleString() : '\u2014'}</p>
        </div>
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Agents</p>
          <p className="text-sm font-mono text-text-primary">{agentCount}</p>
        </div>
        <div className="bg-surface border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Events</p>
          <p className="text-sm font-mono text-text-primary">{events.length}</p>
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
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg to-transparent" />
    </div>
  )
}
