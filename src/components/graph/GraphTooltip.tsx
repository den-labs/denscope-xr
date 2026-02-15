'use client'

import type { HoveredNode } from './TrustGraph'

export function GraphTooltip({ node }: { node: HoveredNode }) {
  return (
    <div
      className="pointer-events-none fixed z-50 bg-surface border border-border px-3 py-2 shadow-lg"
      style={{ left: node.x + 12, top: node.y - 8 }}
    >
      <p className="font-mono text-xs text-text-primary font-bold">
        {node.agentName ?? `Agent #${node.agentId}`}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className="status-pill status-pill-neutral text-[10px]">{node.chainLabel}</span>
        <span className="font-mono text-[10px] text-text-muted">
          {node.feedbackCount} feedback{node.feedbackCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
