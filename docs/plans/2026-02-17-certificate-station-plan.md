# Certificate Station Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure XRayPanel into a certificate-first persistent right panel so users understand in <5s how to share a Trust Certificate.

**Architecture:** Merge Certificate Station into existing XRayPanel. Panel becomes always-visible (docked) on desktop >=1280px, drawer on mobile. Auto-select first agent on load. Remove hover tooltip (CertificatePreview) since panel is always present.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS, framer-motion, zustand

---

### Task 1: FeedLine — Add Selected State

**Files:**
- Modify: `src/components/feed/FeedLine.tsx`

**Step 1: Add `isSelected` prop and conditional styling**

In `FeedLine.tsx`, add `isSelected` prop to `FeedLineProps` and apply accent border + background when selected:

```tsx
type FeedLineProps = {
  event: ScopeEvent
  isSelected?: boolean
  onClick?: () => void
  onHoverEnter?: (agentKey: string, rect: DOMRect) => void
  onHoverLeave?: () => void
}

export function FeedLine({ event, isSelected, onClick, onHoverEnter, onHoverLeave }: FeedLineProps) {
```

Replace the `className` on the `<button>`:

```tsx
className={`group grid w-full grid-cols-[120px_100px_100px_1fr_120px_auto_auto] items-center gap-0 border-b border-border px-4 py-1.5 text-left font-mono text-sm transition-colors hover:bg-surface-hover cursor-pointer ${
  isSelected
    ? 'bg-surface-hover border-l-2 border-l-accent'
    : 'hover:border-l-2 hover:border-l-accent'
}`}
```

**Step 2: Run build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build passes (no type errors from new prop — it's optional)

**Step 3: Commit**

```bash
git add src/components/feed/FeedLine.tsx
git commit -m "feat(feed): add isSelected prop to FeedLine for active row highlighting"
```

---

### Task 2: LiveFeed — Remove Hover Tooltip, Add selectedAgentKey

**Files:**
- Modify: `src/components/feed/LiveFeed.tsx`

**Step 1: Remove CertificatePreview import and all hover state**

Remove these imports and state:
- Remove `import { CertificatePreview } from './CertificatePreview'`
- Remove `hoveredAgent`, `hoverRect`, `hoverTimerRef`, `leaveTimerRef`, `firstHoverFired` state/refs
- Remove `handleHoverEnter`, `handleHoverLeave`, `handleTooltipEnter`, `handleTooltipLeave` callbacks
- Remove the CertificatePreview render at the bottom

**Step 2: Add `selectedAgentKey` prop**

Update the component signature to accept `selectedAgentKey`:

```tsx
export function LiveFeed({ onAgentClick, onFirstHover, filters, selectedAgentKey }: {
  onAgentClick?: (key: string) => void
  onFirstHover?: () => void
  filters?: FeedFilters
  selectedAgentKey?: string | null
}) {
```

**Step 3: Pass `isSelected` to FeedLine**

In the FeedLine render, pass `isSelected`:

```tsx
<FeedLine
  event={event}
  isSelected={selectedAgentKey === `${event.chainId}:${event.agentId}`}
  onClick={() => onAgentClick?.(`${event.chainId}:${event.agentId}`)}
/>
```

Remove `onHoverEnter` and `onHoverLeave` props from FeedLine (no longer needed for tooltip).

**Step 4: Clean up — remove unused imports**

Remove `useRef, useCallback` from React import if no longer used. Keep `useState, useMemo`.

The full component after changes:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEventStore } from '@/stores/events'
import type { FeedFilters } from '@/hooks/useFeedFilters'
import { FeedLine } from './FeedLine'
import { PulseEffect } from './PulseEffect'

export function LiveFeed({ onAgentClick, onFirstHover, filters, selectedAgentKey }: {
  onAgentClick?: (key: string) => void
  onFirstHover?: () => void
  filters?: FeedFilters
  selectedAgentKey?: string | null
}) {
  const events = useEventStore((s) => s.events)
  const [paused, setPaused] = useState(false)

  const filteredEvents = useMemo(() => {
    if (!filters) return events
    return events.filter((e) => {
      if (filters.kinds.size > 0 && !filters.kinds.has(e.kind)) return false
      if (filters.chainId !== null && e.chainId !== filters.chainId) return false
      if (filters.agentId !== '' && e.agentId !== Number(filters.agentId)) return false
      return true
    })
  }, [events, filters])

  return (
    <div
      className="h-full overflow-y-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Column Headers */}
      <div className="sticky top-0 z-10 grid grid-cols-[120px_100px_100px_1fr_120px_auto_auto] gap-0 border-b border-border bg-surface px-4 py-2">
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Timestamp</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Event Type</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Protocol</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Agent Identity</span>
        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">Tx Hash</span>
        <span />
        <span />
      </div>

      {events.length === 0 ? (
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">Waiting for events...</p>
            <p className="mt-1 text-sm">Listening on ERC-8004 contracts</p>
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex h-full items-center justify-center text-text-muted">
          <div className="text-center">
            <p className="text-lg">No events match filters</p>
            <p className="mt-1 text-sm">Try adjusting your filter criteria</p>
          </div>
        </div>
      ) : (
        <div className="py-0">
          <AnimatePresence initial={false}>
            {filteredEvents.map((event) => (
              <motion.div
                key={`${event.txHash}:${event.logIndex}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PulseEffect>
                  <FeedLine
                    event={event}
                    isSelected={selectedAgentKey === `${event.chainId}:${event.agentId}`}
                    onClick={() => onAgentClick?.(`${event.chainId}:${event.agentId}`)}
                  />
                </PulseEffect>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {paused && (
        <div className="pointer-events-none fixed bottom-12 left-1/2 -translate-x-1/2">
          <span className="bg-surface border border-border px-3 py-1 text-xs text-text-muted font-mono">paused -- move mouse away to resume</span>
        </div>
      )}
    </div>
  )
}
```

**Step 5: Run build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build passes

**Step 6: Commit**

```bash
git add src/components/feed/LiveFeed.tsx
git commit -m "refactor(feed): remove hover tooltip, add selectedAgentKey for persistent panel"
```

---

### Task 3: XRayPanel — Certificate-First Layout with Empty State

**Files:**
- Modify: `src/components/xray/XRayPanel.tsx`

**Step 1: Update props to support docked mode**

```tsx
type XRayPanelProps = {
  agentKey: string | null
  onClose: () => void
  isDocked?: boolean
}
```

**Step 2: Rewrite component with certificate-first layout**

The restructured panel has this order:
1. Header: `TRUST CERTIFICATE` + close button
2. Certificate preview (OG card thumbnail): agent name, chain badge, feedback ratio
3. Primary CTA: `Share Certificate` (full-width, dominant)
4. Secondary CTA: `View Full Report →`
5. Micro-data: owner | feedback | snapshot (1 line)
6. Divider
7. Existing detail sections (AgentIdentity, AgentServices) scrollable below

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { fetchAgentMetadata } from '@/lib/agent/metadata'
import { ChainBadge } from '@/components/shared/ChainBadge'
import { AgentIdentity } from './AgentIdentity'
import { AgentServices } from './AgentServices'
import {
  buildXIntentUrl,
  buildCertificateShareText,
  buildOwnerShareText,
} from '@/lib/share'
import type { AgentMetadata } from '@/types/agents'

type XRayPanelProps = { agentKey: string | null; onClose: () => void; isDocked?: boolean }

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function XRayPanel({ agentKey, onClose, isDocked }: XRayPanelProps) {
  const agent = useAgentStore((s) => (agentKey ? s.agents.get(agentKey) : undefined))
  const cacheMetadata = useAgentStore((s) => s.cacheMetadata)
  const [metadata, setMetadata] = useState<AgentMetadata | null>(agent?.metadata ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (!agent?.agentURI) return
    if (agent.metadata) {
      setMetadata(agent.metadata)
      return
    }
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
        if (result && agentKey) cacheMetadata(agentKey, result)
      })
      .finally(() => setLoading(false))
  }, [agent?.agentURI, agent?.metadata, agentKey, cacheMetadata])

  const enriched = agent ? { ...agent, metadata: metadata ?? agent.metadata } : null

  function retry() {
    if (!agent?.agentURI) return
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
        if (result && agentKey) cacheMetadata(agentKey, result)
      })
      .finally(() => setLoading(false))
  }

  const name = enriched?.metadata?.name ?? (enriched ? `Agent #${enriched.agentId}` : '')
  const shareInput = enriched
    ? { chainId: enriched.chainId, agentId: enriched.agentId, name: enriched.metadata?.name }
    : null

  function handleShare() {
    if (!shareInput) return
    setShareOpen(!shareOpen)
  }

  // Empty state content
  const emptyContent = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-lg font-bold text-text-primary">
        Generate a Trust Certificate
      </p>
      <p className="mt-2 font-mono text-xs text-text-secondary">
        Click any agent to preview and share.
      </p>
      <button
        disabled
        className="mt-6 w-full border border-border bg-surface px-4 py-3 text-sm font-mono font-bold text-text-muted cursor-not-allowed"
      >
        Share Certificate
      </button>
    </div>
  )

  // Certificate-first content
  const certificateContent = enriched && shareInput && (
    <>
      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-4 pt-2">
            <div className="h-6 w-48 bg-surface" />
            <div className="h-4 w-64 bg-surface" />
          </div>
        ) : (
          <>
            {/* Certificate Preview Card */}
            <div className="border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-text-primary truncate">
                  {name}
                </span>
                <ChainBadge chainId={enriched.chainId} />
              </div>
              {enriched.metadata?.description && (
                <p className="text-sm text-text-secondary line-clamp-2">
                  {enriched.metadata.description}
                </p>
              )}
              <div className="font-mono text-xs text-text-secondary">
                {enriched.feedbackCount > 0 ? (
                  <span>
                    Positive: <span className="text-success">{Math.round((enriched.positiveFeedback / enriched.feedbackCount) * 100)}%</span>
                    {' '}({enriched.feedbackCount} total)
                  </span>
                ) : (
                  <span className="text-text-muted">Awaiting feedback</span>
                )}
              </div>
            </div>

            {/* Primary CTA — Share Certificate */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="w-full border border-text-primary bg-text-primary px-4 py-3 text-sm font-mono font-bold text-bg hover:bg-transparent hover:text-text-primary transition-colors"
              >
                Share Certificate
              </button>
              {shareOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 flex flex-col border border-border-bright bg-surface shadow-lg">
                  <a
                    href={buildXIntentUrl(buildCertificateShareText(shareInput))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShareOpen(false)}
                    className="px-4 py-2.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
                  >
                    Share Certificate
                  </a>
                  <a
                    href={buildXIntentUrl(buildOwnerShareText(shareInput))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShareOpen(false)}
                    className="px-4 py-2.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left border-t border-border"
                  >
                    I Own This Agent
                  </a>
                </div>
              )}
            </div>

            {/* Secondary CTA */}
            <a
              href={`/agent/${enriched.chainId}/${enriched.agentId}`}
              className="block text-center font-mono text-xs text-text-muted hover:text-accent transition-colors"
            >
              View Full Report &rarr;
            </a>

            {/* Micro-data (1 line) */}
            <p className="font-mono text-[10px] text-text-muted truncate">
              Owner {truncateAddress(enriched.owner)} | +{enriched.positiveFeedback} / -{enriched.negativeFeedback} | Snapshot {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
            </p>

            {error && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-mono">Metadata unavailable</span>
                <button onClick={retry} className="text-xs text-accent font-mono hover:underline">Retry</button>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Existing detail sections */}
            <AgentIdentity agent={enriched} />
            <AgentServices metadata={enriched.metadata} />
          </>
        )}
      </div>
    </>
  )

  // Docked mode: always render panel (no AnimatePresence wrapper for show/hide)
  if (isDocked) {
    return (
      <div className="flex h-full w-96 flex-col border-l border-border bg-bg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            TRUST CERTIFICATE
          </span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xs">
            ✕
          </button>
        </div>
        {enriched ? certificateContent : emptyContent}
      </div>
    )
  }

  // Drawer mode (mobile): animated slide-in, only when agent selected
  return (
    <AnimatePresence>
      {agentKey && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 z-50 flex h-full w-96 max-w-[90vw] flex-col border-l border-border bg-bg shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              TRUST CERTIFICATE
            </span>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xs">
              ✕
            </button>
          </div>
          {enriched ? certificateContent : emptyContent}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Step 3: Run build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build passes

**Step 4: Commit**

```bash
git add src/components/xray/XRayPanel.tsx
git commit -m "feat(xray): restructure panel to certificate-first layout with empty state"
```

---

### Task 4: Page — Persistent Docked Panel, Auto-Select, Responsive

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add useEffect for auto-select and useMediaQuery for breakpoint**

```tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { LiveFeed } from '@/components/feed/LiveFeed'
import { FeedFiltersBar } from '@/components/feed/FeedFilters'
import { FeedHint } from '@/components/feed/FeedHint'
import { XRayPanel } from '@/components/xray/XRayPanel'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'
import { useFeedFilters } from '@/hooks/useFeedFilters'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

export default function FeedPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [hintDismissed, setHintDismissed] = useState(false)
  const events = useEventStore((s) => s.events)
  const agents = useAgentStore((s) => s.agents)
  const agentCount = agents.size
  const headBlock = events.length > 0 ? events[0].block : 0
  const { filters, setFilters } = useFeedFilters()
  const isDesktop = useMediaQuery('(min-width: 1280px)')

  // Auto-select first agent when events arrive and no selection yet
  useEffect(() => {
    if (selectedAgent) return
    if (events.length === 0) return
    const first = events[0]
    setSelectedAgent(`${first.chainId}:${first.agentId}`)
  }, [events, selectedAgent])

  const filteredCount = useMemo(() => {
    const hasFilter = filters.kinds.size > 0 || filters.chainId !== null || filters.agentId !== ''
    if (!hasFilter) return null
    return events.filter((e) => {
      if (filters.kinds.size > 0 && !filters.kinds.has(e.kind)) return false
      if (filters.chainId !== null && e.chainId !== filters.chainId) return false
      if (filters.agentId !== '' && e.agentId !== Number(filters.agentId)) return false
      return true
    }).length
  }, [events, filters])

  return (
    <div className="flex h-full flex-col">
      {/* Page Title */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider">
          LIVE FEED
        </h1>
        <p className="text-text-secondary text-xs uppercase tracking-widest font-mono">
          REAL-TIME AGENT OBSERVABILITY LAYER
        </p>
      </div>

      {/* Stat Strip */}
      <div className="grid grid-cols-3 border-b border-border">
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Head Block</p>
          <p className="text-sm font-mono text-text-primary">{headBlock > 0 ? headBlock.toLocaleString() : '\u2014'}</p>
        </div>
        <div className="bg-surface border-r border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Agents</p>
          <p className="text-sm font-mono text-text-primary">{agentCount}</p>
        </div>
        <div className="bg-surface border-border px-4 py-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Events</p>
          <p className="text-sm font-mono text-text-primary">
            {filteredCount !== null ? `${filteredCount} / ${events.length}` : events.length}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FeedFiltersBar filters={filters} onChange={setFilters} />

      {/* Feed Hint */}
      <FeedHint dismissed={hintDismissed} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <LiveFeed
            onAgentClick={setSelectedAgent}
            onFirstHover={() => setHintDismissed(true)}
            filters={filters}
            selectedAgentKey={selectedAgent}
          />
        </div>
        <XRayPanel
          agentKey={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          isDocked={isDesktop}
        />
      </div>

      {/* Bottom gradient fade overlay */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg to-transparent" />
    </div>
  )
}
```

Key changes:
- `useMediaQuery('(min-width: 1280px)')` determines docked vs drawer
- `useEffect` auto-selects first agent from events when none selected
- Pass `selectedAgentKey` to LiveFeed for row highlighting
- Pass `isDocked` to XRayPanel for persistent vs animated mode

**Step 2: Run full test suite + build**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test && pnpm build`
Expected: All 153 tests pass, build succeeds

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(page): persistent docked panel with auto-select and responsive breakpoint"
```

---

### Task 5: Cleanup — Remove Unused CertificatePreview

**Files:**
- Delete: `src/components/feed/CertificatePreview.tsx`

**Step 1: Verify no other imports of CertificatePreview**

Run: `grep -r "CertificatePreview" src/ --include="*.tsx" --include="*.ts"`
Expected: Only the file itself (no remaining imports after Task 2 changes)

**Step 2: Delete the file**

```bash
rm src/components/feed/CertificatePreview.tsx
```

**Step 3: Run build to verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build passes

**Step 4: Commit**

```bash
git add -A src/components/feed/CertificatePreview.tsx
git commit -m "refactor(feed): remove CertificatePreview hover tooltip (replaced by docked panel)"
```

---

### Task 6: Final Verification

**Step 1: Run full test suite**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test`
Expected: All 153 tests pass

**Step 2: Run production build**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build passes with zero errors

**Step 3: Verify git log**

Run: `git log --oneline -5`
Expected: 4 commits for this feature + 1 design doc commit

**Step 4: Manual QA checklist** (dev server)

Run: `pnpm dev` and verify against acceptance criteria:
1. Desktop: panel appears docked with agent auto-selected on load
2. Certificate preview + Share button visible without extra clicks
3. Row click updates panel and highlights active row
4. Share Certificate opens X intent dropdown
5. View Full Report links to `/agent/[chain]/[id]`
6. Description clamped to 2 lines
7. Micro-data is 1 line, truncated
8. Resize to <1280px: panel becomes drawer
