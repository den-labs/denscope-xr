# SKALE v0 — Execution Plan

**Date:** 2026-03-26
**Status:** Active — implementation-first
**Duration:** 5 working days

---

## 1. Executive Summary

We have enough technical basis to start building. ERC-8004 is deployed on SKALE Base with the same CREATE2 addresses DenScope already indexes on Celo. The integration delta is 6 files, ~80 lines of config. The bottleneck is execution, not information. We build the thin slice now, verify it works end-to-end, and share concrete progress with the SKALE contact only after we have something real running.

This is the correct move because waiting for partner answers to questions we can resolve ourselves wastes time. The fastest way to validate the SKALE lane is to ship something demonstrable.

---

## 2. Scope Lock

### IN

- SKALE Base chain config (chain ID 1187947933) in DenScope
- Edge Function polling SKALE Base for ERC-8004 events
- Trust score computation for SKALE Base agents (same v1 formula)
- Agent dossier page renders SKALE Base agents with chain badge
- Certificate generation for SKALE Base agents
- API `/api/v1/agent/1187947933/{id}/score` serves SKALE trust data
- `@denlabs/trust-sdk` chain config for SKALE Base
- Tests for all new config
- Deploy block lookup and migration

### OUT

- Alerts, webhooks, watchlists
- Console, Discovery, Graph for SKALE
- Claims flow for SKALE agents
- x402 payments on SKALE
- Multi-SKALE chain expansion
- New UI pages or navigation items
- Scoring formula changes
- Workshops, co-marketing, distribution plans
- Partner-facing documentation beyond a thread update
- Any dependency on external teams registering agents before we ship

### Minimum Demonstrable Outcome

A SKALE Base agent ID entered into DenScope's URL (`/agent/1187947933/{id}`) renders the agent dossier, shows a trust score (or "insufficient signal" state), and can generate a verifiable certificate. The same data is returned by the API.

---

## 3. Success Criteria

1. **Agent visibility:** `/agent/1187947933/{agentId}` renders agent data from SKALE Base contracts (or shows "agent not found" correctly if no agents exist)
2. **Trust score API:** `GET /api/v1/agent/1187947933/{agentId}/score` returns a valid response (score or appropriate empty state)
3. **Certificate surface:** A certificate can be generated for a SKALE Base agent via `/api/certificate/1187947933/{id}` with correct chain badge
4. **Pipeline operational:** Edge Function polls SKALE Base RPC without errors, cursor advances
5. **Zero regressions:** All 252 existing tests pass, Celo functionality unaffected

---

## 4. Workstreams

### W1: Chain Integration / Read Path

**Objective:** DenScope recognizes SKALE Base as a chain and can read from it.

**Tasks:**
1. Add SKALE Base ChainConfig to `src/config/chains.ts`
2. Add `skaleBase` to wagmi config (`src/config/wagmi.ts`)
3. Add `skaleBase` to viem chain map (`src/lib/pipeline/client.ts`)
4. Add SKALE Base to Edge Function CHAINS array (`supabase/functions/erc8004-poller/index.ts`)
5. Look up ERC-8004 deploy block on SKALE Base Blockscout
6. Create Supabase migration for deploy_blocks insert
7. Verify RPC connectivity with a test `eth_getLogs` call
8. Write chain config tests

**Dependencies:** None — all self-serve.
**DoD:** `getChain(1187947933)` returns valid config. Edge Function processes SKALE Base without errors. Tests pass.

### W2: Trust Model Mapping

**Objective:** Trust scores compute correctly for SKALE Base agents.

**Tasks:**
1. Verify trust score computation handles SKALE Base chain_id (it should — chain-agnostic)
2. Verify signal detection rules work for SKALE Base events
3. Add integration test: mock SKALE Base event → trust score computed

**Dependencies:** W1 (chain config exists).
**DoD:** A SKALE Base event processed through the pipeline produces a valid trust score in `trust_scores` table.

### W3: API / SDK Minimal Surface

**Objective:** SKALE trust data is queryable via API and SDK.

**Tasks:**
1. Verify API routes resolve SKALE Base chain ID (should work automatically)
2. Test `/api/v1/agent/1187947933/{id}/score` response shape
3. Add SKALE Base chain config to `@denlabs/trust-sdk`
4. Publish trust-sdk patch version

**Dependencies:** W1 (chain config).
**DoD:** API returns valid response for SKALE Base agent ID. SDK can query SKALE Base trust data.

### W4: UI Trust Visibility

**Objective:** Agent dossier page renders SKALE Base agents correctly.

**Tasks:**
1. Verify `/agent/1187947933/{id}` renders with SKALE Base badge
2. Verify chain badge color (#4FC3F7) displays correctly
3. Test empty state (agent not found on SKALE Base)
4. Test SSR OG metadata includes SKALE Base chain name

**Dependencies:** W1 (chain config).
**DoD:** Agent page renders SKALE Base agent with correct badge. Empty state handled.

### W5: Certificate / Verification Surface

**Objective:** Certificates work for SKALE Base agents.

**Tasks:**
1. Verify certificate generation includes SKALE Base chainId and chainName
2. Test certificate share card shows SKALE Base badge
3. Verify `/verify/{hash}` works for SKALE Base certificates
4. Test certificate hash determinism across chains

**Dependencies:** W1 + W2 (chain config + trust data).
**DoD:** Certificate generated for SKALE Base agent. Verification page renders correctly.

### W6: Demo Packaging

**Objective:** A reproducible demo flow exists.

**Tasks:**
1. Document the demo flow: URL → dossier → certificate → API call
2. Capture screenshot/recording of SKALE Base agent in DenScope (if agents exist)
3. If no agents exist: document the empty-state flow and what it would look like with an agent

**Dependencies:** W1-W5 complete.
**DoD:** Demo script written. At least one screenshot captured.

---

## 5. Day-by-Day Plan

### Day 1 — Chain Plumbing

**Focus:** W1 — Make DenScope recognize SKALE Base.

**Expected output:**
- `chains.ts` updated with SKALE Base config
- `wagmi.ts` updated
- `pipeline/client.ts` updated
- Chain config tests written and passing
- RPC connectivity verified (eth_getLogs test call)
- Deploy block number identified

**Risk to watch:** RPC endpoint unreachable or rate-limited. Mitigation: test with small block range first.

### Day 2 — Pipeline + Trust

**Focus:** W1 (Edge Function) + W2 (trust model verification).

**Expected output:**
- Edge Function updated with SKALE Base chain
- Deploy block migration created
- Edge Function deployed to Supabase (staging test)
- Trust score computation verified for SKALE Base events
- Signal detection rules verified

**Risk to watch:** Edge Function timeout if SKALE Base has high event volume. Mitigation: start with small chunk size (10 blocks).

**Ship decision:** If RPC works and Edge Function polls without errors → proceed. If RPC is broken → fall back to read-only path and skip Edge Function changes.

### Day 3 — API + SDK

**Focus:** W3 — API routes + SDK update.

**Expected output:**
- API routes verified for SKALE Base chain ID
- Integration test: API returns valid response for SKALE Base
- trust-sdk updated with SKALE Base chain config
- trust-sdk patch published to npm

**Risk to watch:** API key auth or rate limiting behaves differently for new chain. Unlikely — chain-agnostic code.

### Day 4 — UI + Certificates

**Focus:** W4 + W5 — Visual verification.

**Expected output:**
- Agent dossier page renders SKALE Base agents
- Badge color verified
- Empty state verified
- Certificate generation works for SKALE Base
- Verification page works
- OG share card includes SKALE Base metadata

**Risk to watch:** SSR data fetcher fails for SKALE Base RPC. Mitigation: same viem readContract pattern used for Celo.

### Day 5 — QA + Ship

**Focus:** W6 + full QA pass + merge.

**Expected output:**
- All tests pass (existing 252 + new SKALE config tests)
- QA checklist completed
- PR created, reviewed, merged
- Edge Function redeployed with SKALE Base
- Demo flow documented
- Build deployed to Vercel

**Ship decision:** If all success criteria met → merge and deploy. If zero agents exist on SKALE Base → merge anyway (empty state is valid), note in partner update.

---

## 6. Risks and Guardrails

| Risk | Guardrail |
|------|-----------|
| **Scope creep** — "while we're at it, let's add Europa too" | One chain only. Any addition requires a new decision document. |
| **No test agents on SKALE Base** | Ship anyway. Empty state is a valid v0 outcome. The infrastructure works; agents are the partner's responsibility. |
| **UI polish trap** — spending days on SKALE-specific styling | No new components. Reuse existing agent dossier. Badge color is the only visual change. |
| **Waiting for partner instead of building** | Zero outbound questions before Day 5. Build first, share after. |
| **RPC unreliability** | If RPC fails: fall back to read-only contract calls (no Edge Function polling). Document the limitation. |
| **Edge Function quota concern** | Third chain adds ~43K invocations/month. Total ~129K vs 500K limit. Safe. |
| **Phase 0 conflict** | SKALE v0 is interstitial. If #139 or #140 needs attention, pause SKALE. |

---

## 7. Immediate Next Actions

1. **Verify SKALE Base RPC** — run `eth_getLogs` against `skale-base.skalenodes.com/v1/base` with ERC-8004 Identity contract address (self-serve, 5 min)
2. **Look up deploy block** — query Blockscout for ERC-8004 contract creation tx on SKALE Base (self-serve, 5 min)
3. **Check for registered agents** — `eth_call` to `IdentityRegistry.totalSupply()` or similar read on SKALE Base (self-serve, 5 min)
4. **Create feature branch** — `feat/skale-v0`
5. **Start Day 1 tasks** — chain config, wagmi, pipeline client, tests

---

## 8. Issue / Task Breakdown

| # | Title | Owner | Priority | Acceptance Criteria |
|---|-------|-------|----------|-------------------|
| 1 | Add SKALE Base chain config | Fullstack | P0 | `getChain(1187947933)` returns valid config. Badge color `#4FC3F7`. Tests pass. |
| 2 | Add SKALE Base to wagmi + pipeline client | Fullstack | P0 | viem client creates for SKALE Base. Wagmi config includes chain. |
| 3 | Verify RPC connectivity | BE | P0 | `eth_getLogs` returns valid response for SKALE Base. Document any rate limits. |
| 4 | Look up deploy block + create migration | BE | P0 | `deploy_blocks` row exists for chain 1187947933. Block number is correct. |
| 5 | Add SKALE Base to Edge Function | BE | P1 | Edge Function polls SKALE Base. Cursor advances. No errors in logs. |
| 6 | Deploy Edge Function to Supabase | BE | P1 | `supabase functions deploy` succeeds. Polling active. |
| 7 | Verify trust scoring for SKALE Base events | QA | P1 | Mock SKALE Base event → trust score computed. Same formula. |
| 8 | Verify API routes for SKALE Base | QA | P1 | `/api/v1/agent/1187947933/{id}/score` returns valid response. |
| 9 | Update @denlabs/trust-sdk with SKALE Base | Fullstack | P2 | SDK chain config includes SKALE Base. Patch published. |
| 10 | Verify agent dossier page for SKALE Base | FE/QA | P2 | `/agent/1187947933/{id}` renders with badge. Empty state works. |
| 11 | Verify certificate generation for SKALE Base | QA | P2 | Certificate shows SKALE Base chainName. Verification page works. |
| 12 | Run full QA checklist | QA | P1 | All items in QA checklist pass. 252+ tests pass. |
| 13 | Document demo flow | PM | P2 | Demo script with URLs. At least one screenshot. |

---

## 9. QA / Validation Checklist

### Data Integrity
- [ ] SKALE Base events in `scope_events` have correct `chain_id` (1187947933)
- [ ] Trust scores in `trust_scores` have correct `chain_id`
- [ ] No Celo events incorrectly tagged as SKALE Base (or vice versa)
- [ ] No mock data leaking into production — all data comes from on-chain reads

### UI States
- [ ] Agent found on SKALE Base: dossier renders with SKALE Base badge (#4FC3F7)
- [ ] Agent not found on SKALE Base: appropriate "not found" state (not crash)
- [ ] Loading state works for SKALE Base agent page
- [ ] Error state works if SKALE Base RPC is unreachable

### API Consistency
- [ ] `/api/v1/agent/1187947933/{id}/score` response shape matches Celo response shape
- [ ] `/api/v1/agent/1187947933/{id}/signals` response shape matches Celo response shape
- [ ] `/api/v1/search` returns SKALE Base agents when they exist
- [ ] API key auth works identically for SKALE Base queries

### Certificate Surface
- [ ] Certificate payload includes `chainId: 1187947933` and `chainName: "SKALE Base"`
- [ ] Certificate hash is deterministic (same input → same hash)
- [ ] Share card renders with SKALE Base badge color
- [ ] `/verify/{hash}` resolves SKALE Base certificates
- [ ] Certificate is grounded in actual SKALE Base on-chain data (not stale or fabricated)

### Source/Network Clarity
- [ ] Chain badge clearly identifies "SKALE Base" (not just "SKALE")
- [ ] Explorer links point to SKALE Base Blockscout (not Celo)
- [ ] OG share card metadata includes correct chain name

### Regression
- [ ] All 252 existing tests pass
- [ ] Celo Mainnet agent pages still work
- [ ] Celo Sepolia agent pages still work
- [ ] Edge Function still polls Celo chains correctly
- [ ] Build passes (`pnpm build`)
- [ ] No TypeScript errors (`pnpm lint`)

---

## 10. Partner Update Trigger

**Do NOT post an update until ALL of the following are true:**

1. SKALE Base chain config is merged to main
2. Edge Function is deployed and polling SKALE Base (or read-only path is live)
3. At least one of these works end-to-end:
   - Agent dossier page renders a SKALE Base agent, OR
   - Agent dossier page shows correct empty state for SKALE Base
4. API route returns valid response for a SKALE Base query
5. A screenshot or URL exists showing DenScope with SKALE Base content

**Update format:** Share in the existing thread. Include:
- Screenshot of DenScope showing SKALE Base (agent or empty state)
- API endpoint URL for SKALE Base trust queries
- One sentence: "SKALE Base trust loop is live on DenScope — agents registered on SKALE Base are now visible with trust scores and certificates."
- One question: "Are there agents registered on SKALE Base we should test with?"

Do not oversell. Do not promise features beyond what is shipped.

---

## Smallest Real Ship

The smallest version that counts as a win:

**SKALE Base chain config live in DenScope production.** The Edge Function polls SKALE Base. If agents exist, they show up with trust scores and certificates. If no agents exist, the infrastructure is ready and waiting.

Concretely: someone can visit `https://denscope.vercel.app/agent/1187947933/1` and get either an agent dossier or a clean "agent not found" — both prove the trust loop works on SKALE. The API returns the same. A certificate can be generated for any SKALE Base agent.

This is not a demo. It is production infrastructure extended to a new chain. That is the win.
