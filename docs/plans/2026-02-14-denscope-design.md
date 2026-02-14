# DenScope — Design Document

**Date:** 2026-02-14
**Status:** Approved
**Author:** Wolfcito + Claude
**Location:** `denlabs/denscope/` (independent sub-project, own `.git`)

---

## 1. Overview

**DenScope** is a real-time ERC-8004 agent explorer that combines a live event feed, an interactive trust graph, and automated discovery signals into a single browser-first application.

**Core insight:** ERC-8004 contracts already store all agent identity, reputation, and validation data on-chain. Instead of replicating it into a heavy indexer + database, DenScope reads directly from the blockchain and listens to events — zero backend, zero DB.

### What it does

- **Live Feed** — Terminal-style stream of ERC-8004 events (registrations, feedback, validations) with pulse animations
- **Trust Graph** — Force-directed visualization of agent-to-agent trust relationships
- **Discovery Signals** — Automated pattern detection (rising stars, sybil alerts, trust clusters)
- **X-Ray Panel** — Deep dive into any agent's identity, services, and activity
- **Share Cards** — OG image generation for social sharing
- **Multi-chain** — Celo, Avalanche, and future chains via config

### What it is NOT

- Not a full indexer (no block-by-block scan, no full history)
- Not a backend service (browser-first, optional lite backend in V2)
- Not a wallet or transaction tool (read-only explorer)

---

## 2. Architecture

### Zero-DB Architecture (V0/V1)

```
┌─────────────────────────────────────────────────┐
│                   Browser (Next.js)              │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Live Feed│  │ Trust    │  │ X-Ray Panel   │  │
│  │ (stream) │  │ Graph    │  │ (agent detail) │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼────────┐  │
│  │        Event Processing Layer               │  │
│  │  - Parse events → ScopeEvent                │  │
│  │  - Discovery signal detection (rules)       │  │
│  │  - Graph edge computation                   │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐  │
│  │         Data Layer (viem)                   │  │
│  │  - watchContractEvent() → live events       │  │
│  │  - readContract() → view functions          │  │
│  │  - getLogs() → historical window            │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐  │
│  │         Persistence (IndexedDB)             │  │
│  │  - Cursor state + block hash                │  │
│  │  - Agent/edge snapshots                     │  │
│  │  - Block timestamp cache                    │  │
│  └────────────────────────────────────────────┘  │
└───────────────────────┼──────────────────────────┘
                        │ HTTP (polling) / WebSocket
          ┌─────────────▼──────────────┐
          │   Chain RPCs               │
          │   Celo, Avalanche, etc.    │
          └────────────────────────────┘
```

### Safety Rails (from day 1)

1. **Backfill by window** — `getLogs(latest - N, latest)`, never full chain scan
2. **Local cache** — IndexedDB persists cursor + snapshot across page reloads
3. **Reorg detection** — `lastBlockHash` in cursor; rollback on hash mismatch

### V2 Pro Mode (designed, not implemented in V0)

Optional lite backend as event relay/cache:
- Same `ScopeEvent[]` contract between front and API
- Transparent swap: front changes from "direct RPC" to "fetch /api/feed"
- Enables longer retention + stability against RPC rate limits

---

## 3. Chain Registry (multi-chain by config)

```typescript
type ChainConfig = {
  id: number
  name: string
  rpc: { http: string; ws?: string }
  contracts: {
    identity: `0x${string}`
    reputation: `0x${string}`
    validation?: `0x${string}`
  }
  explorer: string
  badge: { label: string; color: string }
  backfillWindow: number        // blocks to go back on cold start
  backfillChunkSize: number     // max blocks per getLogs request
  confirmations: number         // blocks to wait for finality
  pollingInterval: number       // ms between polls if no WebSocket
}
```

Adding a chain = adding an object to the array. Zero code changes.

**Day 1 chains:**

| Chain | ID | Confirmations | Polling | Notes |
|-------|----|---------------|---------|-------|
| Celo Alfajores | 44787 | 1 | 4s | Testnet first |
| Celo Mainnet | 42220 | 1 | 4s | Instant finality |
| Avalanche C-Chain | 43114 | 2 | 4s | Linita's contracts |

---

## 4. Cursor System

```
  ┌─────────────────── TIMELINE ───────────────────────┐
  │                                                     │
  │  [════ backfill window ════][▶ cursor ][→ realtime] │
  │   getLogs(from, to)          ↑          watchEvent  │
  │                         IndexedDB                   │
  │                         persists here               │
  └─────────────────────────────────────────────────────┘
```

### CursorState

```typescript
type CursorState = {
  chainId: number
  lastBlock: number
  lastBlockHash: string         // for reorg detection
  lastLogIndex: number
  timestamp: number
  snapshot: {
    agents: Map<number, AgentSummary>
    edges: TrustEdge[]
  }
}
```

### Boot sequence

1. Check IndexedDB for saved cursor
2. If cursor exists:
   a. Verify `lastBlockHash` matches chain state
   b. If mismatch → rollback 50-200 blocks, re-ingest
   c. If match → `getLogs(cursor.block, latest - confirmations)` to fill gap
3. If no cursor → `getLogs(latest - backfillWindow, latest - confirmations)` cold start
4. Start `watchContractEvent()` for realtime tail (polling if no WS)
5. Persist cursor every N events or every 30s

### Reconciliation

- WebSocket disconnect/reconnect → `getLogs(cursor, latest)` before re-subscribing
- Dedup by `txHash + logIndex` (idempotent in memory)
- getLogs paginated in `backfillChunkSize` chunks per chain config

---

## 5. Event Processing Pipeline

### ScopeEvent (internal normalized type)

```typescript
type ScopeEvent = {
  chain: ChainConfig
  block: number
  txHash: string
  logIndex: number
  timestamp?: number            // optional: see Timestamp Strategy
  kind: 'register' | 'uri_update' | 'metadata'
      | 'feedback' | 'feedback_revoked'
      | 'response' | 'validation_req' | 'validation_res'
  agentId: number
  data: RegisterData | FeedbackData | ValidationData
}
```

### Timestamp strategy

Logs don't include timestamps. Two modes:
- **Realtime events:** Use `Date.now()` (good enough for feed display)
- **Backfill events:** Batch `getBlock()` for unique block numbers in the batch, cache in IndexedDB (`blockNumber → timestamp`)

### Pipeline flow

```
Raw Log → parse(abi) → ScopeEvent → [Discovery Rules] → State Update → UI
                                         │
                                    emit DiscoverySignal
                                    if pattern matches
```

### Multi-chain multiplexing

Each chain runs its own cursor + pipeline in parallel:

```
Chain A (Celo)       ──pipeline──▶ ┐
                                   ├──▶ Merged Store ──▶ UI
Chain B (Avalanche)  ──pipeline──▶ ┘
```

- Trust Graph shows all chains together (chain badge per node)
- Live Feed interleaves events from all chains (by timestamp)
- Chain selector in header filters the view, doesn't disconnect other pipelines

---

## 6. ERC-8004 Contract Events

### Identity Registry

- `Registered(uint256 indexed agentId, string agentURI, address indexed owner)`
- `URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)`
- `MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)`

### Reputation Registry

- `NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)`
- `FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)`
- `ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseURI, bytes32 responseHash)`

### Validation Registry

- `ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash)`
- `ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)`

### ABI source

Extract from CeloScan (verified contracts) or `agent0-labs/erc-8004-contracts` repo. Fallback: human-readable ABI from EIP spec (viem accepts these).

---

## 7. Views & Components

### Layout

```
┌─────────────────────────────────────────────────────┐
│  DenScope          [Celo ▾] [Avalanche] [+Chain]    │
│  ─────────────────────────────────────────────────── │
│  [Live Feed]  [Trust Graph]  [Discovery]             │
│                                                      │
│  ┌───────────────────────────┬─────────────────────┐ │
│  │                           │                     │ │
│  │   Active View             │   X-Ray Panel       │ │
│  │   (feed / graph / disc.)  │   (slides in on     │ │
│  │                           │    click/select)     │ │
│  │                           │                     │ │
│  └───────────────────────────┴─────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Status Bar: connected ● | 3 agents | last 2s   │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### View 1: Live Feed

Terminal-style scrolling event stream:

```
12:03:42  REGISTER   Agent #847 "AutoTrader-v3"
12:03:38  FEEDBACK   Agent #201 ← 92/100 by 0xab..cd  [starred]
12:03:35  VALIDATE   Agent #55 ← validator: 88/100
12:03:30  REVOKE     Feedback on Agent #201 by 0xef..01
```

- Color-coded by event kind (register=green, feedback=blue, revoke=red)
- **Pulse animation** — bloom effect on new event entry (framer-motion)
- **Burst grouping** — 5+ rapid events collapse to "+N events" expandable block
- Click any line → opens X-Ray for that agent
- Auto-scroll with pause on hover

### View 2: Trust Graph

Force-directed graph (d3-force engine, canvas render):

- **Nodes** = agents (size ∝ feedback count)
- **Edges** = trust relationships (feedback given, validations)
- **Node color** = trust health (red low → green high)
- **Edge pulse** = recent events (last 30s glow animation)
- Hover = tooltip (name + score), Click = X-Ray panel
- Zoom/pan, new nodes appear with bloom effect
- Chain badge on each node when multi-chain active

### View 3: Discovery Signals

Curated feed of auto-detected patterns:

| Signal | Rule |
|--------|------|
| First Blood | Agent receives first-ever feedback |
| Trust Cluster | 3+ agents exchange feedback mutually within 1h |
| Reputation Crash | Agent loses >30 points in 24h window |
| Rising Star | New agent gets 5+ positive feedbacks in <24h |
| x402 Ready | New agent with x402 support detected in metadata |
| Multi-Chain Agent | Same agentURI seen on 2+ chains |
| Sybil Alert | Circular feedback pattern (A→B→C→A) |

Each signal renders as a card with context, timestamp, and link to involved agents.

**Known limitation (V0):** Rules operate on available window only (backfill + realtime since boot). Patterns spanning beyond the window are missed. V2 Pro Mode extends this.

### Panel: X-Ray (slide-in)

Opens on click from any view:

- **Identity:** name, owner, registration date, chain badge
- **Services:** A2A, MCP (version), x402 badges
- **Activity:** mini timeline of recent events
- **Share:** "Generate Share Card" + "Copy Tweet" buttons
- Data via `readContract()` + `agentURI` metadata fetch (IPFS gateway fallback, timeout + retry)

### Deep Link: `/agent/[chain]/[id]`

- SSR: fetch metadata + basic stats via `readContract()`
- OG meta tags → `/api/og/agent/[chain]/[id]`
- Client: hydrates with live data, opens X-Ray panel
- Shareable, SEO-friendly, always loads

---

## 8. Share Cards (OG)

### Endpoint: `/api/og/agent/[chain]/[id]`

- Server-side `readContract()` direct to RPC
- Generate image via `@vercel/og` (satori, edge runtime)
- Cache header: 5 minutes

### V0 content (direct data only)

- Agent name (from agentURI metadata)
- Chain badge
- Owner address (truncated)
- Services badges (A2A/MCP/x402)
- Registration info
- DenScope branding

### V2 content (with getLogs)

- Trust score (computed from feedback window)
- +/- ratio
- Top tags
- Last significant event

### Copy Tweet

Pre-formatted text with:
- Agent name + score summary
- Link to `/agent/[chain]/[id]` (triggers OG card on paste)
- DenScope attribution

---

## 9. Local Cache (IndexedDB)

| Key | Value | Lifecycle |
|-----|-------|-----------|
| `cursor:{chainId}` | CursorState (block, hash, logIndex) | Permanent, overwritten on save |
| `snapshot:{chainId}` | Agent map + edges (serialized) | Overwritten on cursor save |
| `discovery:{chainId}` | DiscoverySignal[] | Last 100, FIFO |
| `block-ts:{chainId}` | Map<blockNumber, timestamp> | LRU, max 5000 entries |
| `preferences` | Selected chains, active view, theme | Permanent |

Library: **idb** (~1KB wrapper over IndexedDB)

Guard: `typeof window !== 'undefined'` — SSR routes use `readContract()` directly, no IndexedDB.

---

## 10. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | SSR for agent pages + OG, API routes for share cards |
| Chain client | viem | Type-safe, native watchContractEvent + getLogs + readContract |
| State | zustand | Minimal, no boilerplate, event stream → UI |
| Trust Graph | d3-force + canvas | Performance at 100s of nodes |
| Animations | framer-motion | Pulse effects, slide-in, bloom |
| Share Cards | @vercel/og (satori) | Edge runtime PNG from JSX |
| Local cache | idb | Thin IndexedDB wrapper |
| Styling | Tailwind CSS | Consistent with denlabs workspace |
| Package manager | pnpm | Workspace default |

---

## 11. Project Structure

```
denlabs/denscope/
├── .git/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── CLAUDE.md
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # shell: header + chain selector + status bar
│   │   ├── page.tsx                   # default: Live Feed view
│   │   ├── graph/page.tsx             # Trust Graph view
│   │   ├── discovery/page.tsx         # Discovery Signals view
│   │   ├── agent/[chain]/[id]/page.tsx  # deep link agent page
│   │   └── api/og/agent/[chain]/[id]/route.tsx  # OG share card
│   │
│   ├── config/
│   │   ├── chains.ts                  # ChainConfig registry
│   │   ├── contracts.ts               # ABIs (identity, reputation, validation)
│   │   └── constants.ts               # confirmations, backfill, cache TTLs
│   │
│   ├── lib/
│   │   ├── pipeline/
│   │   │   ├── cursor.ts              # CursorState + IndexedDB persistence
│   │   │   ├── ingest.ts              # getLogs + watchContractEvent orchestration
│   │   │   ├── parse.ts               # Raw log → ScopeEvent (reorg detection)
│   │   │   ├── multiplexer.ts         # Multi-chain parallel → merged output
│   │   │   └── reconcile.ts           # Gap fill, dedup txHash+logIndex
│   │   │
│   │   ├── discovery/
│   │   │   ├── engine.ts              # Rule runner: ScopeEvent[] → DiscoverySignal[]
│   │   │   └── rules.ts              # Individual detection rules
│   │   │
│   │   ├── graph/
│   │   │   ├── compute.ts             # Events → nodes + edges
│   │   │   └── layout.ts              # d3-force simulation config
│   │   │
│   │   ├── agent/
│   │   │   ├── read.ts                # readContract() helpers
│   │   │   └── metadata.ts            # Fetch + parse agentURI (IPFS gateway fallback)
│   │   │
│   │   └── cache/
│   │       ├── idb.ts                 # IndexedDB operations
│   │       └── block-timestamps.ts    # blockNumber → timestamp batch cache
│   │
│   ├── stores/
│   │   ├── events.ts                  # zustand: ScopeEvent[] feed
│   │   ├── agents.ts                  # zustand: Map<agentId, AgentSummary>
│   │   ├── graph.ts                   # zustand: nodes + edges
│   │   └── discovery.ts              # zustand: DiscoverySignal[]
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── feed/
│   │   │   ├── LiveFeed.tsx
│   │   │   ├── FeedLine.tsx
│   │   │   ├── BurstGroup.tsx
│   │   │   └── PulseEffect.tsx
│   │   ├── graph/
│   │   │   ├── TrustGraph.tsx
│   │   │   ├── GraphNode.tsx
│   │   │   └── GraphEdge.tsx
│   │   ├── discovery/
│   │   │   ├── DiscoveryFeed.tsx
│   │   │   └── SignalCard.tsx
│   │   ├── xray/
│   │   │   ├── XRayPanel.tsx
│   │   │   ├── AgentIdentity.tsx
│   │   │   ├── AgentServices.tsx
│   │   │   ├── AgentActivity.tsx
│   │   │   └── ShareButton.tsx
│   │   └── shared/
│   │       ├── ChainBadge.tsx
│   │       └── AddressChip.tsx
│   │
│   └── types/
│       ├── events.ts                  # ScopeEvent, data unions
│       ├── agents.ts                  # AgentSummary, AgentMetadata
│       ├── graph.ts                   # GraphNode, TrustEdge
│       ├── discovery.ts              # DiscoverySignal, SignalKind
│       └── cursor.ts                  # CursorState (with lastBlockHash)
│
├── public/
│   └── chains/                        # Chain logos (celo.svg, avalanche.svg)
│
└── docs/
    └── plans/
        └── 2026-02-14-denscope-design.md
```

---

## 12. Build Phases

| Phase | Scope | MVP? |
|-------|-------|------|
| **0 — Scaffold** | create-next-app, tailwind, chain config, ABIs | - |
| **1 — Pipeline** | cursor, ingest, parse, IndexedDB, reorg detection, zustand stores | - |
| **2 — Live Feed** | LiveFeed + FeedLine + PulseEffect + BurstGroup + StatusBar | YES |
| **3 — X-Ray** | readContract helpers, metadata fetch, slide-in panel, V0 share card | YES+ |
| **4 — Trust Graph** | d3-force layout, canvas render, node/edge from store | Full |
| **5 — Discovery** | Rule engine, initial rules, signal cards | Full |
| **6 — Multi-chain + Polish** | Multiplexer, chain selector, agent deep links, OG endpoint | Complete |

**MVP = Phase 0-2:** Live Feed with pulse animations on Celo Alfajores testnet. Functional, demostrable, shippable.

---

## 13. Known Constraints & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Celo forno is HTTP-only (no WebSocket) | "Realtime" is polling every 2-4s | viem `watchContractEvent` supports HTTP polling natively. Configurable per chain. |
| getLogs block range limits per RPC | Backfill may fail on large windows | Paginate in `backfillChunkSize` chunks. Start conservative: 2K blocks/request. |
| IPFS metadata fetch slow in browser | X-Ray panel loads slowly | HTTP gateway fallback (ipfs.io, w3s.link), timeout + retry, skeleton UI. |
| IndexedDB unavailable in SSR | SSR agent pages can't use cache | Guard with `typeof window`. SSR uses direct `readContract()`. |
| ABIs may not be verified on CeloScan | Can't extract full ABI | Fallback: human-readable ABI from EIP spec (viem accepts). |
| Share Card V0 has limited data | Card may look sparse | Show: name, chain badge, services, owner. Score/ratio in V2. |
| Discovery rules limited to available window | Patterns beyond window are missed | Accepted for V0. V2 Pro Mode extends window. |
| d3-force wants DOM control | Conflicts with React | Known pattern: d3 computes positions, canvas renders. d3 never touches DOM. |
| Scope: 6 phases for a "mini-project" | Risk of overscoping | Phase 0-2 is MVP. Each subsequent phase is independent and incremental. |
| Timestamp not in logs | Feed shows wrong times | Realtime: Date.now(). Backfill: batch getBlock() for unique blocks, cache in IndexedDB. |

---

## 14. Out of Scope (V0)

- Full history indexing (block-by-block scan)
- Backend server / database
- Trust score computation (requires getLogs aggregation — V2)
- Wallet integration (connect wallet, submit feedback)
- Validation Registry deep integration (monitor in feed, details in V2)
- "/pulse" as separate 4th view (pulse is a visual style on Live Feed)
