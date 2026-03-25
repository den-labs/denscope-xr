# DenScope Non-Goals & Anti-Drift Memo

**Date:** 2026-03-23
**Status:** Active
**Applies to:** All DenScope development from Q2 2026 onward

---

## What DenScope Is

DenScope is the trust scoring API for ERC-8004 agents. It computes trust scores, generates verifiable certificates, and exposes trust data through a REST API, TypeScript SDK, and MCP server.

## What DenScope Is NOT

| Not This | Why |
|----------|-----|
| **An explorer** | 8004scan covers registry, browse, leaderboard, feedback, create. Competing on the explorer axis is a losing strategy. |
| **A dashboard** | Dashboards are retention tools for acquired users. DenScope has not acquired users. Building dashboards before acquisition is premature. |
| **A certificate generator** | Certificates are the distribution layer, not the product. The product is the scoring engine + data pipeline + API. |
| **A platform** | Platforms require ecosystems. DenScope has zero third-party integrations. Platform features (plugins, extensions, marketplace) are premature. |
| **Multichain by default** | Multichain is earned through single-chain validation. Expanding chains before proving demand on Celo dilutes focus. |

## Work That Should Be Rejected

Any proposed work that matches these patterns should be rejected or deferred:

### Explorer Drift Patterns

- "Add more filters to the Live Feed"
- "Improve Graph interactivity / add node types / clustering"
- "Build agent comparison views"
- "Add a leaderboard or ranking page"
- "Show more data in event cards"
- "Add network statistics"
- "Build an agent directory or search-first landing page"

**Test:** If the primary value of a feature is "see more data," it's explorer drift.

### Premature Scale Patterns

- "Support Ethereum / Base / Arbitrum / Polygon" (before Celo demand proven)
- "Add enterprise API tiers" (before free tier is used)
- "Build multi-tenant Console features" (before single-tenant activation proven)
- "Add internationalization beyond EN/ES" (before user base exists)

**Test:** If the feature addresses scale that doesn't exist yet, defer it.

### Discovery / TrustOps Status

Discovery is **no longer a public-core navigation surface**. It is reframed as **TrustOps Beta** — an internal, gated validation surface behind Console auth. It is not treated as validated product value. Re-promoting Discovery to primary nav requires measured engagement data (see Rule 0 above).

### Feature Bloat Patterns

- "Redesign Discovery" (before TrustOps beta is validated)
- "Add email/SMS notifications" (before webhook alerts are used)
- "Build a mobile app" (before web usage exists)
- "Add social login / OAuth" (SIWE is sufficient for the target user)
- "Build an analytics dashboard for trust trends" (before trust scores are queried)

**Test:** If the feature solves a problem no user has reported, defer it.

### Cosmetic Investment Patterns

- "Redesign the design system" (v1.1 is stable and sufficient)
- "Add animations to the Graph page" (Graph is paused)
- "Improve the embed experience" (zero embeds detected)
- "Build custom share card templates" (before certificates are shared)

**Test:** If the feature improves appearance without improving adoption, defer it.

## Rules for Future Prioritization

0. **No feature may be promoted to primary navigation without evidence of repeated use or a clearly proven role in the trust API funnel.** Navigation slots are scarce. Earning one requires measured engagement, not aesthetic preference or engineering completeness.
1. **Validation before building.** No feature ships without a hypothesis about what metric it will move.
2. **API-first.** If a feature can be delivered as an API endpoint, build the API first. UI is optional.
3. **Instrument before optimizing.** Don't improve what you can't measure.
4. **One chain until proven.** Celo only until external demand for another chain is documented (>5 requests).
5. **Follow the pull.** If API calls grow but page views don't, invest in API. If certificates get shared but API is unused, invest in certificates. Don't assume — measure.
6. **Kill criteria are real.** If a phase fails its go/no-go gate, pause. Don't rationalize continuation.
7. **Explorer is the default attractor.** Every "just one more feature" naturally pulls toward explorer territory. Resist it. The question is always: "Does this make the trust API more useful or more adopted?"

## Issue Litmus Test

Every issue opened or executed must answer at least one of:

1. Does this **validate demand**?
2. Does this **improve activation**?
3. Does this **strengthen the trust API thesis**?
4. Does this **reduce explorer drift**?
5. Does this **move closer to a real integration**?

If it answers none, it probably doesn't belong in the current phase.

**The rule:** What evidence do we need to earn the right to build the next thing?

See also: [issue-litmus-test.md](./issue-litmus-test.md)

## How to Use This Document

When evaluating any proposed feature, PR, or issue:

1. Apply the Issue Litmus Test above
2. Check against "Work That Should Be Rejected" patterns
3. Ask: "Does this serve the trust API thesis or the explorer thesis?"
4. Ask: "Is there measured demand for this, or am I building on assumption?"
5. If uncertain, defer. The cost of not building is low. The cost of building the wrong thing is high.

This document should be reviewed at every milestone exit and updated if the product thesis changes.
