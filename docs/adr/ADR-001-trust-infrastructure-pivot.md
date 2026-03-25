# ADR-001: Pivot from Explorer to Trust Infrastructure

**Status:** Accepted
**Date:** 2026-03-23
**Deciders:** wolfcito
**Context:** DenScope Q2 2026 strategy review

---

## Context

DenScope has been building as an ERC-8004 agent explorer since inception. Over 10 milestones, the product accumulated 6 pages (Live Feed, Graph, Discovery, Console, Agent Dossier, API Docs), 21 API endpoints, 3 auth methods (SIWE, API key, x402), a published SDK monorepo (4 npm packages), and a full serverless pipeline (Supabase + Edge Functions + pg_cron).

A red-team review on 2026-03-23 identified critical issues:

1. **Zero validated demand.** No usage instrumentation exists. No external API calls, certificate shares, or agent claims have been measured. Every product decision was derived from code inspection, not market signal.

2. **Explorer drift.** 4 of 6 pages (Feed, Graph, Discovery, Agent Dossier) present as explorer surfaces. 8004scan already covers the explorer axis with registry, browse, leaderboard, and feedback flows.

3. **Conflated wedge.** The original roadmap called Trust Certificate + API + SDK "the wedge" — conflating a visual artifact, a data service, and a distribution wrapper that serve different buyers.

4. **Shipping over validation.** The 30/60/90 plan invested 60 days of building before checking demand. For a pre-PMF product, this is backwards.

## Decision

Pivot DenScope's positioning, navigation, and investment priorities from "ERC-8004 explorer" to "trust scoring API for ERC-8004 agents."

Specific decisions:

### D1: Insert Phase 0 validation sprint before all roadmap work
- 14 days of instrumentation + user conversations before any new features
- Explicit kill criteria if all metrics are zero

### D2: Define the wedge as the scored trust data, not the UI
- The API is the product. The certificate is the distribution surface. The SDK is the convenience layer.
- If API calls grow but page views don't, follow the API.

### D3: Restructure navigation to 3 items
- Explore (current feed, moved off root), Console, Developers
- Remove Graph and Discovery from main nav
- Root (/) becomes trust-focused landing page

### D4: Reframe Discovery as TrustOps beta (internal/gated only)
- Discovery is no longer a public-core navigation surface
- Gate behind Console auth — only accessible to authenticated claimed-agent owners
- Show only claimed agents' signals
- Status: internal validation surface, not treated as validated product value
- Validate as operator tool, not consumer feature
- Decision to promote (only with engagement evidence), keep as internal beta, or remove at 90 days

### D5: Gate all expansion on demand metrics
- Multichain: >5 external requests for a specific chain
- Trust Score v2: >100 score queries/week
- New detection rules: >3 claimed agents in TrustOps
- x402 marketing: >0 external payments

### D6: Console must prove activation before further investment
- Instrument: SIWE logins, claims, alert rules, API key creation
- No new Console features until activation metrics exist

## Consequences

### Positive
- Clear product positioning (trust API, not explorer)
- Reduced surface area (3 nav items, not 6)
- Validation-first approach prevents wasted effort
- Explicit go/no-go gates prevent sunk-cost continuation
- Detection rules preserved (TrustOps beta) without confusing public nav

### Negative
- Graph and Discovery become less discoverable (acceptable: Graph has zero product utility; Discovery is being tested as gated tool)
- Landing page pivot requires frontend work before new features
- Phase 0 delays feature shipping by 14 days (acceptable: the cost of validation is 2 weeks; the cost of building without validation is 3 months)
- Kill criteria force uncomfortable honesty about demand

### Neutral
- x402 code remains but is de-prioritized for marketing (no engineering cost, just positioning)
- MCP server gets tests but not promotion until self-validated
- Trust Score v1 formula unchanged (spec v2 at Phase 3 only)

## Alternatives Considered

### A1: Continue building as explorer
**Rejected.** 8004scan owns this. Adding more explorer features (better graph, discovery redesign, leaderboards) competes on their axis. DenScope's differential assets (trust scoring, certificates, programmatic API, x402) are not explorer features.

### A2: Pause DenScope entirely and focus on Ayni
**Deferred.** This becomes the recommendation if Phase 0 and Phase 1 both fail validation gates. DenScope has significant built infrastructure (21 endpoints, SDK, pipeline) that deserves a validation attempt before archiving.

### A3: Pivot to B2B security monitoring (TrustOps-first)
**Deferred as conditional path.** If TrustOps beta (Phase 2) shows engagement from claimed agent owners, this becomes the primary product direction. The detection rules and alerting infrastructure already support this. But the buyer persona (protocol security teams) is untested.

### A4: Ship the 30/60/90 plan without Phase 0
**Rejected.** Building for 60 days before measuring demand is a pre-PMF antipattern. The 14-day Phase 0 cost is minimal relative to the 90-day plan cost.

## Review Trigger

This ADR must be revisited if any of the following becomes true:

- **10+ weekly active developers** using the API — may indicate the product thesis is validated and the ADR's cautious framing can be relaxed
- **3+ external integrations** consuming trust-sdk — may justify accelerating multichain or v2 scoring
- **TrustOps Beta outperforms certificate/API engagement** — may indicate the real wedge is anomaly detection for operators, not trust certificates for end-users. If this occurs, reconsider D4 (Discovery as beta) and evaluate promoting TrustOps to primary product surface
- **API thesis underperforms while signals/alerts usage grows materially** — may indicate the buyer is protocol security teams, not developers. Reconsider A3 (B2B security monitoring pivot)
- **Phase 0 kill criteria are met** — triggers A2 (pause DenScope) evaluation

Review should produce one of: reaffirm, amend with new decisions, or supersede with ADR-002.

## Rejected Paths

These should not be built unless explicit demand criteria are met:

| Path | Why Rejected | Revisit Condition |
|------|-------------|-------------------|
| Multichain expansion | Zero single-chain demand proven | >5 external requests for a chain |
| Trust Score v2 implementation | v1 has zero measured consumers | >100 queries/week + feedback that v1 is insufficient |
| Discovery UX redesign (Issue #133) | Discovery as public page is mispositioned | TrustOps beta shows engagement |
| Graph improvements | Demo artifact with zero product utility | Never (remove from nav) |
| Mobile app | Zero web usage proven | >1000 weekly active users |
| Email/SMS alerts | Zero webhook alert usage proven | >10 alert rules created |
| Agent comparison/leaderboard | Explorer drift | Never (8004scan territory) |
| Embed system expansion | Zero evidence of external embedding | >5 external embeds detected |
