'use client'

import { useState, useCallback } from 'react'
import { TrustGraph } from '@/components/graph/TrustGraph'
import { XRayPanel } from '@/components/xray/XRayPanel'
import { ChainSelect } from '@/components/shared/ChainSelect'
import { useGraphStore } from '@/stores/graph'
import { useFeedFilters } from '@/hooks/useFeedFilters'

export default function GraphPage() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const { filters, setFilters } = useFeedFilters()

  const handleChainChange = useCallback((chainId: number | null) => {
    setFilters({ ...filters, chainId })
    setSelectedAgent(null)
  }, [filters, setFilters])

  return (
    <div className="relative h-full bg-grid">
      {/* Canvas layer */}
      <div className="absolute inset-0">
        <TrustGraph onNodeClick={setSelectedAgent} focusAgentKey={selectedAgent} />
      </div>

      {/* Top-left: Title + Chain selector */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-4">
        <div>
          <h1 className="font-display font-bold text-sm">DenScope</h1>
          <p className="font-mono text-xs text-text-muted">Trust Graph Explorer</p>
        </div>
        <ChainSelect value={filters.chainId} onChange={handleChainChange} />
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
          <span className="inline-block h-2 w-2 rounded-full bg-critical" />
          Critical
        </span>
      </div>

      {/* Bottom-right: Stats HUD */}
      <div className="absolute bottom-4 right-4 z-10 font-mono text-xs text-right">
        <p>Nodes <span className="text-text-muted">{nodes.size}</span></p>
        <p>Edges <span className="text-text-muted">{edges.length}</span></p>
      </div>

      {/* Corner crosshairs */}
      <div className="absolute top-0 left-0 z-0 h-4 w-4 border-t border-l border-accent/20" />
      <div className="absolute top-0 right-0 z-0 h-4 w-4 border-t border-r border-accent/20" />
      <div className="absolute bottom-0 left-0 z-0 h-4 w-4 border-b border-l border-accent/20" />
      <div className="absolute bottom-0 right-0 z-0 h-4 w-4 border-b border-r border-accent/20" />

      {/* XRay Panel */}
      <XRayPanel
        agentKey={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onSelectAgent={setSelectedAgent}
      />
    </div>
  )
}
