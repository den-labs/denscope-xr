# SKALE v0 Scope — Trust Loop Thin-Slice

**Date:** 2026-03-25
**Status:** Proposed — pending partner scope confirmation
**Depends on:** Partner confirmation of ERC-8004 deployment status

## What "SKALE Support" Means in v0

A minimal viable demonstration of the full DenScope trust loop on one partner-approved SKALE network/environment:

1. An agent registered on SKALE can be looked up in DenScope
2. That agent has a trust score computed by the same v1 formula
3. That agent can have a trust certificate generated and verified
4. That agent's trust state is queryable via the SDK/API read path

This is the smallest slice that represents the system end-to-end, not an isolated feature.

## In Scope

### Chain Configuration
- Add one partner-approved SKALE network/environment to `src/config/chains.ts`
- Configure RPC endpoint, contract addresses (Identity + Reputation), explorer URL
- Add chain to wagmi config for wallet interactions

### Minimal Viable Ingestion / Read Path
- The ingestion approach depends on deployment reality:
  - **If ERC-8004 contracts are deployed:** Extend the existing event polling pipeline to include the SKALE RPC endpoint, using the same cursor + dedup + ingest pattern
  - **If contracts are not yet deployed:** Implement a read-only path that queries contract state directly (no event history), providing current-state trust data without historical ingestion
  - **If deployment is partial or uncertain:** Start with direct contract reads and add event polling when contracts are confirmed stable
- No new database tables — reuse `scope_events`, `agents`, `trust_scores` with chain discrimination

### Trust Scoring
- Same v1 formula (positiveRatio 40%, age 20%, activity 20%, incident 10%, sybil 10%)
- No SKALE-specific scoring adjustments
- Scores stored in existing `trust_scores` table

### Certificate Generation
- Trust certificates for SKALE agents using existing certificate infrastructure
- Same SHA-256 deterministic hashing
- Same share card states (insufficient_signal, monitoring, trustworthy, high_risk)
- Certificate verification page works for SKALE certificates (no new routes)

### API / SDK Read Path
- `/api/v1/agent/{chain}/{id}/score` returns trust score for SKALE agents
- `/api/v1/agent/{chain}/{id}/signals` returns incidents for SKALE agents
- `@denlabs/trust-sdk` updated with SKALE chain configuration (read-only)
- No new API endpoints — existing routes handle multi-chain via `{chain}` parameter

### UI
- No new pages — existing agent dossier (`/agent/{chain}/{id}`) renders SKALE agents
- Chain badge/indicator on agent pages to distinguish SKALE from Celo
- No SKALE-specific landing page, dashboard, or navigation item

## Out of Scope

- Discovery / TrustOps signals for SKALE
- Trust Graph visualization with SKALE nodes
- Console expansion (alerts, watchlists) for SKALE
- x402 micropayments on SKALE
- Multi-SKALE chain support (one network only)
- Custom SKALE branding or theming
- New UI pages, layouts, or navigation items
- Generalized multichain abstraction layer
- Full ecosystem parity with Celo features
- Explorer-style block/transaction browsing
- Any work that requires pausing Phase 0

## Dependencies and Unknowns

### Technical Unknowns
- **ERC-8004 deployment status on SKALE:** Are Identity and Reputation contracts deployed? Which network/environment?
- **RPC endpoint reliability:** Rate limits, uptime, WebSocket support for the chosen SKALE environment
- **Block structure compatibility:** Does the SKALE environment emit standard EVM logs compatible with the existing viem ABI decoding?
- **Contract address discovery:** How are the ERC-8004 contract addresses determined on SKALE? (CREATE2 deterministic or manual deployment?)

### Partner Unknowns
- **Which SKALE network/environment?** Partner must confirm (Europa, Calypso, Nebula, or a dedicated chain)
- **Test agents:** Does the partner have (or can they register) test agents for validation?
- **Timeline expectations:** What does the partner expect to see, and by when?
- **Distribution commitment:** Specifics of "willingness to push developers" — newsletter, docs, direct introductions?

### Dependencies
- Partner confirms ERC-8004 deployment or commits to deploying
- Partner provides or confirms: network name, chain ID, RPC URL, contract addresses
- Phase 0 issues #139 and #140 are not blocked by SKALE work

## Success Signal (Composite)

The SKALE v0 track is considered successful if ALL of the following are met within the evaluation period:

1. **3+ meaningful external or partner-led agent lookups** — not internal testing, not automated; real queries from the partner or their developer community
2. **1+ certificate generated** for a SKALE-based agent
3. **1+ written partner confirmation of usefulness** — email, message, or document explicitly stating the product adds value to their ecosystem
4. **Zero Celo regressions** — all existing tests pass, Celo functionality unaffected
5. **Clear next-step request** — the partner articulates what they want next (more features, integration support, ecosystem rollout)

## Archive Conditions

The SKALE track is archived (code remains but is not actively maintained or expanded) if:

- Partner follow-through does not materialize (no response, no test agents, no distribution effort) within 30 days of v0 delivery
- Real-agent testing does not happen (no ERC-8004 agents registered on the SKALE environment) within 30 days
- The composite success signal is not met within the evaluation period
- SKALE work begins to delay or conflict with Phase 0 or Phase 1 priorities

Archive means: chain config remains in code, no active development, no issue creation, revisit only on new inbound signal.

## How This Supports Partner Validation Without Breaking Roadmap Discipline

The thin-slice approach means:
- **Minimal code surface** — chain config + ingestion/read path + SDK config. No new features, no new UI.
- **Reuse everything** — trust formula, certificate pipeline, API routes, agent dossier. The system proves itself by working identically across chains.
- **No structural debt** — if SKALE is archived, the only residue is one chain entry in `chains.ts`. No orphaned features.
- **Partner sees the whole loop** — from agent lookup to trust score to certificate to API query. This is credible, not a toy demo.
