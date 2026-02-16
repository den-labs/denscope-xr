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
- `src/lib/supabase/` — Supabase client (anon), admin (service_role), event fetching + realtime, owner profiles, incidents, alerts, trust scores
- `src/lib/signals/` — Server-side signal detection rules (5 detectors: first_interaction, validation_complete, feedback_spike, reputation_drop, sybil_cluster)
- `src/lib/reputation/` — Trust score computation (v1 formula: positiveRatio + age + activity - incidents - sybil)
- `src/lib/api-keys/` — API key generation, hashing, validation, authentication middleware, rate limiting
- `src/lib/x402/` — x402 micropayment types, config, payment-required builder, facilitator client (verify+settle), hybrid auth middleware, payment recording
- `src/lib/dossier/` — Agent dossier helpers (status, relative time, sybil risk, activity summary) + SSR data fetcher
- `src/stores/` — Zustand stores (events, agents, graph, discovery, auth, incidents, alerts)
- `src/components/` — React components (feed, graph, xray, discovery, shared, layout, providers, auth, console, agent dossier)
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
| `/api/incidents/resolve` | API | Mark incident as resolved |
| `/api/alerts/rules` | API | GET/POST/PATCH alert rules |
| `/api/alerts/webhook-test` | API | Test webhook delivery |
| `/api/og` | Edge/Node | Root OG share card (site-level) |
| `/api/og/agent/[chain]/[id]` | Edge/Node | Agent OG share card image generation |
| `/api/v1/agent/[chain]/[id]` | API | Agent profile (rate-limited, API key required) |
| `/api/v1/agent/[chain]/[id]/score` | API | Trust score with breakdown (API key or x402) |
| `/api/v1/agent/[chain]/[id]/signals` | API | Incidents (?status=open\|resolved\|all) (API key or x402) |
| `/api/v1/agent/[chain]/[id]/events` | API | Paginated event history |
| `/api/v1/keys` | API | API key CRUD (GET/POST/DELETE) |
| `/api/v1/search` | API | Search agents by ID, owner, or chain |
| `/docs/api` | Client | Public API documentation page |

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
- Runs 5 signal detection rules for claimed agents, inserts incidents, dispatches webhooks
- Computes and upserts trust scores after each event (inlined formula, not imported from src/)
- Frontend subscribes to Supabase Realtime for live updates (events + incidents)
- Zero infrastructure, zero manual intervention

**RPC fallback** (no Supabase env vars):
- Browser polls chains directly via viem `getContractEvents`
- Limited to recent window (`backfillWindow` blocks)

**Manual indexer** (`scripts/indexer.ts`) — backup/recovery:
- Only needed for initial backfill or catching up after extended downtime
- Uses Forno RPCs with 2000-block chunks, processes all history

## Signal Detection (M5)

The Edge Function runs 5 detection rules after ingesting each event (only for claimed agents):

| Rule | Signal Kind | Fires When | Severity |
|------|-------------|-----------|----------|
| First Interaction | `first_interaction` | feedback_count goes from 0 to 1 | info |
| Validation Complete | `validation_complete` | validation_res event | info |
| Reputation Drop | `reputation_drop` | negative ratio >= 50% (3+ feedbacks) | warning/critical |
| Feedback Spike | `feedback_spike` | >= 5 feedbacks in 1 hour | info |
| Sybil Cluster | `sybil_cluster` | >= 4 unique addresses in 1 hour | critical |

Alert rules dispatch webhooks for `reputation_drop` and `sybil_detected`. Logs stored in `webhook_logs`.

## Reputation API (M6)

Pre-computed trust scores exposed via authenticated REST API.

**Trust Score v1 Formula** (0-100, clamped):

| Component | Weight | Computation |
|-----------|--------|-------------|
| Positive Ratio | 40% | positiveCount / feedbackCount |
| Age Score | 20% | min(ageDays / 90, 1.0) |
| Activity Score | 20% | min(feedbackCount / (ageDays * 2), 1.0) |
| Incident Penalty | 10% | critical * 0.15 + warning * 0.05 |
| Sybil Penalty | 10% | 1.0 if sybil incident exists |

**Confidence**: low (0 feedbacks), medium (3-9), high (10+).

**API Authentication**: `Authorization: Bearer ds_...` or `X-API-Key: ds_...` header. Keys are SHA-256 hashed in DB.

**Rate Limits**: Free tier 100 req/day, Pro 10K/day. Tracked via `api_usage_log` table. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## x402 Trust Oracle (M7)

Pay-per-call micropayments on `/score` and `/signals` via HTTP 402. Enables autonomous agents to query trust data without API keys.

**Hybrid auth flow** (in `src/lib/x402/middleware.ts`):
1. `Authorization`/`X-API-Key` header → existing M6 API key auth
2. `X-PAYMENT` header → x402 verify + settle via UltravioletaDAO facilitator
3. Neither → 402 Payment Required (with `PAYMENT-REQUIRED` header)

**Pricing**: `/score` $0.001 (1000 micro-USDC), `/signals` $0.0005 (500 micro-USDC).

**Facilitator**: UltravioletaDAO (`facilitator.ultravioletadao.xyz`) — Celo mainnet USDC, EIP-3009 off-chain signatures.

**Payment recording**: `x402_payments` table (append-only audit trail). Insert via `recordX402Payment()` — fire-and-forget after settlement.

**Env vars** (required to enable x402):
- `X402_PAY_TO` — wallet receiving USDC payments
- `X402_NETWORK` — CAIP-2 chain ID (default: `eip155:42220`)
- `X402_ASSET_ADDRESS` — USDC contract (default: Celo mainnet)
- `X402_FACILITATOR_URL` — facilitator endpoint

## Supabase

- **Project ref**: `ioxjqabngtannnfsueqa`
- **Tables**: `scope_events`, `agents`, `indexer_cursors`, `deploy_blocks`, `owner_profiles`, `incidents`, `alert_rules`, `webhook_logs`, `trust_scores`, `api_keys`, `api_usage_log`, `x402_payments`
- **Edge Function**: `erc8004-poller` (verify_jwt = false, invoked by pg_cron)
- **Cron**: `erc8004-poll` — runs every minute via pg_cron + pg_net
- **RLS**: Public read (events, agents), service_role write
- **Realtime**: Enabled on `scope_events` and `incidents` for live UI updates
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
- Timestamps: Edge Function sets `event_timestamp` at ingestion time; realtime overrides with `Date.now()`
- IndexedDB client-only; SSR routes use `readContract()` directly
- Reorg detection via `lastBlockHash` in cursor state
- ERC-8004 contracts: Identity Registry + Reputation Registry per chain
- `supabase/functions/` excluded from tsconfig (Deno runtime, not Node.js)

## Testing

```bash
pnpm test                    # All tests (144 tests, 29 files)
pnpm test src/lib/           # Pipeline + discovery + agent tests
pnpm test src/stores/        # Zustand store tests
pnpm test src/config/        # Chain config tests
```

- Signal detection tests: pure functions in `src/lib/signals/__tests__/detect.test.ts` (13 tests)
- Store tests: `src/stores/__tests__/incidents.test.ts` (4 tests)
- Dossier tests: `src/lib/dossier/__tests__/helpers.test.ts` (18 tests — status, relative time, sybil risk, activity summary)
- Reputation tests: `src/lib/reputation/__tests__/compute.test.ts` (9 tests)
- API key tests: `src/lib/api-keys/__tests__/` (generate 7 + rate-limit 4 + authenticate 5 = 16 tests)
- x402 tests: `src/lib/x402/__tests__/` (config 3 + payment-required 5 + facilitator 7 + middleware 7 = 22 tests)
- Type + helper tests: `src/types/__tests__/`, `src/lib/supabase/__tests__/`
- Mock patterns: zustand stores reset via `getState().clear()` in `beforeEach`
- BigInt: use `BigInt(n)` not `0n` literals (ES2017 target)
- No RPC mocking needed for unit tests — integration code tested via `pnpm build`
