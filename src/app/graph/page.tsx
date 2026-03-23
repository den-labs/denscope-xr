'use client'

import { useState } from 'react'
import { TrustGraph } from '@/components/graph/TrustGraph'
import { XRayPanel } from '@/components/xray/XRayPanel'
import { useGraphStore } from '@/stores/graph'

export default function GraphPage() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  return (
    <div className="relative h-full bg-grid">
      {/* Canvas layer */}
      <div className="absolute inset-0">
        <TrustGraph onNodeClick={setSelectedAgent} focusAgentKey={selectedAgent} />
      </div>

      {/* Top-left: Title */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="font-display font-bold text-sm">DenScope</h1>
        <p className="font-mono text-xs text-foreground-muted">Trust Graph Explorer</p>
      </div>

      {/* Top-right: Legend */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-4 font-mono text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-warning" />
          Warning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-danger" />
          Critical
        </span>
      </div>

      {/* Bottom-right: Stats HUD */}
      <div className="absolute bottom-4 right-4 z-10 font-mono text-xs text-right">
        <p>Nodes <span className="text-foreground-muted">{nodes.size}</span></p>
        <p>Edges <span className="text-foreground-muted">{edges.length}</span></p>
      </div>

      {/* Corner crosshairs */}
      {/* Top-left */}
      <div className="absolute top-0 left-0 z-0 h-4 w-4 border-t border-l border-interactive/20" />
      {/* Top-right */}
      <div className="absolute top-0 right-0 z-0 h-4 w-4 border-t border-r border-interactive/20" />
      {/* Bottom-left */}
      <div className="absolute bottom-0 left-0 z-0 h-4 w-4 border-b border-l border-interactive/20" />
      {/* Bottom-right */}
      <div className="absolute bottom-0 right-0 z-0 h-4 w-4 border-b border-r border-interactive/20" />

      {/* XRay Panel */}
      <XRayPanel
        agentKey={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onSelectAgent={setSelectedAgent}
      />
    </div>
  )
}
