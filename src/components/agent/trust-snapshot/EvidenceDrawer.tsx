'use client'

import { useState, type ReactNode } from 'react'

interface EvidenceDrawerProps {
  children: ReactNode
}

/**
 * Collapsed-by-default drawer wrapping the raw evidence surfaces (Identity Card,
 * Connected Protocols, Event Timeline). Anchor target for the `#evidence` CTA.
 */
export function EvidenceDrawer({ children }: EvidenceDrawerProps) {
  const [open, setOpen] = useState(false)

  return (
    <section id="evidence" className="border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <span className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
          Evidence
        </span>
        <span className="font-mono text-xs text-text-muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-4 border-t border-border p-3">{children}</div>}
    </section>
  )
}
