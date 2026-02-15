'use client'

import { TrustGraph } from '@/components/graph/TrustGraph'
import { useGraphStore } from '@/stores/graph'

export default function GraphPage() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)

  return (
    <div className="relative h-full bg-grid">
      {/* Canvas layer */}
      <div className="absolute inset-0">
        <TrustGraph />
      </div>

      {/* Top-left: Title */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="font-display font-bold text-sm">DenScope</h1>
        <p className="font-mono text-xs text-text-muted">Trust Graph Explorer</p>
      </div>

      {/* Top-right: Legend */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-4 font-mono text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#34c759' }} />
          Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#ffcc00' }} />
          Warning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#ff3b30' }} />
          Critical
        </span>
      </div>

      {/* Bottom-left: Parameters panel */}
      <div className="absolute bottom-4 left-4 z-10 w-56 border border-border bg-surface/80 backdrop-blur-sm p-4 font-mono text-xs">
        <p className="mb-2 text-text-muted">Parameters</p>

        <div className="mb-3">
          <p className="mb-1">Time Window</p>
          <div className="flex gap-1">
            <button className="border border-border px-2 py-0.5">1H</button>
            <button className="border border-border px-2 py-0.5">6H</button>
            <button className="border border-border px-2 py-0.5">24H</button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block h-3 w-3 border border-border" />
          <span>Show Edges</span>
        </div>

        <div>
          <p className="mb-1">Node Density</p>
          <div className="h-1 w-full bg-border">
            <div className="h-1 w-1/2 bg-accent" />
          </div>
        </div>
      </div>

      {/* Bottom-right: Stats HUD */}
      <div className="absolute bottom-4 right-4 z-10 font-mono text-xs text-right">
        <p>Net Latency <span className="text-text-muted">12ms</span></p>
        <p>Nodes <span className="text-text-muted">{nodes.size}</span></p>
        <p>Edges <span className="text-text-muted">{edges.length}</span></p>
        <p className="mt-1 flex items-center justify-end gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#34c759' }} />
          System Status: Active
        </p>
      </div>

      {/* Corner crosshairs */}
      {/* Top-left */}
      <div className="absolute top-0 left-0 z-0 h-4 w-4 border-t border-l border-accent/20" />
      {/* Top-right */}
      <div className="absolute top-0 right-0 z-0 h-4 w-4 border-t border-r border-accent/20" />
      {/* Bottom-left */}
      <div className="absolute bottom-0 left-0 z-0 h-4 w-4 border-b border-l border-accent/20" />
      {/* Bottom-right */}
      <div className="absolute bottom-0 right-0 z-0 h-4 w-4 border-b border-r border-accent/20" />
    </div>
  )
}
