# Epic Draft: SKALE v0 — Partner-Led Trust Loop Thin-Slice

> **This is a draft.** Implementation issues should only be created after scope confirmation with the partner (Decision 1 in skale-addendum.md).

## Title

SKALE v0: Partner-Led Trust Loop Thin-Slice

## Rationale

A SKALE ecosystem contact indicated that DenScope's trust scoring, certificates, and SDK/API support are relevant to their ecosystem. They expressed willingness to help push developers toward the product and gather feedback.

This is a real inbound demand signal — the first external partner to request DenScope integration. Per ADR-001, multichain expansion is gated on external requests. This epic tests the hypothesis that DenScope's trust loop transfers to a non-Celo chain with minimal effort, while keeping the work bounded and partner-validated.

This is not a multichain pivot. It is a focused evaluation of whether DenScope provides value to the SKALE ecosystem through trust visibility, verification, and API access.

## Scope

1. **Chain configuration** — Add one partner-approved SKALE network/environment to `src/config/chains.ts` with RPC, contract addresses, and explorer URL

2. **Minimal viable ingestion / read path** — Approach depends on ERC-8004 deployment reality:
   - Contracts deployed: extend existing event polling pipeline
   - Contracts not deployed: read-only contract state queries
   - Partial/uncertain: start with reads, add polling when stable

3. **Trust scoring** — Same v1 formula applied to SKALE agent data, stored in existing tables

4. **Certificate generation** — Trust certificates for SKALE agents using existing infrastructure (SHA-256 hashing, share cards, verification page)

5. **API read path** — Existing `/api/v1/agent/{chain}/{id}/score` and `/signals` routes serve SKALE agents

6. **SDK update** — `@denlabs/trust-sdk` gains SKALE chain configuration (read-only)

## Out of Scope

- Discovery / TrustOps
- Trust Graph visualization
- Console expansion (alerts, watchlists)
- x402 micropayments on SKALE
- Multi-SKALE chain support
- Custom SKALE branding or theming
- New UI pages, layouts, or navigation items
- Generalized multichain abstraction
- Explorer-style browsing
- Any work that pauses or deprioritizes Phase 0

## Dependencies

- Partner confirms: network/environment, chain ID, RPC URL, contract addresses
- ERC-8004 deployment status on chosen SKALE environment
- Test agents available for validation
- Phase 0 issues #139 and #140 not blocked

## Labels

- `partner:skale`
- `track:evaluation`
- `scope:bounded`

## Milestone

TBD — created only after partner scope confirmation (Decision 1). Until then, this work is documentation and planning only.

## Success Criteria (Composite)

All of the following must be met:

1. 3+ meaningful external or partner-led agent lookups (not internal testing)
2. 1+ certificate generated for a SKALE-based agent
3. 1+ written partner confirmation of usefulness
4. Zero Celo regressions (all existing tests pass)
5. Clear next-step request from the partner

## Archive Conditions

Track is archived if any of the following occur:

- Partner follow-through does not materialize within 30 days of v0 delivery
- No ERC-8004 agents registered on SKALE environment within 30 days
- Composite success signal not met within evaluation period
- SKALE work delays or conflicts with Phase 0 or Phase 1

## Implementation Note

**Do not create individual issues from this epic until Decision 1 resolves to "Proceed."** The scope must be confirmed with the partner before breaking into implementable tasks. Premature issue creation creates false momentum and scope pressure.
