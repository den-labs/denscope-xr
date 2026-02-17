# Certificate Station — Phase 1.5 Design

**Date:** 2026-02-17
**Status:** Approved
**Goal:** Convert Live Feed from "scanner/terminal" into a "share launcher" where users understand in <5s how to generate and share a Trust Certificate.

---

## Problem

In Live Feed, rows are not perceived as clickable. Users never reach the Share flow. The product feels like a passive scanner instead of a trust-proof sharing tool.

## Solution

Restructure the existing XRayPanel into a **certificate-first persistent right panel** (Certificate Station). On desktop it is always visible (docked). On mobile it becomes a drawer.

## Architecture Decision

**Merge into XRayPanel** — no new panel component. Restructure XRayPanel to lead with certificate preview + share CTA, push existing detail sections below a divider.

## Layout (Top → Bottom)

1. **Header** — `TRUST CERTIFICATE` label (font-mono, uppercase, tracking-widest, muted). Close (X) for drawer mode.
2. **Certificate Preview** — OG card thumbnail (1200x630 look), agent name + chain badge, trust score + feedback ratio. Reuse existing card patterns.
3. **Primary CTA** — `Share Certificate` button, full-width, visually dominant. Opens X intent with `buildCertificateShareText()`.
4. **Secondary CTA** — `View Full Report →` link to `/agent/[chain]/[id]`.
5. **Micro-data** — Single line: `Owner 0x… | +5 / -0 | Snapshot <timestamp>`. Truncated with ellipsis.
6. **Divider** — Separator between certificate station and detail sections.
7. **Detail sections** — Existing XRayPanel content (trust score breakdown, feedback, activity) scrollable below.

## Behavior

### Desktop (>=1280px)
- Panel is **always visible**, docked right, part of the layout (not overlay).
- Feed takes remaining width (`flex-1`).

### Mobile (<1280px)
- Panel is a **drawer** (slide-over from right), triggered by row click.
- Close button dismisses.
- Share CTA remains dominant.

### Auto-select
- On load, if events/agents exist, auto-select the first visible agent.
- Highlight selected row with accent border + background.

### Empty State
- Title: `Generate a Trust Certificate`
- Text: `Click any agent to preview and share.`
- Share button disabled until selection.

## Files to Modify

| File | Change |
|------|--------|
| `src/app/page.tsx` | Panel becomes docked (not conditional on selection). Auto-select first agent. Breakpoint logic (docked vs drawer). |
| `src/components/xray/XRayPanel.tsx` | Restructure: certificate header + preview + CTAs at top, existing sections below divider. Accept `isDocked` prop. |
| `src/components/feed/FeedLine.tsx` | Add `cursor-pointer`, hover highlight (`bg-surface-hover`), selected state (accent border + bg). |
| `src/components/feed/LiveFeed.tsx` | Pass `selectedAgentKey` for row highlighting. Remove `CertificatePreview` hover tooltip (replaced by persistent panel). |
| `src/lib/share.ts` | No changes needed — `buildXIntentUrl()`, `buildCertificateShareText()`, `buildAgentPageUrl()` already exist. |

## Data & Fallbacks

- Agent Name: `metadata?.name ?? Agent #${agentId}`
- Trust Score: feedback-based ratio, fallback `—`
- Feedback: `+${positiveFeedback} / -${negativeFeedback}`, fallback `+0 / -0`
- Owner: truncated `0x…` (6+4 chars)
- Snapshot: `lastUpdated` or event timestamp

## Design Rules

- Agent description: **max 2 lines** (line-clamp-2), optional expand.
- Micro-data: **1 line**, truncated with ellipsis.
- No new dashboards, graphs, or long content blocks.
- Panel is a **share station**, not a dossier.
- `CertificatePreview` hover tooltip removed (persistent panel replaces it).

## Acceptance Criteria

1. Desktop: panel appears docked with agent selected on load.
2. User sees certificate preview + Share button without extra clicks.
3. Row click updates panel and highlights active row.
4. `Share Certificate` opens X intent with correct URL.
5. `View Full Report` navigates to `/agent/[chain]/[id]`.
6. Description clamped to 2 lines.
7. Micro-data is 1 line, truncated.
8. Responsive: <1280px becomes drawer.
