import { easeOutCubic, clamp } from './math'
import { ghostPos } from './ghostEmitter'
import type { DenEvent } from './types'

type TransformLike = { k: number; x: number; y: number }
type NodeLike = { x?: number; y?: number }

export type Packet = {
  id: string
  t0: number
  dur: number
  sourceSeed: string
  targetId: string
  value: number
  arrived?: boolean
}

const MAX_PACKETS = 200
const MAX_PULSES = 300

type Pulse = {
  targetId: string
  t0: number
  dur: number
  intensity: number
  value: number
}

export class PacketAnimator {
  private packets: Packet[] = []
  private pulses: Pulse[] = []

  spawn(event: DenEvent, now = performance.now()): void {
    const mag = Math.min(Math.abs(event.value), 3)
    const dur = clamp(1200 - mag * 130, 800, 1200)
    this.packets.push({
      id: event.id,
      t0: now,
      dur,
      sourceSeed: event.sourceId,
      targetId: event.targetId,
      value: event.value,
    })

    if (this.packets.length > MAX_PACKETS) {
      this.packets.splice(0, this.packets.length - MAX_PACKETS)
    }
  }

  tick(now: number): void {
    this.packets = this.packets.filter((p) => now - p.t0 <= p.dur)
    this.pulses = this.pulses.filter((p) => now - p.t0 <= p.dur)
  }

  hasActive(): boolean {
    return this.packets.length > 0 || this.pulses.length > 0
  }

  private enqueuePulse(targetId: string, value: number, now: number): void {
    const intensity = Math.min(Math.abs(value), 3)
    this.pulses.push({
      targetId,
      value,
      t0: now,
      dur: 520 + intensity * 120,
      intensity,
    })
    if (this.pulses.length > MAX_PULSES) {
      this.pulses.splice(0, this.pulses.length - MAX_PULSES)
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    transform: TransformLike,
    nodeById: Map<string, NodeLike>,
    now: number,
  ): void {
    ctx.setTransform(transform.k, 0, 0, transform.k, transform.x, transform.y)

    for (const pulse of this.pulses) {
      const target = nodeById.get(pulse.targetId)
      if (!target || target.x == null || target.y == null) continue
      const p = clamp((now - pulse.t0) / pulse.dur, 0, 1)
      const color =
        pulse.value > 0 ? '80, 220, 140'
        : pulse.value < 0 ? '255, 80, 80'
        : '170, 170, 170'
      const r = 6 + pulse.intensity * 2 + 22 * p
      const alpha = (1 - p) * (0.42 + pulse.intensity * 0.08)

      ctx.strokeStyle = `rgba(${color}, ${alpha})`
      ctx.lineWidth = 1.2 + pulse.intensity * 0.45
      ctx.beginPath()
      ctx.arc(target.x, target.y, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    for (const packet of this.packets) {
      const target = nodeById.get(packet.targetId)
      if (!target || target.x == null || target.y == null) continue

      const mag = Math.min(Math.abs(packet.value), 3)
      const p = clamp((now - packet.t0) / packet.dur, 0, 1)
      const e = easeOutCubic(p)
      const ePrev = easeOutCubic(Math.max(0, p - 0.12))
      if (p >= 1 && !packet.arrived) {
        packet.arrived = true
        this.enqueuePulse(packet.targetId, packet.value, now)
      }

      const source = ghostPos(target.x, target.y, packet.sourceSeed, mag)
      const x = source.x + (target.x - source.x) * e
      const y = source.y + (target.y - source.y) * e
      const tx = source.x + (target.x - source.x) * ePrev
      const ty = source.y + (target.y - source.y) * ePrev

      const color =
        packet.value > 0 ? '80, 220, 140'
        : packet.value < 0 ? '255, 80, 80'
        : '170, 170, 170'
      const radius = 1.8 + mag * 0.9
      const glow = 6 + mag * 6

      ctx.strokeStyle = `rgba(${color}, ${0.25 + mag * 0.1})`
      ctx.lineWidth = 0.7 + mag * 0.25
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(x, y)
      ctx.stroke()

      ctx.shadowColor = `rgba(${color}, 0.8)`
      ctx.shadowBlur = glow
      ctx.fillStyle = `rgba(${color}, 0.95)`
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }
}
