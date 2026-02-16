# Dossier Lite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the agent page from a data registry into an operational dossier with Insight (trust snapshot, what changed), Context (status, metrics), reordered Agency (claim/watch primary), and fix the timestamp bug.

**Architecture:** Server-side data fetching in the agent page (SSR) queries `agents`, `trust_scores`, `scope_events`, and `incidents` tables via Supabase REST. Pure helper functions compute status, relative time, activity summary, and sybil risk — all unit tested. New presentational components (`StatusPill`, `TrustSnapshot`, `WhatChanged`) compose into the redesigned agent page. The timestamp fix is a one-line change in the Edge Function + a backfill migration.

**Tech Stack:** Next.js 16 (App Router, SSR), TypeScript, Tailwind CSS, Supabase REST API, vitest

---

### Task 1: Fix timestamp bug in Edge Function

**Files:**
- Modify: `supabase/functions/erc8004-poller/index.ts:83,104`

**Step 1: Fix `parseIdentityLog`**

In `supabase/functions/erc8004-poller/index.ts`, change line 83:

```typescript
// Before:
    event_timestamp: null,

// After:
    event_timestamp: new Date().toISOString(),
```

**Step 2: Fix `parseReputationLog`**

Same file, change line 104:

```typescript
// Before:
    event_timestamp: null,

// After:
    event_timestamp: new Date().toISOString(),
```

**Step 3: Commit**

```bash
git add supabase/functions/erc8004-poller/index.ts
git commit -m "fix: populate event_timestamp in Edge Function

Events were inserted with event_timestamp: null, causing empty
timestamps on page reload. Now set to ingestion time."
```

---

### Task 2: Backfill existing timestamps + deploy

**Files:**
- Create: `supabase/migrations/20260216040000_backfill_event_timestamps.sql`

**Step 1: Create backfill migration**

```sql
-- Backfill: set event_timestamp to created_at for all rows where it's NULL
UPDATE scope_events
SET event_timestamp = created_at
WHERE event_timestamp IS NULL;
```

**Step 2: Apply migration**

```bash
supabase db push
```

Expected: `Do you want to push these migrations? ... Applied`

**Step 3: Deploy Edge Function**

```bash
supabase functions deploy erc8004-poller --no-verify-jwt
```

Expected: `Deployed Functions on project ioxjqabngtannnfsueqa: erc8004-poller`

**Step 4: Verify timestamps exist**

```bash
curl -s "https://ioxjqabngtannnfsueqa.supabase.co/rest/v1/scope_events?select=event_timestamp&limit=3&order=block_number.desc" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" | jq
```

Expected: All rows should have non-null `event_timestamp` values.

**Step 5: Commit**

```bash
git add supabase/migrations/20260216040000_backfill_event_timestamps.sql
git commit -m "fix(db): backfill event_timestamp from created_at"
```

---

### Task 3: Dossier pure helpers (status, relative time, sybil risk)

**Files:**
- Create: `src/lib/dossier/helpers.ts`
- Create: `src/lib/dossier/__tests__/helpers.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/dossier/__tests__/helpers.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getAgentStatus,
  formatRelativeTime,
  getSybilRisk,
  summarizeActivity,
} from '@/lib/dossier/helpers'

describe('getAgentStatus', () => {
  it('returns "new" when score is null', () => {
    expect(getAgentStatus(null)).toEqual({ label: 'NEW', variant: 'neutral' })
  })

  it('returns "healthy" for score >= 60', () => {
    expect(getAgentStatus(75)).toEqual({ label: 'HEALTHY', variant: 'success' })
  })

  it('returns "warning" for score 30-59', () => {
    expect(getAgentStatus(45)).toEqual({ label: 'WARNING', variant: 'warning' })
  })

  it('returns "critical" for score < 30', () => {
    expect(getAgentStatus(15)).toEqual({ label: 'CRITICAL', variant: 'critical' })
  })

  it('returns "healthy" at boundary 60', () => {
    expect(getAgentStatus(60)).toEqual({ label: 'HEALTHY', variant: 'success' })
  })

  it('returns "warning" at boundary 30', () => {
    expect(getAgentStatus(30)).toEqual({ label: 'WARNING', variant: 'warning' })
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => { vi.useRealTimers() })

  it('returns "—" for null', () => {
    expect(formatRelativeTime(null)).toBe('—')
  })

  it('returns "just now" for <1 minute', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    expect(formatRelativeTime('2026-02-16T11:59:30Z')).toBe('just now')
  })

  it('returns "Xm ago" for minutes', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    expect(formatRelativeTime('2026-02-16T11:45:00Z')).toBe('15m ago')
  })

  it('returns "Xh ago" for hours', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    expect(formatRelativeTime('2026-02-16T09:00:00Z')).toBe('3h ago')
  })

  it('returns "Xd ago" for days', () => {
    vi.useFakeTimers({ now: new Date('2026-02-16T12:00:00Z') })
    expect(formatRelativeTime('2026-02-13T12:00:00Z')).toBe('3d ago')
  })
})

describe('getSybilRisk', () => {
  it('returns "low" when no sybil incidents', () => {
    expect(getSybilRisk({ openSybil: 0, resolvedSybil: 0 })).toEqual({
      level: 'LOW', variant: 'success',
    })
  })

  it('returns "high" when open sybil incident exists', () => {
    expect(getSybilRisk({ openSybil: 1, resolvedSybil: 0 })).toEqual({
      level: 'HIGH', variant: 'critical',
    })
  })

  it('returns "medium" when only resolved sybil', () => {
    expect(getSybilRisk({ openSybil: 0, resolvedSybil: 1 })).toEqual({
      level: 'MEDIUM', variant: 'warning',
    })
  })
})

describe('summarizeActivity', () => {
  it('returns registration line for registered agent', () => {
    const items = summarizeActivity({
      firstSeen: '2026-02-10T00:00:00Z',
      lastSeen: '2026-02-16T00:00:00Z',
      totalEvents: 5,
      feedbackCount: 3,
      positiveCount: 2,
      negativeCount: 1,
      uriUpdateCount: 1,
      avgFeedbackValue: 42,
    })
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items[0]).toContain('Registered')
  })

  it('includes feedback line when feedbackCount > 0', () => {
    const items = summarizeActivity({
      firstSeen: '2026-02-10T00:00:00Z',
      lastSeen: '2026-02-16T00:00:00Z',
      totalEvents: 10,
      feedbackCount: 5,
      positiveCount: 4,
      negativeCount: 1,
      uriUpdateCount: 0,
      avgFeedbackValue: 75,
    })
    expect(items.some(i => i.includes('feedback'))).toBe(true)
  })

  it('includes URI line when uriUpdateCount > 0', () => {
    const items = summarizeActivity({
      firstSeen: '2026-02-10T00:00:00Z',
      lastSeen: '2026-02-16T00:00:00Z',
      totalEvents: 2,
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      uriUpdateCount: 2,
      avgFeedbackValue: 0,
    })
    expect(items.some(i => i.includes('URI updated'))).toBe(true)
  })

  it('returns "Awaiting activity" when no events', () => {
    const items = summarizeActivity({
      firstSeen: '2026-02-16T00:00:00Z',
      lastSeen: null,
      totalEvents: 1,
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      uriUpdateCount: 0,
      avgFeedbackValue: 0,
    })
    expect(items.some(i => i.includes('Awaiting'))).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test src/lib/dossier/__tests__/helpers.test.ts
```

Expected: FAIL — module `@/lib/dossier/helpers` not found.

**Step 3: Write the implementation**

```typescript
// src/lib/dossier/helpers.ts

export type AgentStatus = {
  label: 'NEW' | 'HEALTHY' | 'WARNING' | 'CRITICAL'
  variant: 'neutral' | 'success' | 'warning' | 'critical'
}

export function getAgentStatus(score: number | null): AgentStatus {
  if (score === null) return { label: 'NEW', variant: 'neutral' }
  if (score >= 60) return { label: 'HEALTHY', variant: 'success' }
  if (score >= 30) return { label: 'WARNING', variant: 'warning' }
  return { label: 'CRITICAL', variant: 'critical' }
}

export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export type SybilRisk = {
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  variant: 'success' | 'warning' | 'critical'
}

export function getSybilRisk(incidents: {
  openSybil: number
  resolvedSybil: number
}): SybilRisk {
  if (incidents.openSybil > 0) return { level: 'HIGH', variant: 'critical' }
  if (incidents.resolvedSybil > 0) return { level: 'MEDIUM', variant: 'warning' }
  return { level: 'LOW', variant: 'success' }
}

export type ActivitySummary = {
  firstSeen: string | null
  lastSeen: string | null
  totalEvents: number
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  uriUpdateCount: number
  avgFeedbackValue: number
}

export function summarizeActivity(data: ActivitySummary): string[] {
  const items: string[] = []

  if (data.firstSeen) {
    const days = Math.floor(
      (Date.now() - new Date(data.firstSeen).getTime()) / (24 * 60 * 60 * 1000)
    )
    items.push(days === 0 ? 'Registered today' : `Registered ${days}d ago`)
  }

  if (data.uriUpdateCount > 0) {
    items.push(
      data.uriUpdateCount === 1
        ? 'URI updated 1 time'
        : `URI updated ${data.uriUpdateCount} times`
    )
  }

  if (data.feedbackCount > 0) {
    const avg = data.avgFeedbackValue > 0 ? `+${data.avgFeedbackValue}` : `${data.avgFeedbackValue}`
    items.push(`Received ${data.feedbackCount} feedback (avg ${avg})`)
  }

  if (data.feedbackCount === 0 && data.uriUpdateCount === 0 && data.totalEvents <= 1) {
    items.push('Awaiting activity — this agent was recently registered')
  }

  return items
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test src/lib/dossier/__tests__/helpers.test.ts
```

Expected: All 16 tests PASS.

**Step 5: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass (previous 104 + 16 new = 120).

**Step 6: Commit**

```bash
git add src/lib/dossier/helpers.ts src/lib/dossier/__tests__/helpers.test.ts
git commit -m "feat: dossier helpers — status, relative time, sybil risk, activity summary"
```

---

### Task 4: Dossier data fetcher (SSR)

**Files:**
- Create: `src/lib/dossier/fetch.ts`

This function runs server-side in the agent page to fetch all dossier data in parallel.

**Step 1: Write the implementation**

```typescript
// src/lib/dossier/fetch.ts

export type DossierData = {
  // From agents table
  firstSeen: string | null
  lastSeen: string | null
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  // Computed from scope_events
  totalEvents: number
  uriUpdateCount: number
  uniqueInteractors: number
  avgFeedbackValue: number
  // From incidents
  openSybilCount: number
  resolvedSybilCount: number
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

async function supabaseGet(path: string): Promise<unknown> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    next: { revalidate: 60 },
  })
  return res.json()
}

export async function fetchDossierData(
  chainId: number,
  agentId: number
): Promise<DossierData> {
  const agentKey = `${chainId}:${agentId}`

  const [agentRes, eventsRes, feedbackRes, sybilOpenRes, sybilResolvedRes] =
    await Promise.all([
      // Agent stats
      supabaseGet(
        `agents?id=eq.${encodeURIComponent(agentKey)}&select=first_seen,last_seen,feedback_count,positive_count,negative_count`
      ) as Promise<Array<Record<string, unknown>>>,
      // Event counts by kind
      supabaseGet(
        `scope_events?chain_id=eq.${chainId}&agent_id=eq.${agentId}&select=kind`
      ) as Promise<Array<{ kind: string }>>,
      // Feedback values for avg calculation
      supabaseGet(
        `scope_events?chain_id=eq.${chainId}&agent_id=eq.${agentId}&kind=eq.feedback&select=data`
      ) as Promise<Array<{ data: { clientAddress?: string; value?: string } }>>,
      // Open sybil incidents
      supabaseGet(
        `incidents?chain_id=eq.${chainId}&agent_id=eq.${agentId}&signal_kind=eq.sybil_cluster&resolved_at=is.null&select=id`
      ) as Promise<Array<unknown>>,
      // Resolved sybil incidents
      supabaseGet(
        `incidents?chain_id=eq.${chainId}&agent_id=eq.${agentId}&signal_kind=eq.sybil_cluster&resolved_at=not.is.null&select=id`
      ) as Promise<Array<unknown>>,
    ])

  const agent = Array.isArray(agentRes) && agentRes.length > 0 ? agentRes[0] : null
  const events = Array.isArray(eventsRes) ? eventsRes : []
  const feedbacks = Array.isArray(feedbackRes) ? feedbackRes : []

  // Count URI updates
  const uriUpdateCount = events.filter((e) => e.kind === 'uri_update').length

  // Unique interactors
  const addresses = new Set(
    feedbacks
      .map((f) => f.data?.clientAddress)
      .filter(Boolean)
  )

  // Average feedback value
  let avgFeedbackValue = 0
  if (feedbacks.length > 0) {
    const total = feedbacks.reduce((sum, f) => {
      return sum + Number(f.data?.value ?? 0)
    }, 0)
    avgFeedbackValue = Math.round(total / feedbacks.length)
  }

  return {
    firstSeen: (agent?.first_seen as string) ?? null,
    lastSeen: (agent?.last_seen as string) ?? null,
    feedbackCount: (agent?.feedback_count as number) ?? 0,
    positiveCount: (agent?.positive_count as number) ?? 0,
    negativeCount: (agent?.negative_count as number) ?? 0,
    totalEvents: events.length,
    uriUpdateCount,
    uniqueInteractors: addresses.size,
    avgFeedbackValue,
    openSybilCount: Array.isArray(sybilOpenRes) ? sybilOpenRes.length : 0,
    resolvedSybilCount: Array.isArray(sybilResolvedRes) ? sybilResolvedRes.length : 0,
  }
}
```

**Step 2: Verify build**

```bash
pnpm build
```

Expected: Clean build (the fetcher is not used yet, but TS should compile).

**Step 3: Commit**

```bash
git add src/lib/dossier/fetch.ts
git commit -m "feat: dossier data fetcher — SSR parallel queries for agent metrics"
```

---

### Task 5: StatusPill component

**Files:**
- Create: `src/components/agent/StatusPill.tsx`

**Step 1: Write the component**

```typescript
// src/components/agent/StatusPill.tsx
import type { AgentStatus } from '@/lib/dossier/helpers'

export function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <span className={`status-pill status-pill-${status.variant}`}>
      {status.label}
    </span>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/agent/StatusPill.tsx
git commit -m "feat: StatusPill component for agent operational status"
```

---

### Task 6: TrustSnapshot component

**Files:**
- Create: `src/components/agent/TrustSnapshot.tsx`

This replaces the separate "Connected Protocols" + "Trust Score" cards with a unified insight grid.

**Step 1: Write the component**

```typescript
// src/components/agent/TrustSnapshot.tsx
import type { TrustScore } from '@/types/trust-score'
import type { SybilRisk } from '@/lib/dossier/helpers'

type Props = {
  trustScore: TrustScore | null
  sybilRisk: SybilRisk
  uniqueInteractors: number
  storageType: 'On-chain' | 'Off-chain'
  ageDays: number | null
}

function MetricCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string
  value: string
  sub?: string
  variant?: 'success' | 'warning' | 'critical' | 'neutral' | 'accent'
}) {
  return (
    <div className="bg-surface border border-border p-4">
      <p className="text-[10px] text-text-muted uppercase tracking-wider font-mono mb-2">
        {label}
      </p>
      <p className={`font-mono text-lg font-bold ${variant ? `text-${variant}` : 'text-text-primary'}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-text-muted font-mono mt-1">{sub}</p>
      )}
    </div>
  )
}

export function TrustSnapshot({
  trustScore,
  sybilRisk,
  uniqueInteractors,
  storageType,
  ageDays,
}: Props) {
  const reputation = trustScore
    ? `${trustScore.positiveCount}/${trustScore.feedbackCount}`
    : '—'
  const reputationSub = trustScore && trustScore.feedbackCount > 0
    ? `${Math.round(trustScore.positiveRatio * 100)}% positive`
    : undefined

  const age = ageDays !== null
    ? ageDays === 0 ? 'Today' : `${ageDays}d`
    : '—'

  return (
    <div className="bg-surface border border-border p-5">
      <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
        Trust Snapshot
      </h2>
      <div className="grid grid-cols-5 gap-3">
        <MetricCard
          label="Reputation"
          value={reputation}
          sub={reputationSub}
        />
        <MetricCard
          label="Age"
          value={age}
          sub="since first seen"
        />
        <MetricCard
          label="Sybil Risk"
          value={sybilRisk.level}
          variant={sybilRisk.variant}
        />
        <MetricCard
          label="Proofs"
          value={storageType}
          sub={storageType === 'On-chain' ? 'URI stored on-chain' : 'URI points off-chain'}
        />
        <MetricCard
          label="Exposure"
          value={uniqueInteractors > 0 ? `${uniqueInteractors}` : '—'}
          sub={uniqueInteractors > 0 ? 'unique interactors' : undefined}
        />
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

```bash
pnpm build
```

Expected: Clean build.

**Step 3: Commit**

```bash
git add src/components/agent/TrustSnapshot.tsx
git commit -m "feat: TrustSnapshot component — 5-metric insight grid"
```

---

### Task 7: WhatChanged component

**Files:**
- Create: `src/components/agent/WhatChanged.tsx`

**Step 1: Write the component**

```typescript
// src/components/agent/WhatChanged.tsx
import type { ActivitySummary } from '@/lib/dossier/helpers'
import { summarizeActivity, formatRelativeTime } from '@/lib/dossier/helpers'

type Props = {
  activity: ActivitySummary
  lastSeen: string | null
}

export function WhatChanged({ activity, lastSeen }: Props) {
  const items = summarizeActivity(activity)
  const lastSeenText = formatRelativeTime(lastSeen)

  return (
    <div className="bg-surface border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono">
          What Changed
        </h2>
        <span className="text-[10px] text-text-muted font-mono">
          Last seen: {lastSeenText}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-text-muted font-mono">
          No activity recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-text-muted mt-0.5">&#x2022;</span>
              <span className="text-xs font-mono text-text-secondary">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Step 2: Verify build**

```bash
pnpm build
```

Expected: Clean build.

**Step 3: Commit**

```bash
git add src/components/agent/WhatChanged.tsx
git commit -m "feat: WhatChanged component — recent activity summary"
```

---

### Task 8: Redesign agent page layout

**Files:**
- Modify: `src/app/agent/[chain]/[id]/page.tsx`

This is the main integration task. The page is rewritten to use the new dossier layout.

**Step 1: Rewrite the agent page**

Replace the entire `export default async function AgentPage` and its imports with the new dossier layout. Keep `generateMetadata`, `KNOWN_PROTOCOLS`, `isUrl`, and `AgentUriDisplay` unchanged.

New imports to add:

```typescript
import { StatusPill } from '@/components/agent/StatusPill'
import { TrustSnapshot } from '@/components/agent/TrustSnapshot'
import { WhatChanged } from '@/components/agent/WhatChanged'
import { fetchDossierData } from '@/lib/dossier/fetch'
import { getAgentStatus, getSybilRisk, formatRelativeTime } from '@/lib/dossier/helpers'
```

New page structure:

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER: Name + Chain pill + Status pill                      │
│ Trust Score (large) + Confidence + Last seen + Total events   │
│ Agent ID + Owner (secondary)                                  │
│ Description (if any)                                         │
├──────────────────────────────────────────────────────────────┤
│ ACTIONS: [Claim/Watch] primary  |  [X / Embed / Explorer]   │
├──────────────────────────────────────────────────────────────┤
│ TRUST SNAPSHOT: 5-metric grid (full width)                    │
├──────────────────────────────────────────────────────────────┤
│ COLUMNS (12-grid):                                           │
│ [4] Identity Card        [8] What Changed                    │
│     Chain ID                  Connected Protocols             │
│     Owner                     Event Timeline                  │
│     URI                                                       │
│     Storage                                                   │
├──────────────────────────────────────────────────────────────┤
│ CLAIM SECTION (bottom)                                        │
└──────────────────────────────────────────────────────────────┘
```

The `AgentPage` function should:

1. Fetch contract data + metadata (existing)
2. Fetch claim status (existing)
3. Fetch trust score (existing)
4. **NEW**: Fetch dossier data via `fetchDossierData(chainId, agentId)`
5. Compute `agentStatus` via `getAgentStatus(trustScore?.score ?? null)`
6. Compute `sybilRisk` via `getSybilRisk({ openSybil: dossier.openSybilCount, resolvedSybil: dossier.resolvedSybilCount })`
7. Compute `ageDays` from `dossier.firstSeen`

Header section replaces the current breadcrumb + title:

```tsx
{/* Header — Estado Operativo */}
<div className="flex items-start justify-between">
  <div>
    <div className="flex items-center gap-3 mb-2">
      <h1 className="font-display text-2xl font-bold text-text-primary">
        {metadata?.name ?? `Agent #${agentId}`}
      </h1>
      <span className="status-pill status-pill-accent">{chainConfig.name}</span>
      <StatusPill status={agentStatus} />
      {isClaimed && <span className="status-pill status-pill-success">CLAIMED</span>}
    </div>

    {metadata?.description && (
      <p className="text-sm text-text-secondary max-w-2xl mb-3">
        {metadata.description}
      </p>
    )}

    <div className="flex items-center gap-6 text-xs font-mono text-text-muted">
      <span>Agent #{agentId}</span>
      <span>Last seen: {formatRelativeTime(dossier.lastSeen)}</span>
      <span>{dossier.totalEvents} events</span>
      {owner && <AddressChip address={owner} chainId={chainConfig.id} />}
    </div>
  </div>

  {/* Trust Score — right side */}
  <div className="text-right shrink-0">
    {trustScore ? (
      <div>
        <span className={`font-display text-5xl font-bold ${scoreColor(trustScore.score)}`}>
          {trustScore.score}
        </span>
        <span className="text-xs text-text-muted font-mono block mt-1">/ 100</span>
        <span className={`status-pill ${confidencePill(trustScore.confidence)} text-[10px] mt-1`}>
          {trustScore.confidence.toUpperCase()}
        </span>
      </div>
    ) : (
      <div className="text-xs text-text-muted font-mono">
        Awaiting<br />first poll
      </div>
    )}
  </div>
</div>
```

Move `scoreColor` and `confidencePill` from TrustScoreBadge.tsx into the page (or keep TrustScoreBadge as an import — the helpers are tiny).

Actions section reordered (primary = claim/watch, secondary = share/embed/explorer):

```tsx
{/* Actions — Agency */}
<div className="mt-6 flex items-center gap-3">
  {/* Primary */}
  <AgentClaimSection chainId={chainConfig.id} agentId={agentId} ownerAddress={owner} inline />
  <button
    disabled
    className="border border-border bg-surface px-4 py-1.5 text-xs font-mono text-text-muted cursor-not-allowed opacity-50"
    title="Coming soon"
  >
    Watch Agent
  </button>

  <span className="border-l border-border h-5 mx-1" />

  {/* Secondary */}
  <a href={`https://x.com/intent/post?text=...`} target="_blank" rel="noopener noreferrer"
     className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors">
    Post on X
  </a>
  <EmbedSnippet chainId={chainConfig.id} agentId={agentId} />
  <a href={`${chainConfig.explorer}/address/${chainConfig.contracts.identity}`} target="_blank" rel="noopener noreferrer"
     className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors">
    Explorer
  </a>
</div>
```

Then Trust Snapshot (full width), then the 12-col grid with Identity Card (left 4) and What Changed + Protocols + Event Timeline (right 8).

**Step 2: Verify build**

```bash
pnpm build
```

Expected: Clean build with all routes.

**Step 3: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/app/agent/[chain]/[id]/page.tsx
git commit -m "feat: redesign agent page as operational dossier

New header with status pill + trust score + last seen.
Trust Snapshot grid (reputation, age, sybil, proofs, exposure).
WhatChanged activity summary. Reordered CTAs."
```

---

### Task 9: Update CLAUDE.md + final verification

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md**

- Update test count to reflect new tests
- Add `src/lib/dossier/` to Architecture section: "Dossier helpers (status, relative time, sybil risk, activity summary) + SSR data fetcher"
- Note the timestamp fix in Data Flow section

**Step 2: Run full verification**

```bash
pnpm test && pnpm build
```

Expected: All tests pass, build clean.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for dossier lite + timestamp fix"
```

---

## Summary

| Task | Description | Tests Added |
|------|-------------|-------------|
| 1 | Fix Edge Function `event_timestamp: null` | — |
| 2 | Backfill migration + deploy | — |
| 3 | Dossier pure helpers (status, time, sybil, activity) | 16 |
| 4 | Dossier SSR data fetcher | — |
| 5 | StatusPill component | — |
| 6 | TrustSnapshot component | — |
| 7 | WhatChanged component | — |
| 8 | Agent page redesign (integration) | — |
| 9 | CLAUDE.md update + verification | — |

**Total new tests:** ~16 (pure function unit tests)
**Estimated commits:** 9
