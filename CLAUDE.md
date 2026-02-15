# DenScope

Real-time ERC-8004 agent explorer with Supabase-backed historical indexing.

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- viem (chain client), zustand (state), d3-force (graph), framer-motion (animations)
- Supabase (Postgres + Realtime for historical event storage)
- next/og (share cards), idb (IndexedDB persistence)
- moduleResolution: bundler — no `.js` extensions needed
- Package manager: pnpm

## Commands

```bash
pnpm dev              # Dev server (Turbopack)
pnpm build            # Production build
pnpm test             # Run vitest tests
pnpm test:watch       # Watch mode
pnpm lint             # ESLint
pnpm run indexer      # Backfill + realtime sync (requires SUPABASE_SERVICE_ROLE_KEY)
pnpm run indexer:backfill  # One-shot backfill only
```

## Architecture

- `src/config/` — Chain registry, contract ABIs, constants
- `src/lib/pipeline/` — Event ingestion (cursor, parse, dedup, ingest, client)
- `src/lib/discovery/` — Pattern detection rules (first_blood, rising_star)
- `src/lib/agent/` — Contract reads + metadata fetch (IPFS gateway fallback)
- `src/lib/graph/` — d3-force layout engine
- `src/lib/cache/` — IndexedDB cursor persistence + block timestamp cache
- `src/lib/supabase/` — Supabase client (anon), admin (service_role), event fetching + realtime
- `src/stores/` — Zustand stores (events, agents, graph, discovery)
- `src/components/` — React components (feed, graph, xray, discovery, shared, layout, providers)
- `src/app/` — Next.js pages + API routes
- `scripts/indexer.ts` — Standalone event indexer (backfill + sync to Supabase)
- `supabase/migrations/` — Database schema (scope_events, agents, indexer_cursors)

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

## Data Flow

Two data source modes (auto-selected in PipelineProvider):

1. **Supabase mode** (when `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set):
   - Frontend fetches historical events from Supabase, subscribes to Realtime INSERT
   - Indexer script (`scripts/indexer.ts`) runs separately — backfills from deploy block, then syncs every 10s
   - Indexer uses Forno public RPCs (no Alchemy limits) with 2000-block chunks

2. **RPC fallback** (no Supabase env vars):
   - Browser polls chains directly via viem `getContractEvents`
   - Limited to recent window (`backfillWindow` blocks)

## Supabase

- **Project ref**: `ioxjqabngtannnfsueqa`
- **Tables**: `scope_events`, `agents`, `indexer_cursors`, `deploy_blocks`
- **RLS**: Public read, service_role write
- **Realtime**: Enabled on `scope_events` for live UI updates
- Migrations in `supabase/migrations/`

## Chains

| Chain | ID | Deploy Block | Events |
|-------|-----|-------------|--------|
| Celo Mainnet | 42220 | 58396724 | 252 |
| Celo Sepolia | 11142220 | 17013547 | 34 |

## Key Constraints

- HTTP polling (no WebSocket) — configurable `pollingInterval` per chain
- getLogs paginated in `backfillChunkSize` chunks to avoid RPC limits
- Alchemy free tier: 10-block max for `eth_getLogs` — indexer uses Forno instead
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
