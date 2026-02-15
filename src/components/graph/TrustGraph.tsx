'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useGraphStore } from '@/stores/graph'
import { useAgentStore } from '@/stores/agents'
import { getChain } from '@/config/chains'
import { createSimulation, type SimNode, type SimLink } from '@/lib/graph/layout'
import { GraphTooltip } from './GraphTooltip'

export type HoveredNode = {
  agentId: number
  chainId: number
  label: string
  feedbackCount: number
  agentName?: string
  chainLabel: string
  x: number
  y: number
}

function getNodeRadius(feedbackCount: number): number {
  return Math.max(4, Math.min(16, 4 + feedbackCount * 2))
}

export function TrustGraph({ onNodeClick }: { onNodeClick?: (agentKey: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<SimNode[]>([])
  const nodesMap = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const agents = useAgentStore((s) => s.agents)
  const [hovered, setHovered] = useState<HoveredNode | null>(null)

  const hitTest = useCallback((clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue
      const radius = getNodeRadius(node.feedbackCount)
      const dx = x - node.x
      const dy = y - node.y!
      if (dx * dx + dy * dy <= (radius + 4) * (radius + 4)) {
        return node
      }
    }
    return null
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = hitTest(e.clientX, e.clientY)
    if (node) {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const agentKey = `${node.chainId}:${node.agentId}`
      const agent = agents.get(agentKey)
      const chain = getChain(node.chainId)
      setHovered({
        agentId: node.agentId,
        chainId: node.chainId,
        label: node.label,
        feedbackCount: node.feedbackCount,
        agentName: agent?.metadata?.name,
        chainLabel: chain?.badge.label ?? `Chain ${node.chainId}`,
        x: node.x! + rect.left,
        y: node.y! + rect.top,
      })
      canvas.style.cursor = 'pointer'
    } else {
      setHovered(null)
      if (canvasRef.current) canvasRef.current.style.cursor = 'default'
    }
  }, [hitTest, agents])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = hitTest(e.clientX, e.clientY)
    if (node && onNodeClick) {
      onNodeClick(`${node.chainId}:${node.agentId}`)
    }
  }, [hitTest, onNodeClick])

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
    nodesRef.current = nodes

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
        const radius = getNodeRadius(node.feedbackCount)
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

  return (
    <>
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClick}
      />
      {hovered && <GraphTooltip node={hovered} />}
    </>
  )
}
