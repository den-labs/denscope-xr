# M7: x402 Trust Oracle — Roadmap & Design

> **Status:** Ready (all questions resolved, scoped for implementation)
>
> **Goal:** Enable autonomous agents to query trust scores and signals via pay-per-call micropayments (HTTP 402), without needing an API key or human-managed account.

---

## Why x402 for DenScope

### The problem with API keys in the agent era

The current Reputation API (M6) requires a human to:

1. Connect wallet + SIWE sign
2. Generate an API key in Console
3. Configure their agent with `ds_xxxxx`

This works for **developers building with agents**. But the real consumer of trust data in the agent economy is **another agent** — and agents don't have accounts.

### The x402 alternative

With x402, any agent with a wallet can query trust data instantly:

```
Agent A wants to interact with Agent B
  -> GET /v1/agent/42220/46/score (no auth)
  <- 402 Payment Required + PAYMENT-REQUIRED header
  -> Signs EIP-712 off-chain (no gas for the agent)
  -> Retries with X-PAYMENT header
  <- { score: 85, confidence: "high", breakdown: {...} }
```

Zero human intervention. The trust API becomes a **trust oracle** — a primitive any agent can call before any interaction of value.

### Why this fits DenScope's moat

The revenue flywheel already has three layers:

```
Cards (free, viral) -> Console (paid, retention) -> API (paid, infrastructure)
```

x402 adds a fourth: **Agent-native monetization**. The same data moat (M6) now earns revenue from agents that will never create an account, never visit the Console, and never know DenScope exists as a product — they just know it as a trust oracle.

---

## Which endpoints get x402

Not all endpoints justify micropayments. Analysis by value and access pattern:

| Endpoint | x402? | Rationale |
|----------|-------|-----------|
| **`/v1/agent/[chain]/[id]/score`** | **Yes** | The "moment of truth" query. Agent decides whether to interact. High value per call. |
| **`/v1/agent/[chain]/[id]/signals`** | **Yes** | Pre-interaction risk check. "Does this agent have red flags?" |
| `/v1/agent/[chain]/[id]` | No | Public profile data. Low unit value. Better as free tier growth hook. |
| `/v1/agent/[chain]/[id]/events` | No | Bulk access pattern. Gas costs would exceed data value per row. |
| `/v1/search` | No | Discovery. Should be frictionless for ecosystem growth. |
| Console routes | No | Human-operated (owners). API key model is correct. |
| `/api/claim`, `/api/auth/nonce` | No | Operational. Not data endpoints. |
| `/api/metadata`, `/api/og/*` | No | Public by definition (SEO, social sharing). |

### Proposed pricing

| Endpoint | Price (USDC) | Rationale |
|----------|-------------|-----------|
| `/v1/agent/{chain}/{id}/score` | $0.001 | Trust check — oracle-level query |
| `/v1/agent/{chain}/{id}/signals` | $0.0005 | Risk context — lighter payload |

### Auth model: hybrid (API key + x402)

x402 does **not** replace API keys. Both channels coexist:

| Channel | Who uses it | For what |
|---------|------------|----------|
| **API key** (M6, existing) | Human developers | Bulk integrations, dashboards, analytics. Predictable cost. |
| **x402** (M7, new) | Autonomous agents | Punctual trust checks. No account needed. |
| **Free tier** (M6, existing) | Explorers, demos | Onboarding, growth. Zero friction. |

Request flow with x402:

```
Incoming request
  |
  +-- Has Authorization/X-API-Key header?
  |     -> Existing API key auth (M6)
  |
  +-- Has X-PAYMENT header?
  |     -> x402 verify + settle via facilitator
  |
  +-- Neither?
        -> 402 Payment Required (with PAYMENT-REQUIRED header)
        -> Falls back to existing 401 if x402 not configured
```

---

## Facilitator: UltravioletaDAO

### Why UltravioletaDAO (not Coinbase)

| | Coinbase Facilitator | UltravioletaDAO Facilitator |
|--|---------------------|----------------------------|
| **Celo support** | No (Base + Solana only) | **Yes** (Celo mainnet + 18 other chains) |
| **Stablecoins** | USDC only | USDC, EURC, AUSD, PYUSD, USDT |
| **Pricing** | 1000 free/mo, then $0.001/tx | $0 gas fees for agents |
| **ERC-8004 aware** | No | **Yes** (has `/register`, `/identity`, `/feedback` endpoints) |
| **Maturity** | Official protocol author | Battle-tested (751+ tests, E2E verified on Avalanche Fuji) |

**Decision: UltravioletaDAO** — it supports Celo (our chain), supports our standard (ERC-8004), and has been validated end-to-end with real on-chain settlements.

Facilitator URL: `https://facilitator.ultravioletadao.xyz`

### Existing implementation reference

We already have a complete x402 implementation guide at `docs/x402-implementation-guide.md` covering:
- Full wire protocol (402 response -> EIP-712 signing -> X-PAYMENT header -> verify -> settle)
- TypeScript types, config, middleware, facilitator client, E2E test script
- 12 documented pitfalls found during production debugging
- All JSON format references for every step of the protocol

---

## SDK evaluation: build vs. buy

### Option A: Manual facilitator calls (current guide)

Our `docs/x402-implementation-guide.md` documents the manual approach — calling `/verify` and `/settle` directly via `fetch()`.

**Pros:**
- Zero dependencies beyond native `fetch`
- Full control over the wire protocol
- Already documented and battle-tested
- Works with any facilitator (not vendor-locked)

**Cons:**
- ~200 lines of boilerplate (types, config, payment-required builder, verify/settle client, middleware)
- Must maintain wire protocol compatibility if x402 spec evolves
- EIP-712 domain construction is error-prone (7 of 12 documented pitfalls relate to format)

### Option B: `uvd-x402-sdk` (UltravioletaDAO SDK)

```
npm install uvd-x402-sdk
```

```typescript
// Server: verify payment
import { verifyPayment } from "uvd-x402-sdk"
const result = await verifyPayment(
  request.headers["X-PAYMENT"],
  { maxPrice: "10.00", recipient: "0xYourWallet" }
)

// Client: create payment
import { createPayment } from "uvd-x402-sdk"
const payment = await createPayment(wallet, {
  recipient: "0xYourWallet",
  amount: "10.00",
  tokenType: "eurc"  // usdc | eurc | ausd | pyusd
})
```

**Pros:**
- 2-line integration on server side
- Handles all EIP-712 construction, nonce generation, serialization
- Multi-stablecoin support out of the box
- Maintained by the facilitator provider (format changes handled upstream)

**Cons:**
- Requires Node >= 24 (DenScope currently targets Node 18/20 on Vercel)
- New dependency in the critical payment path — must audit
- Unclear maturity / maintenance cadence (check npm publish history)
- Vendor lock-in to UltravioletaDAO facilitator (API shape may differ from Coinbase's)
- Unknown bundle size impact on serverless functions

### Option C: `@x402/core` (official protocol SDK by Coinbase)

```
npm install @x402/core
```

The official x402 TypeScript SDK (v2.3.0, actively maintained). Transport-agnostic client, server, and facilitator components.

**Pros:**
- Official protocol SDK — most likely to stay current with spec changes
- Transport-agnostic (works with any facilitator, including UltravioletaDAO)
- Backed by Coinbase engineering
- Wider ecosystem adoption

**Cons:**
- Designed primarily for Coinbase's facilitator — may need adaptation for UltravioletaDAO
- Heavier dependency tree (Coinbase SDK chain)
- May not support UltravioletaDAO-specific features (multi-stablecoin, ERC-8004 endpoints)

### Recommendation

**Start with Option A (manual calls)**, porting the existing guide to Next.js App Router middleware. Rationale:

1. **DenScope only needs x402 on 2 endpoints** — the boilerplate cost is low
2. **Node >= 24 requirement of `uvd-x402-sdk`** is a blocker for current Vercel deployment
3. **Zero new dependencies** in the payment verification path reduces attack surface
4. **The guide is already written and battle-tested** — porting to Next.js is straightforward
5. **Re-evaluate SDK adoption when:** the protocol stabilizes at v3+, Node 24 is Vercel default, or we need multi-stablecoin support

If the `uvd-x402-sdk` drops the Node 24 requirement or `@x402/core` adds UltravioletaDAO facilitator support natively, **Option C becomes the clear winner** — official SDK + any facilitator.

---

## Resolved questions

1. **Settlement latency (2-10s): Acceptable.** Trust checks happen before interactions of value. A few seconds of latency is fine — agents are not latency-sensitive at the sub-second level.

2. **Celo USDC EIP-3009: Confirmed.** Celo mainnet USDC supports `transferWithAuthorization`. No blockers.

3. **Double-payment protection: Known risk, not a blocker.** If an agent's first request settles but the 200 response is lost (network timeout), the agent retries with a new EIP-712 nonce and gets charged again ($0.001). The x402 protocol prevents replay of the SAME signature, but not retries with NEW signatures. At $0.001/query this is not catastrophic. Mitigation for later: accept an optional `X-Idempotency-Key` header and cache results for 60s.

4. **401 vs 402: Not applicable.** This was a bug from another project (dengrow-x402) where a protected route returned 401 instead of 402. DenScope's x402 endpoints will return 402 from the start. Existing API key integrations continue using `Authorization: Bearer ds_...` and never see the 402 flow.

5. **Revenue tracking: New `x402_payments` table.** Segregated from `api_usage_log` because the access patterns are fundamentally different:
   - `api_usage_log`: UPDATE-heavy (upsert daily counter per key), query "how many requests today?"
   - `x402_payments`: INSERT-only (append log), query "how much revenue this month?", "who paid?", "tx hash?"
   - No FK — payer is an anonymous wallet, not an API key holder
   - Immutable audit trail — never delete or update rows

6. **UltravioletaDAO on Celo: Confirmed live.** Facilitator supports 14 EVM chains including Celo mainnet and Celo Sepolia. Expansion to more ecosystems is future work (M8+).

---

## Database: `x402_payments` table

```sql
CREATE TABLE x402_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INT NOT NULL,
  agent_id INT NOT NULL,
  endpoint TEXT NOT NULL,        -- '/v1/agent/.../score'
  payer_address TEXT NOT NULL,   -- wallet of the agent that paid
  amount_micro INT NOT NULL,     -- micro-USDC (1000 = $0.001)
  tx_hash TEXT,                  -- on-chain settlement hash
  facilitator TEXT NOT NULL,     -- 'ultravioletadao'
  settled_at TIMESTAMPTZ DEFAULT NOW(),
  network TEXT NOT NULL,         -- 'eip155:42220'
  stablecoin TEXT DEFAULT 'USDC'
);

-- Indexes for revenue analytics and audit queries
CREATE INDEX idx_x402_payments_settled ON x402_payments (settled_at DESC);
CREATE INDEX idx_x402_payments_payer ON x402_payments (payer_address);
CREATE INDEX idx_x402_payments_agent ON x402_payments (chain_id, agent_id);
```

- **RLS:** service_role write, console owners read (filtered by their claimed agents)
- **Append-only:** no UPDATEs, no DELETEs
- **Retention:** indefinite (audit trail)

---

## Scope summary

### What M7 delivers

- x402 middleware for Next.js App Router (2 protected endpoints)
- Hybrid auth: API key OR x402 payment on `/score` and `/signals`
- Payment verification + settlement via UltravioletaDAO facilitator
- `x402_payments` table for revenue tracking
- Updated `/docs/api` page documenting the x402 flow for agent developers

### What M7 does NOT include

- Multi-chain x402 (only Celo mainnet initially)
- Multi-stablecoin (USDC only initially)
- Client SDK / npm package for agent developers (M8+)
- Custom pricing tiers per agent or per owner
- Agent framework integrations (LangChain, CrewAI) — separate milestone

### Dependencies

- ~~UltravioletaDAO facilitator operational on Celo mainnet~~ Confirmed live
- ~~Celo USDC contract supports EIP-3009~~ Confirmed
- Vercel deployment env vars for x402 config (`X402_PAY_TO`, `X402_NETWORK`, `X402_ASSET_ADDRESS`, `X402_FACILITATOR_URL`)

---

## Milestones context

| Milestone | Status | What it unlocked |
|-----------|--------|-----------------|
| M1-M3 | Complete | Explorer, social identity, live data |
| M4 | Complete | Owner claim, Console shell, SIWE auth |
| M5 | Complete | Signals, incidents, webhook alerts |
| M6 | Complete | Trust scores, API keys, rate limiting, public API |
| Dossier Lite | Complete | Agent page as operational dossier |
| **M7** | **Planned** | **x402 trust oracle — agent-native monetization** |
| M8+ | Future | Multi-chain, framework SDKs, trust score v2 |

---

*Document created: 2026-02-16. Author: @wolfcito.*
*Context: Strategic analysis of x402 integration for DenScope's Reputation API, evaluating UltravioletaDAO facilitator, official Coinbase SDK, and manual implementation approaches.*
