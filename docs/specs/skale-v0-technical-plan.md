# SKALE v0 — Technical Plan

**Date:** 2026-03-25
**Status:** Ready for internal prep — pending partner confirmation for merge
**Target:** SKALE Base (chain ID 1187947933)

---

## Technical Goals

1. SKALE Base agents are visible in DenScope (agent dossier page)
2. Trust scores computed for SKALE Base agents (same v1 formula)
3. Certificates generatable for SKALE Base agents
4. API read path serves SKALE Base trust data
5. SDK includes SKALE Base chain configuration
6. Zero regressions on Celo functionality

## Non-Goals

- New UI pages, components, or navigation items
- Discovery, TrustOps, or Console on SKALE
- Graph visualization with SKALE nodes
- Alerts or watchlists for SKALE agents
- x402 payments on SKALE
- Multi-SKALE chain support
- Any SKALE-specific scoring logic

---

## Chain Configuration

### `src/config/chains.ts` — New Entry

```typescript
// SKALE Base (ERC-8004 AI agent L3)
{
  id: 1187947933,
  name: 'SKALE Base',
  rpc: {
    http: 'https://skale-base.skalenodes.com/v1/base',
    ws: 'wss://skale-base.skalenodes.com/v1/ws/base',
  },
  contracts: {
    identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  },
  explorer: 'https://skale-base-explorer.skalenodes.com',
  badge: { label: 'SKALE Base', color: '#4FC3F7' },
  backfillWindow: 500,
  backfillChunkSize: 10,
  confirmations: 1,
  pollingInterval: 5000,
}
```

Contract addresses are the same CREATE2 deterministic addresses used on Celo Mainnet.

### `src/config/wagmi.ts` — Add Chain

Import `skaleBase` from `viem/chains` and add to the chains array.

### Badge Color Rationale

`#4FC3F7` (light blue) — visually distinct from Celo green, neutral, consistent with SKALE branding.

---

## Data Flow

### Event Ingestion (Preferred: Full Pipeline)

If the contracts are active and emitting events:

```
pg_cron (every 1 min)
  → Edge Function erc8004-poller
    → SKALE Base RPC (eth_getLogs, 500 blocks/chunk)
      → viem ABI decode (same ERC-8004 ABI)
        → INSERT scope_events + agents (chain_id = 1187947933)
          → Signal detection rules (5 detectors)
            → Trust score computation (v1 formula)
              → Supabase Realtime → Browser
```

This is the exact same pipeline used for Celo. The only addition is one more chain entry in the Edge Function's `CHAINS` array and a new row in `deploy_blocks`.

### Read-Only Fallback

If contracts are deployed but no events exist yet (no registered agents):

- `eth_call` to `IdentityRegistry.getIdentity(agentId)` — returns agent data
- `eth_call` to `ReputationRegistry.getReputation(agentId)` — returns reputation data
- Browser-side reads via viem `readContract()` for agent dossier pages
- No historical events to index, but agent state is queryable

This fallback already exists in DenScope for the browser RPC path (when Supabase env vars are absent).

### Recommended Approach

Start with the full pipeline (Edge Function polling). If RPC rate limits or zero-event reality forces it, fall back to read-only. The pipeline change is ~5 lines in the Edge Function.

---

## Trust Scoring Compatibility

**Fully compatible.** The v1 trust score formula is chain-agnostic:

| Component | Chain-specific? | Notes |
|-----------|----------------|-------|
| Positive Ratio (40%) | No | Computed from feedback events |
| Age Score (20%) | No | `min(ageDays / 90, 1.0)` |
| Activity Score (20%) | No | `min(feedbackCount / (ageDays * 2), 1.0)` |
| Incident Penalty (10%) | No | Based on signal detection rules |
| Sybil Penalty (10%) | No | Based on sybil_cluster detector |

Trust scores are stored in `trust_scores` table with `chain_id` column. No schema changes needed.

---

## Certificate Compatibility

**Fully compatible.** Certificate generation uses:

- `CertificatePayload` type includes `chainId` and `chainName` fields
- SHA-256 hash is deterministic from payload data
- Share card states are score-based (not chain-based)
- Verification page (`/verify/[hash]`) is chain-agnostic
- Certificate snapshots stored with chain info in metadata

The only visible change: certificates for SKALE agents will show "SKALE Base" as chainName and the SKALE Base badge.

---

## API / SDK Implications

### API Routes

All v1 API routes are already parameterized by `{chain}`:

- `GET /api/v1/agent/{chain}/{id}/score` — works if `chain` matches a chain ID in `chains.ts`
- `GET /api/v1/agent/{chain}/{id}/signals` — same
- `GET /api/v1/agent/{chain}/{id}/events` — same
- `GET /api/v1/search` — already searches across all configured chains

No new API routes needed. The existing chain resolution logic will pick up SKALE Base automatically once the config entry exists.

### SDK (`@denlabs/trust-sdk`)

Add SKALE Base chain configuration to the SDK's chain registry. This is a config-only change — the SDK's `DenScope` client class is already chain-parameterized.

---

## Edge Function Changes

### `supabase/functions/erc8004-poller/index.ts`

Add SKALE Base to the `CHAINS` array:

```typescript
const CHAINS = [
  { /* Celo Mainnet */ },
  { /* Celo Sepolia */ },
  {
    id: 1187947933,
    name: 'SKALE Base',
    rpc: 'https://skale-base.skalenodes.com/v1/base',
    identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  },
]
```

### `deploy_blocks` Table

Insert initial deploy block for SKALE Base. The exact block number depends on when ERC-8004 was deployed — needs to be looked up via the SKALE Base Blockscout explorer.

---

## Blockers

| Blocker | Type | Resolution Path |
|---------|------|----------------|
| Partner confirms SKALE Base is the target | Partner confirmation | Ask directly — 1 question |
| Deploy block number for SKALE Base | Self-serve | Query Blockscout or contract creation tx |
| Verify RPC `eth_getLogs` works with DenScope chunk size | Self-serve | Test call with viem |
| Check if any agents are registered on SKALE Base | Self-serve | `eth_call` to IdentityRegistry |

Only the first blocker requires partner input. The rest are self-serve.
