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
      ctx.fillStyle = '#52525b'
      ctx.textAlign = 'center'
      ctx.font = '16px system-ui'
      ctx.fillText('No agents in graph yet', width / 2, height / 2)
      return
    }

    const sim = createSimulation(nodes, links, width, height)

    sim.on('tick', () => {
      ctx.clearRect(0, 0, width, height)

      // Draw edges
      ctx.strokeStyle = '#3f3f46'
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
        ctx.fillStyle = '#34d399'
        ctx.fill()
        ctx.strokeStyle = '#064e3b'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = '#d4d4d8'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`#${node.agentId}`, node.x, node.y! + radius + 12)
      }
    })

    return () => { sim.stop() }
  }, [nodesMap, edges])

  return <canvas ref={canvasRef} className="h-full w-full" />
}
