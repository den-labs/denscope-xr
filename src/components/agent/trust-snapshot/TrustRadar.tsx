'use client'

import { useState } from 'react'
import {
  DIMENSION_ORDER,
  type DimensionKey,
  type TrustSnapshotData,
} from '@/lib/trust-snapshot/types'
import { DIMENSION_DISPLAY } from './display'

interface TrustRadarProps {
  radar: TrustSnapshotData['radar']
}

const CENTER = 100
const RADIUS = 80
const LEVELS = 4

// Angle for dimension i: start at top (-90°), step 72° clockwise.
function angleFor(i: number): number {
  return (-90 + i * (360 / DIMENSION_ORDER.length)) * (Math.PI / 180)
}

function pointAt(i: number, radius: number): [number, number] {
  const a = angleFor(i)
  return [CENTER + radius * Math.cos(a), CENTER + radius * Math.sin(a)]
}

function polygon(radiusForIndex: (i: number) => number): string {
  return DIMENSION_ORDER.map((_, i) => pointAt(i, radiusForIndex(i)).join(',')).join(' ')
}

export function TrustRadar({ radar }: TrustRadarProps) {
  const [selected, setSelected] = useState<DimensionKey | null>(null)

  const ariaLabel =
    'Trust radar. ' +
    DIMENSION_ORDER.map((k) => `${DIMENSION_DISPLAY[k]} ${radar[k].value}`).join(', ')

  const dataPolygon = polygon((i) => (RADIUS * radar[DIMENSION_ORDER[i]].value) / 100)

  return (
    <section id="radar" className="space-y-3">
      <div className="relative mx-auto w-full max-w-sm">
        <svg viewBox="0 0 200 200" role="img" aria-label={ariaLabel} className="w-full">
          {/* Concentric grid rings */}
          {Array.from({ length: LEVELS }, (_, l) => (
            <polygon
              key={l}
              points={polygon(() => (RADIUS * (l + 1)) / LEVELS)}
              className="fill-none stroke-border"
              strokeWidth={0.5}
            />
          ))}
          {/* Axes */}
          {DIMENSION_ORDER.map((k, i) => {
            const [x, y] = pointAt(i, RADIUS)
            return <line key={k} x1={CENTER} y1={CENTER} x2={x} y2={y} className="stroke-border" strokeWidth={0.5} />
          })}
          {/* Data polygon */}
          <polygon points={dataPolygon} className="fill-accent/20 stroke-accent" strokeWidth={1.5} />
        </svg>
      </div>

      {/* Dimension toggles */}
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {DIMENSION_ORDER.map((k) => {
          const active = selected === k
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => setSelected(active ? null : k)}
                aria-expanded={active}
                className={`flex w-full items-center justify-between gap-1 border px-2 py-1 text-left text-xs transition ${
                  active ? 'border-accent text-text-primary' : 'border-border text-text-secondary hover:border-accent'
                }`}
              >
                <span>{DIMENSION_DISPLAY[k]}</span>
                <span className="font-mono text-text-muted">{radar[k].value}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Expanded rule + evidence */}
      {selected && (
        <div className="space-y-1 border border-border bg-background p-3 text-xs">
          <p className="text-text-secondary">{radar[selected].rule}</p>
          <ul className="space-y-0.5 font-mono text-[10px] text-text-muted">
            {radar[selected].evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-[11px] italic text-text-muted">
        Dimensions interpret the score above — they do not replace it.
      </p>
    </section>
  )
}
