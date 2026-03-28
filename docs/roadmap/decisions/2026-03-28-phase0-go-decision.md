# Phase 0 Go/No-Go Decision

**Date:** 2026-03-28
**Decision:** GO — proceed to Phase 1
**Author:** Wolfcito

## Metrics Summary

### Baseline (as of 2026-03-24)

| Metric | Value | Assessment |
|---|---|---|
| External API keys | 0 | No organic demand |
| Certificate shares | 0 external (36 internal) | No organic distribution |
| Agent claims | 0 | No ownership signal |
| x402 payments | 0 | No micropayment usage |
| npm downloads/week | 35 | Likely self-installs/CI |
| Supabase events | 23,421 | Healthy pipeline |
| Agents indexed | 4,336 | Healthy coverage |
| Trust scores computed | 4,317 | Infrastructure working |

### Kill Criteria Check

All five must be TRUE to trigger pause:

| Criterion | Status | Notes |
|---|---|---|
| Zero API keys | TRUE | No external keys created |
| Zero certificate shares | TRUE | 36 generated, all internal |
| Zero claims | TRUE | No agent ownership claims |
| <20 visitors/week | UNKNOWN | Vercel Analytics deployed 2026-03-24, insufficient data window |
| All conversations non-committal | **FALSE** | SKALE partner showed concrete interest |

**Result: Kill criteria NOT met.** The SKALE partner conversation breaks the non-committal criterion.

## Conversation Synthesis

### SKALE Partner Engagement (replaces 5 generic conversations)

The original plan called for 5 conversations across 3 personas (Builder, Agent Owner, Ecosystem Operator). Instead, a single high-quality partner engagement materialized organically:

**Partner profile:** Ecosystem operator with deployed ERC-8004 infrastructure on SKALE Base.

**Demand signals observed:**
- Named specific interest in trust scoring for agents
- Confirmed ERC-8004 contracts deployed (same CREATE2 addresses as Celo)
- Expressed willingness to push developers toward DenScope
- Distribution leverage: access to SKALE ecosystem developer community

**Technical validation (2026-03-28):**
- SKALE Base integration merged (PR #150) — ~72 lines of config
- Edge Function deployed and polling — 148 events in first batch
- 352+ agents discovered, trust scores computing
- Trust certificates generating correctly with SKALE Base badge
- Zero regressions on Celo chains (254/254 tests passing)

**Signal strength:** STRONG — this is a named partner with deployed infrastructure, not a hypothetical user.

### Why this replaces 5 generic conversations

1. **Higher signal density** — one partner with deployed contracts and distribution > 5 cold DMs
2. **Validates the right sub-hypothesis** — partner wants programmatic trust scoring (API/SDK), which is the core thesis
3. **Concrete next steps** — partner can drive real agent registrations and developer adoption
4. **Reduces validation risk** — organic inbound demand > manufactured outreach

## Decision

### GO — Proceed to Phase 1 (Foundation)

**Rationale:**
- Kill criteria not met (partner conversation was NOT non-committal)
- SKALE engagement validates the trust API thesis with a real partner
- Technical integration proved the system is chain-agnostic with minimal effort
- Infrastructure is mature (254 tests, 21 API endpoints, 3 npm packages)

### Lead sub-hypothesis: API/SDK

The partner's interest centers on programmatic trust scoring — querying trust data for agents across chains. This confirms API/SDK as the primary wedge, not certificates or UI.

### Phase 1 scope confirmed

| Issue | Title | Priority | Adjusted? |
|---|---|---|---|
| #141 | Landing page pivot — trust-first messaging with score lookup | CRITICAL | No change |
| #142 | Nav restructure to 3-item trust-focused nav | HIGH | No change |
| #143 | Internal instrumentation dashboard | HIGH | No change |

### MCP test work

NOT included in Phase 1. MCP did not surface in the SKALE partner conversation. Will reconsider if future conversations show MCP demand.

### Conditions for continued GO

Phase 1 exit gate (G1) requires at least 2 of:
1. 3+ API keys with >50% making a first call
2. 5+ certificate shares
3. 50+ npm downloads
4. Evidence of external usage
5. At least one qualified conversation showing intent (ACHIEVED via SKALE)

**One of five G1 conditions is already met.** Phase 1 needs to achieve one more.

## Risk Acknowledgment

- The GO decision rests on a single partner, not broad market validation
- If SKALE partner follow-through does not materialize in 30 days, reassess
- Zero organic demand remains a concern — Phase 1 must generate at least 1 additional signal
- The 30-day SKALE evaluation window runs concurrently with Phase 1
