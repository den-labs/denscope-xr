# Dossier Lite — Agent Page Redesign

## Goal

Transform the agent page from a "data registry" into an "operational dossier" by adding Insight (trust snapshot, what changed), improving Context (metrics, status), and reordering Agency (claim/watch primary, share secondary). Also fix the timestamp bug that causes empty timestamp columns on reload.

## Constraints

- **Hybrid approach**: fill with real data today + elegant empty states for low-volume scenarios
- **Agent page first**: `/agent/[chain]/[id]` is the primary surface; sidebar inherits later
- **No micro-interaction polish**: no sparklines, hover previews, keyboard nav, X-Ray sweep — post-launch
- **No new tables**: all metrics computed from existing `scope_events`, `trust_scores`, `incidents`
- **YAGNI**: no mini-graph, compare feature, service heartbeats, or watch functionality (placeholder only)

## Part 0: Timestamp Bug Fix

### Root Cause

Edge Function sets `event_timestamp: null` on every event insert (lines 83, 104 in `erc8004-poller/index.ts`). The column exists in Postgres but is never populated.

- **Realtime** works because `subscribeToEvents()` overrides with `Date.now()`
- **On reload**, `fetchHistoricalEvents()` reads `null` from DB, `formatTime(undefined)` returns `'--:--:--'`

### Fix

1. In `parseIdentityLog` and `parseReputationLog`: change `event_timestamp: null` to `event_timestamp: new Date().toISOString()`
2. Backfill existing rows: `UPDATE scope_events SET event_timestamp = created_at WHERE event_timestamp IS NULL`
3. Redeploy Edge Function

## Part 1: Agent Page Header — "Estado Operativo"

Replace current header (breadcrumb + "AGENT X-RAY" + name) with:

- **Agent name** + **Chain pill** + **Status pill** (Healthy / Warning / Critical / New)
  - Status derived from trust score: >= 60 Healthy (green), 30-59 Warning (orange), < 30 Critical (red), no data = "New" (neutral)
- **Trust Score** prominent display (large number + confidence + breakdown — evolved from current TrustScoreBadge)
- **Last seen** (relative time: "2m ago", "3d ago") + **Total events** count
- **Agent ID** + **Owner address** (AddressChip, secondary position)

## Part 2: Trust Snapshot — "Insight"

Grid of computed metrics (replaces separate "Connected Protocols" card + Trust Score card):

| Metric | Source | Display |
|--------|--------|---------|
| Reputation | `trust_scores` (positive_count / feedback_count) | ratio + pos/neg counts |
| Age | `agents.first_seen` or earliest event | "X days" since first seen |
| Sybil Risk | `incidents` with kind=sybil_cluster | Low/Medium/High pill |
| Proofs | Agent URI analysis (on-chain vs off-chain) | "On-chain" / "Off-chain" badge + URI type |
| Exposure | `COUNT(DISTINCT data->>'clientAddress')` from feedback events | "N unique interactors" |

Connected Protocols section (A2A, MCP, x402) moves below Trust Snapshot, not removed.

## Part 3: "What Changed?" — Context

Block showing recent agent activity, computed from `scope_events`:

- "Registered X days ago"
- "URI updated N times"
- "Received +N feedback (avg score: +X)"
- "Last activity: Xh ago"

### Empty States

| Scenario | Display |
|----------|---------|
| Fresh agent, 0 feedback | Status: "New", metrics at 0 but readable, "Registered on [date]" |
| Agent with feedback, no incidents | Sybil Risk: "Low" (green), everything else filled |
| No trust score computed yet | "Awaiting first poll cycle" |
| No recent activity (>7 days) | "No recent activity — last seen [date]" |

## Part 4: Actions — "Agency" (reordered)

**Primary CTAs**: Claim Agent (if unclaimed) / Watch Agent (placeholder button, disabled)
**Secondary CTAs**: Post on X / Embed Snippet / View on Explorer

## Part 5: Event Timeline

Stays as-is, moves below the new sections. Now shows proper timestamps after Part 0 fix.

## What's NOT Included (Future Iterations)

- Sparklines / trend charts (insufficient data volume)
- Mini context graph (high complexity, low value with ~286 events)
- Compare feature (requires UX research)
- Services with active/offline state (no heartbeat data)
- Hover previews, keyboard nav, X-Ray sweep animations (post-launch polish)
- Watch Agent real functionality (placeholder only)
- Sidebar redesign (inherits from agent page later)
