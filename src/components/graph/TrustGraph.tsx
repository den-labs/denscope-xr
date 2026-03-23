'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useGraphStore } from '@/stores/graph'
import { useAgentStore } from '@/stores/agents'
import { getChain } from '@/config/chains'
import { createSimulation, type SimNode, type SimLink } from '@/lib/graph/layout'
import { eventsFromEdges } from '@/lib/firehose/fromEdges'
import { PacketAnimator } from '@/lib/firehose/packetAnimator'
import type { DenEvent } from '@/lib/firehose/types'
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

function getCanvasDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 1.5)
}

export function TrustGraph({
  onNodeClick,
  focusAgentKey,
}: {
  onNodeClick?: (agentKey: string) => void
  focusAgentKey?: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fxCanvasRef = useRef<HTMLCanvasElement>(null)
  const baseCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const fxCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const nodeByIdRef = useRef<Map<string, { x?: number; y?: number }>>(new Map())
  const animatorRef = useRef(new PacketAnimator())
  const seenDenEventIdsRef = useRef<Set<string>>(new Set())
  const sampleSeqRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const selectionRafRef = useRef<number | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const transformRef = useRef<ZoomTransform>(zoomIdentity)
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const selectedAgentKeyRef = useRef<string | null>(null)
  const drawRef = useRef<(() => void) | null>(null)
  const selectionLastFrameAtRef = useRef(0)
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

  const handleClickCapture = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = hitTest(e.clientX, e.clientY)
    if (node && onNodeClick) {
      onNodeClick(`${node.chainId}:${node.agentId}`)
    }
  }, [hitTest, onNodeClick])

  const stopFxLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startFxLoop = useCallback(() => {
    if (rafRef.current != null) return

    const frame = (now: number) => {
      const fxCanvas = fxCanvasRef.current
      const fxCtx = fxCtxRef.current
      if (!fxCanvas || !fxCtx) {
        rafRef.current = null
        return
      }

      animatorRef.current.tick(now)

      fxCtx.setTransform(1, 0, 0, 1, 0, 0)
      fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height)

      if (animatorRef.current.hasActive()) {
        const dpr = getCanvasDpr()
        const t = transformRef.current
        animatorRef.current.render(
          fxCtx,
          { k: t.k * dpr, x: t.x * dpr, y: t.y * dpr },
          nodeByIdRef.current,
          now,
        )
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(frame)
  }, [])

  const stopSelectionLoop = useCallback(() => {
    if (selectionRafRef.current != null) {
      cancelAnimationFrame(selectionRafRef.current)
      selectionRafRef.current = null
    }
  }, [])

  const startSelectionLoop = useCallback(() => {
    if (selectionRafRef.current != null) return
    const frame = (now: number) => {
      // Cap pulse redraw to ~24 FPS to reduce idle GPU/CPU load.
      if (now - selectionLastFrameAtRef.current >= 42) {
        selectionLastFrameAtRef.current = now
        drawRef.current?.()
      }
      selectionRafRef.current = requestAnimationFrame(frame)
    }
    selectionRafRef.current = requestAnimationFrame(frame)
  }, [])

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
    const dpr = getCanvasDpr()
    canvas.width = width * dpr
    canvas.height = height * dpr
    fxCanvas.width = width * dpr
    fxCanvas.height = height * dpr
    baseCtx2.setTransform(dpr, 0, 0, dpr, 0, 0)
    fxCtx2.setTransform(dpr, 0, 0, dpr, 0, 0)

    const prevPositions = nodeByIdRef.current
    const nodes: SimNode[] = Array.from(nodesMap.values()).map((n) => {
      const prev = prevPositions.get(n.id)
      return {
        ...n,
        x: prev?.x ?? n.x,
        y: prev?.y ?? n.y,
      }
    })
    nodesRef.current = nodes
    nodeByIdRef.current = new Map(nodes.map((n) => [n.id, n]))

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
      fxCtx2.setTransform(1, 0, 0, 1, 0, 0)
      fxCtx2.clearRect(0, 0, fxCanvas.width, fxCanvas.height)
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

    function draw() {
      const t = transformRef.current
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220)
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
        const isSelected = node.id === selectedAgentKeyRef.current
        baseCtx2.beginPath()
        baseCtx2.arc(node.x, node.y!, radius, 0, Math.PI * 2)
        baseCtx2.fillStyle = getNodeColor(node.id)
        baseCtx2.fill()
        baseCtx2.strokeStyle = '#222222'
        baseCtx2.lineWidth = 1.5 / t.k
        baseCtx2.stroke()

        if (isSelected) {
          const halo = 4 + pulse * 4
          baseCtx2.beginPath()
          baseCtx2.arc(node.x, node.y!, radius + halo / t.k, 0, Math.PI * 2)
          baseCtx2.strokeStyle = '#ffffff'
          baseCtx2.lineWidth = 2 / t.k
          baseCtx2.stroke()
        }

        // Label
        baseCtx2.fillStyle = isSelected ? '#f5f5f5' : '#888888'
        baseCtx2.font = `${10 / t.k}px monospace`
        baseCtx2.textAlign = 'center'
        baseCtx2.fillText(`#${node.agentId}`, node.x, node.y! + radius + 12 / t.k)
      }

      baseCtx2.restore()
    }

    // Setup d3-zoom
    drawRef.current = draw
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

    // Spawn packets from newly observed feedback events.
    const denEvents = eventsFromEdges(edges, 0, Date.now())
    let spawned = 0
    for (const ev of denEvents) {
      if (seenDenEventIdsRef.current.has(ev.id)) continue
      seenDenEventIdsRef.current.add(ev.id)
      animatorRef.current.spawn(ev)
      spawned++
    }
    if (spawned > 0) startFxLoop()

    return () => {
      sim.stop()
      select(canvas).on('.zoom', null)
      stopFxLoop()
      stopSelectionLoop()
      drawRef.current = null
      baseCtxRef.current = null
      fxCtxRef.current = null
    }
  }, [nodesMap, edges, fitToView, startFxLoop, stopFxLoop, stopSelectionLoop])

  useEffect(() => {
    if (edges.length === 0) {
      seenDenEventIdsRef.current.clear()
    }
  }, [edges.length])

  useEffect(() => {
    selectedAgentKeyRef.current = focusAgentKey ?? null
    if (focusAgentKey) startSelectionLoop()
    else stopSelectionLoop()
    drawRef.current?.()
  }, [focusAgentKey, startSelectionLoop, stopSelectionLoop])

  useEffect(() => {
    if (!focusAgentKey || !zoomRef.current || !canvasRef.current) return
    const node = nodeByIdRef.current.get(focusAgentKey)
    if (!node || node.x == null || node.y == null) return

    const canvas = canvasRef.current
    const { width, height } = canvas.getBoundingClientRect()
    const current = transformRef.current
    const scale = Math.max(current.k, 1)

    const next = zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-node.x, -node.y)

    select(canvas).call(zoomRef.current.transform, next)
  }, [focusAgentKey])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (process.env.NEXT_PUBLIC_GRAPH_DEBUG_TRAFFIC !== '1') return
    const devTargetId = '__dev_target__'

    const intervalId = window.setInterval(() => {
      const nodes = nodesRef.current
      const values = [1, 0.6, 0, -0.6, -1]
      const value = values[sampleSeqRef.current % values.length]
      const seed = `dev:client:${sampleSeqRef.current % 17}`
      const now = Date.now()
      let targetId: string
      let chainId: number

      if (nodes.length > 0) {
        const node = nodes[Math.floor(Math.random() * nodes.length)]
        targetId = node.id
        chainId = node.chainId
      } else {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const t = transformRef.current
        const x = (rect.width / 2 - t.x) / t.k
        const y = (rect.height / 2 - t.y) / t.k
        nodeByIdRef.current.set(devTargetId, { x, y })
        targetId = devTargetId
        chainId = 0
      }

      const event: DenEvent = {
        id: `dev:${targetId}:${seed}:${sampleSeqRef.current}`,
        ts: now,
        chainId,
        kind: 'feedback',
        sourceId: `${chainId}:${seed}`,
        targetId,
        value,
      }
      sampleSeqRef.current++
      animatorRef.current.spawn(event)
      startFxLoop()
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [startFxLoop])

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        onClickCapture={handleClickCapture}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
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
