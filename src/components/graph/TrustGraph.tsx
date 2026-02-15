'use client'

import { useRef, useEffect } from 'react'
import { useGraphStore } from '@/stores/graph'
import { createSimulation, type SimNode, type SimLink } from '@/lib/graph/layout'

export function TrustGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesMap = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const nodes: SimNode[] = Array.from(nodesMap.values()).map((n) => ({ ...n }))
    const links: SimLink[] = edges
      .filter(
        (e) =>
          nodesMap.has(e.source as string) && nodesMap.has(e.target as string),
      )
      .map((e) => ({
        source: e.source,
        target: e.target,
        kind: e.kind,
        value: e.value,
      }))

    if (nodes.length === 0) {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#555555'
      ctx.textAlign = 'center'
      ctx.font = '14px monospace'
      ctx.fillText('No agents in graph yet', width / 2, height / 2)
      return
    }

    // Pre-compute per-node feedback from edges
    const negativeFeedback = new Map<string, number>()
    const positiveFeedback = new Map<string, number>()
    for (const edge of edges) {
      const target = edge.target as string
      if (edge.value < 0) {
        negativeFeedback.set(target, (negativeFeedback.get(target) ?? 0) + 1)
      } else {
        positiveFeedback.set(target, (positiveFeedback.get(target) ?? 0) + 1)
      }
    }

    function getNodeColor(nodeId: string): string {
      const neg = negativeFeedback.get(nodeId) ?? 0
      const pos = positiveFeedback.get(nodeId) ?? 0
      if (neg > 0 && neg > pos) return '#ff3b30'
      if (neg > 0) return '#ffcc00'
      return '#34c759'
    }

    const sim = createSimulation(nodes, links, width, height)

    sim.on('tick', () => {
      ctx.clearRect(0, 0, width, height)

      // Draw edges
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.lineWidth = 1
      for (const link of links) {
        const s = link.source as SimNode
        const t = link.target as SimNode
        if (s.x == null || t.x == null) continue
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.lineTo(t.x, t.y!)
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null) continue
        const radius = Math.max(4, Math.min(16, 4 + node.feedbackCount * 2))
        ctx.beginPath()
        ctx.arc(node.x, node.y!, radius, 0, Math.PI * 2)
        ctx.fillStyle = getNodeColor(node.id)
        ctx.fill()
        ctx.strokeStyle = '#222222'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = '#888888'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`#${node.agentId}`, node.x, node.y! + radius + 12)
      }
    })

    return () => { sim.stop() }
  }, [nodesMap, edges])

  return <canvas ref={canvasRef} className="h-full w-full" />
}
