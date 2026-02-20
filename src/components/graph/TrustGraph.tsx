'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useGraphStore } from '@/stores/graph'
import { useAgentStore } from '@/stores/agents'
import { getChain } from '@/config/chains'
import { createSimulation, type SimNode, type SimLink } from '@/lib/graph/layout'
import { GraphTooltip } from './GraphTooltip'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { select } from 'd3-selection'

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
  const fxCanvasRef = useRef<HTMLCanvasElement>(null)
  const baseCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const fxCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const transformRef = useRef<ZoomTransform>(zoomIdentity)
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const nodesMap = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const agents = useAgentStore((s) => s.agents)
  const [hovered, setHovered] = useState<HoveredNode | null>(null)

  // Transform screen coordinates to simulation coordinates
  const screenToSim = useCallback((screenX: number, screenY: number) => {
    const t = transformRef.current
    return {
      x: (screenX - t.x) / t.k,
      y: (screenY - t.y) / t.k,
    }
  }, [])

  const hitTest = useCallback((clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { x, y } = screenToSim(clientX - rect.left, clientY - rect.top)

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
  }, [screenToSim])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = hitTest(e.clientX, e.clientY)
    if (node) {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const agentKey = `${node.chainId}:${node.agentId}`
      const agent = agents.get(agentKey)
      const chain = getChain(node.chainId)
      const t = transformRef.current
      setHovered({
        agentId: node.agentId,
        chainId: node.chainId,
        label: node.label,
        feedbackCount: node.feedbackCount,
        agentName: agent?.metadata?.name,
        chainLabel: chain?.badge.label ?? `Chain ${node.chainId}`,
        x: node.x! * t.k + t.x + rect.left,
        y: node.y! * t.k + t.y + rect.top,
      })
      canvas.style.cursor = 'pointer'
    } else {
      setHovered(null)
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    }
  }, [hitTest, agents])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = hitTest(e.clientX, e.clientY)
    if (node && onNodeClick) {
      onNodeClick(`${node.chainId}:${node.agentId}`)
    }
  }, [hitTest, onNodeClick])

  // Fit all nodes in viewport
  const fitToView = useCallback(() => {
    const canvas = canvasRef.current
    const nodes = nodesRef.current
    if (!canvas || nodes.length === 0 || !zoomRef.current) return

    const { width, height } = canvas.getBoundingClientRect()
    const padding = 60

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue
      minX = Math.min(minX, n.x)
      maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y!)
      maxY = Math.max(maxY, n.y!)
    }

    const graphW = maxX - minX || 1
    const graphH = maxY - minY || 1
    const scale = Math.min((width - padding * 2) / graphW, (height - padding * 2) / graphH, 2)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    const t = zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-cx, -cy)

    select(canvas).call(zoomRef.current.transform, t)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const fxCanvas = fxCanvasRef.current
    if (!canvas || !fxCanvas) return

    const baseCtx = canvas.getContext('2d')
    const fxCtx = fxCanvas.getContext('2d')
    if (!baseCtx || !fxCtx) return
    const baseCtx2: CanvasRenderingContext2D = baseCtx
    const fxCtx2: CanvasRenderingContext2D = fxCtx
    baseCtxRef.current = baseCtx2
    fxCtxRef.current = fxCtx2

    const { width, height } = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    fxCanvas.width = width * dpr
    fxCanvas.height = height * dpr
    baseCtx2.setTransform(dpr, 0, 0, dpr, 0, 0)
    fxCtx2.setTransform(dpr, 0, 0, dpr, 0, 0)

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
      baseCtx2.clearRect(0, 0, width, height)
      baseCtx2.fillStyle = '#555555'
      baseCtx2.textAlign = 'center'
      baseCtx2.font = '14px monospace'
      baseCtx2.fillText('No agents in graph yet', width / 2, height / 2)
      drawFx()
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

    function drawFx() {
      fxCtx2.clearRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      fxCtx2.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      fxCtx2.lineWidth = 1
      fxCtx2.beginPath()
      fxCtx2.moveTo(cx - 6, cy)
      fxCtx2.lineTo(cx + 6, cy)
      fxCtx2.moveTo(cx, cy - 6)
      fxCtx2.lineTo(cx, cy + 6)
      fxCtx2.stroke()
    }

    function draw() {
      const t = transformRef.current
      baseCtx2.save()
      baseCtx2.clearRect(0, 0, width, height)
      baseCtx2.translate(t.x, t.y)
      baseCtx2.scale(t.k, t.k)

      // Draw edges
      baseCtx2.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      baseCtx2.lineWidth = 1 / t.k
      for (const link of links) {
        const s = link.source as SimNode
        const tgt = link.target as SimNode
        if (s.x == null || tgt.x == null) continue
        baseCtx2.beginPath()
        baseCtx2.moveTo(s.x, s.y!)
        baseCtx2.lineTo(tgt.x, tgt.y!)
        baseCtx2.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null) continue
        const radius = getNodeRadius(node.feedbackCount)
        baseCtx2.beginPath()
        baseCtx2.arc(node.x, node.y!, radius, 0, Math.PI * 2)
        baseCtx2.fillStyle = getNodeColor(node.id)
        baseCtx2.fill()
        baseCtx2.strokeStyle = '#222222'
        baseCtx2.lineWidth = 1.5 / t.k
        baseCtx2.stroke()

        // Label
        baseCtx2.fillStyle = '#888888'
        baseCtx2.font = `${10 / t.k}px monospace`
        baseCtx2.textAlign = 'center'
        baseCtx2.fillText(`#${node.agentId}`, node.x, node.y! + radius + 12 / t.k)
      }

      baseCtx2.restore()
      drawFx()
    }

    // Setup d3-zoom
    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        transformRef.current = event.transform
        draw()
      })

    zoomRef.current = zoomBehavior
    select(canvas)
      .call(zoomBehavior)
      .on('dblclick.zoom', null) // disable double-click zoom

    const sim = createSimulation(nodes, links, width, height)

    sim.on('tick', draw)

    // Fit to view once simulation settles
    sim.on('end', () => {
      fitToView()
    })

    return () => {
      sim.stop()
      select(canvas).on('.zoom', null)
      baseCtxRef.current = null
      fxCtxRef.current = null
    }
  }, [nodesMap, edges, fitToView])

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClick}
      />
      <canvas
        ref={fxCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <button
        onClick={fitToView}
        className="absolute bottom-4 right-4 border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
      >
        Fit to view
      </button>
      {hovered && <GraphTooltip node={hovered} />}
    </div>
  )
}
