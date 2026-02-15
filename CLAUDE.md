# DenScope

Real-time ERC-8004 agent explorer. Browser-first, zero-DB architecture.

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- viem (chain client), zustand (state), d3-force (graph), framer-motion (animations)
- next/og (share cards), idb (IndexedDB persistence)
- moduleResolution: bundler — no `.js` extensions needed
- Package manager: pnpm

## Commands

```bash
pnpm dev          # Dev server (Turbopack)
pnpm build        # Production build
pnpm test         # Run vitest tests
pnpm test:watch   # Watch mode
pnpm lint         # ESLint
```

## Architecture

- `src/config/` — Chain registry, contract ABIs, constants
- `src/lib/pipeline/` — Event ingestion (cursor, parse, dedup, ingest, client)
- `src/lib/discovery/` — Pattern detection rules (first_blood, rising_star)
- `src/lib/agent/` — Contract reads + metadata fetch (IPFS gateway fallback)
- `src/lib/graph/` — d3-force layout engine
- `src/lib/cache/` — IndexedDB cursor persistence + block timestamp cache
- `src/stores/` — Zustand stores (events, agents, graph, discovery)
- `src/components/` — React components (feed, graph, xray, discovery, shared, layout, providers)
- `src/app/` — Next.js pages + API routes

## Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Client | Live Feed (event stream) |
| `/graph` | Client | Trust Graph (d3-force canvas) |
| `/discovery` | Client | Discovery Signals |
| `/agent/[chain]/[id]` | SSR | Agent deep link with OG metadata |
| `/api/og/agent/[chain]/[id]` | Edge/Node | OG share card image generation |

## Adding a Chain

Edit `src/config/chains.ts`, add a `ChainConfig` entry. Zero code changes elsewhere.

## Key Constraints

- HTTP polling (no WebSocket) — configurable `pollingInterval` per chain
- getLogs paginated in `backfillChunkSize` chunks to avoid RPC limits
- Timestamps: `Date.now()` for realtime, `getBlock()` batch for backfill
- IndexedDB client-only; SSR routes use `readContract()` directly
- Reorg detection via `lastBlockHash` in cursor state
- ERC-8004 contracts: Identity Registry + Reputation Registry per chain

## Testing

```bash
pnpm test                    # All tests (45 tests, 10 files)
pnpm test src/lib/           # Pipeline + discovery + agent tests
pnpm test src/stores/        # Zustand store tests
pnpm test src/config/        # Chain config tests
```

- Mock patterns: zustand stores reset via `getState().clear()` in `beforeEach`
- BigInt: use `BigInt(n)` not `0n` literals (ES2017 target)
- No RPC mocking needed for unit tests — integration code tested via `pnpm build`
