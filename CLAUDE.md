# DenScope

Real-time ERC-8004 agent explorer with serverless event-driven sync.

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- viem (chain client), zustand (state), d3-force (graph), framer-motion (animations)
- wagmi + @wagmi/connectors (wallet connection), siwe (Sign-In with Ethereum)
- @tanstack/react-query (async state for wagmi)
- Supabase (Postgres + Realtime + Edge Functions + pg_cron)
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
```

### Edge Function (deployed to Supabase)

```bash
supabase functions deploy erc8004-poller --no-verify-jwt   # Deploy/update
curl https://ioxjqabngtannnfsueqa.supabase.co/functions/v1/erc8004-poller  # Manual invoke
```

### Manual Indexer (backup/initial backfill only)

```bash
pnpm run indexer              # Backfill + realtime sync (requires SUPABASE_SERVICE_ROLE_KEY)
pnpm run indexer:backfill     # One-shot backfill only
```

## Architecture

- `src/config/` — Chain registry, contract ABIs, constants
- `src/lib/pipeline/` — Event ingestion (cursor, parse, dedup, ingest, client)
- `src/lib/discovery/` — Pattern detection rules (first_blood, rising_star)
- `src/lib/agent/` — Contract reads + metadata fetch (IPFS gateway fallback)
- `src/lib/graph/` — d3-force layout engine
- `src/lib/cache/` — IndexedDB cursor persistence + block timestamp cache
- `src/lib/auth/` — SIWE message creation, nonce generation, signature verification
- `src/lib/supabase/` — Supabase client (anon), admin (service_role), event fetching + realtime, owner profiles
- `src/stores/` — Zustand stores (events, agents, graph, discovery, auth)
- `src/components/` — React components (feed, graph, xray, discovery, shared, layout, providers, auth, console)
- `src/app/` — Next.js pages + API routes
- `supabase/functions/erc8004-poller/` — Edge Function: polls Forno RPCs, writes events to DB
- `supabase/migrations/` — Database schema + pg_cron schedule
- `scripts/indexer.ts` — Manual indexer (backup, initial backfill)

## Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Client | Live Feed (event stream) |
| `/graph` | Client | Trust Graph (d3-force canvas) |
| `/discovery` | Client | Discovery Signals |
| `/console` | Client | Owner Console (wallet-gated, claimed agents) |
| `/agent/[chain]/[id]` | SSR | Agent deep link with OG metadata + claim flow |
| `/api/auth/nonce` | API | Generate SIWE nonce (5-min expiry) |
| `/api/claim` | API | Claim agent ownership (SIWE + ownerOf verification) |
| `/api/og/agent/[chain]/[id]` | Edge/Node | OG share card image generation |

## Adding a Chain

1. Edit `src/config/chains.ts` — add a `ChainConfig` entry
2. Update `supabase/functions/erc8004-poller/index.ts` — add chain to `CHAINS` array
3. Insert deploy block in `deploy_blocks` table
4. Redeploy: `supabase functions deploy erc8004-poller --no-verify-jwt`

## Data Flow (Serverless)

```
On-chain event → pg_cron (every 1 min) → Edge Function → Forno RPC
                                                          ↓
                                              eth_getLogs + decode
                                                          ↓
                                              INSERT scope_events
                                                          ↓
                                          Supabase Realtime → Browser
```

**Primary mode** (serverless, always-on):
- pg_cron invokes the `erc8004-poller` Edge Function every minute
- Edge Function reads `indexer_cursors`, calls `eth_getLogs` on Forno (500 blocks/chunk)
- Parses events using viem ABI decoding, upserts into `scope_events` + `agents`
- Frontend subscribes to Supabase Realtime for live updates
- Zero infrastructure, zero manual intervention

**RPC fallback** (no Supabase env vars):
- Browser polls chains directly via viem `getContractEvents`
- Limited to recent window (`backfillWindow` blocks)

**Manual indexer** (`scripts/indexer.ts`) — backup/recovery:
- Only needed for initial backfill or catching up after extended downtime
- Uses Forno RPCs with 2000-block chunks, processes all history

## Supabase

- **Project ref**: `ioxjqabngtannnfsueqa`
- **Tables**: `scope_events`, `agents`, `indexer_cursors`, `deploy_blocks`, `owner_profiles`
- **Edge Function**: `erc8004-poller` (verify_jwt = false, invoked by pg_cron)
- **Cron**: `erc8004-poll` — runs every minute via pg_cron + pg_net
- **RLS**: Public read (events, agents), service_role write
- **Realtime**: Enabled on `scope_events` for live UI updates
- **Migrations**: `supabase/migrations/`

## Chains

| Chain | ID | Deploy Block | Events |
|-------|-----|-------------|--------|
| Celo Mainnet | 42220 | 58396724 | 252 |
| Celo Sepolia | 11142220 | 17013547 | 34 |

## Key Constraints

- Serverless sync: pg_cron every 1 min, Edge Function processes 500 blocks/chain
- Alchemy free tier: 10-block max for `eth_getLogs` — all indexing uses Forno instead
- Supabase free tier: 500K Edge Function invocations/month (~86K used by cron)
- Timestamps: `Date.now()` for realtime, `getBlock()` batch for backfill
- IndexedDB client-only; SSR routes use `readContract()` directly
- Reorg detection via `lastBlockHash` in cursor state
- ERC-8004 contracts: Identity Registry + Reputation Registry per chain
- `supabase/functions/` excluded from tsconfig (Deno runtime, not Node.js)

## Testing

```bash
pnpm test                    # All tests (55 tests, 14 files)
pnpm test src/lib/           # Pipeline + discovery + agent tests
pnpm test src/stores/        # Zustand store tests
pnpm test src/config/        # Chain config tests
```

- Mock patterns: zustand stores reset via `getState().clear()` in `beforeEach`
- BigInt: use `BigInt(n)` not `0n` literals (ES2017 target)
- No RPC mocking needed for unit tests — integration code tested via `pnpm build`
