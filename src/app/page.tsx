'use client'

import { useState } from 'react'
import { LiveFeed } from '@/components/feed/LiveFeed'
import { XRayPanel } from '@/components/xray/XRayPanel'

export default function FeedPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden">
        <LiveFeed onAgentClick={setSelectedAgent} />
      </div>
      <XRayPanel agentKey={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  )
}
