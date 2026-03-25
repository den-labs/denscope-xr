# DenScope Roadmap: Trust Infrastructure Q2 2026

**Date:** 2026-03-23
**Status:** Approved (pending Phase 0 validation)
**Owner:** wolfcito
**Repo:** den-labs/denscope-xr

---

## Context

DenScope launched as an ERC-8004 agent explorer. Over 10 milestones it shipped a Live Feed, Graph visualization, Discovery signals page, Console (SIWE auth, agent registration, alerts, API keys), Agent Dossier with Trust Certificates, a REST API (21 endpoints, 3 auth methods), and a published SDK monorepo on npm.

The engineering is mature (252 tests, production-deployed). The product-market fit is unproven. Zero external demand has been measured. No usage instrumentation exists. The roadmap pivots from "ship more features" to "validate the thesis, then ship what's demanded."

Competitor context: 8004scan covers agent registry, browse, leaderboard, feedback, and creation flows. DenScope cannot win on the explorer axis. Trust scoring, certificates, and programmatic API access are unclaimed territory.

## Product Thesis (Under Validation)

DenScope is testing whether **trust scoring for ERC-8004 agents** is a demanded product category. The hypothesis: a programmable, verifiable, chain-agnostic trust layer — consumed by agent owners (certificates), developers (REST API + SDK), and AI systems (MCP server) — addresses a real gap in the ecosystem.

The product is the **scored trust data available programmatically**. The certificate and dossier page are **distribution surfaces** for the underlying data product.

**This thesis is not yet proven.** All roadmap phases are gated on demand evidence. If validation fails, the thesis will be revised or abandoned.

## Strategic Priorities

| Priority | Rationale |
|----------|-----------|
| 1. Validate before building | No more features until demand is instrumented and tested |
| 2. Lead with API/SDK | Programmatic consumption scales; UI does not |
| 3. Trust Certificate as distribution | Shareable artifact that creates awareness for the API |
| 4. Console is guilty until activated | Console is only core if it proves activation through measurable actions (SIWE logins, claims, API key creation, alert setup). No new Console features until activation metrics exist. |
| 5. Avoid explorer drift | Reject any work whose primary value is "show more data" |

## Validation Gates

Every phase requires passing a gate before the next phase begins.

| Gate | Phase | Criteria |
|------|-------|----------|
| G0 | Phase 0 exit | Instrumentation live + 5 conversations complete + baseline metrics documented |
| G1 | Phase 1 exit | At least 2 of: 3+ API keys (with >50% making a first call), 5+ certificate shares, 50+ npm downloads |
| G2 | Phase 2 exit | At least 1 of: 10+ API keys, 1 external integration, 200+ npm downloads/month, 3+ TrustOps beta users |
| G3 | Phase 3 exit | Sustainable usage pattern OR honest pivot decision documented |

## Phase 0 — Validation Sprint (14 days)

**Objective:** Establish whether trust infrastructure has any external demand signal.

**Deliverables:**
1. Deploy analytics (Vercel Analytics or PostHog)
2. Run Supabase metric counts (api_keys, owner_profiles, certificate_snapshots, x402_payments)
3. Check npm download counts for all @denlabs packages
4. Conduct 5 structured conversations with potential users
5. Document baseline metrics and go/no-go decision

**Kill Criteria:** If after 14 days ALL of: zero API keys, zero certificate shares, zero claims, <20 visitors/week, and all conversations non-committal — pause the roadmap and reassess thesis.

## Phase 1 — Foundation (Days 15-44)

**Gate:** Phase 0 shows at least 2 of 5 proof points.

**Objective:** Make the trust data product accessible and measurable.

**Deliverables:**
1. Internal usage dashboard
2. Landing page pivot (trust-first messaging, score lookup, SDK CTA)
3. Navigation restructure (3 items: Explore, Console, Developers)
4. **Conditional:** MCP server test suite (20+ tests) — only prioritize if MCP surfaces in Phase 0 interviews, onboarding usage, or clear developer demand. Otherwise defer to Phase 2.
5. Close stale issues (#128, #129)

**Do Not Build:** Discovery redesign, Graph improvements, new detection rules, Trust Score v2, multichain, x402 marketing, new certificate features, embed improvements.

## Phase 2 — Developer Traction (Days 45-74)

**Gate:** Phase 1 success criteria met.

**Objective:** First external developers actively using SDK or API.

**Deliverables:**
1. Developer portal (/developers)
2. 1 real MCP server integration (self-validated, documented)
3. 2 content pieces published on 2+ channels
4. TrustOps beta (Discovery removed from public nav, gated behind Console auth, internal/beta validation surface only — NOT a public-core product surface)
5. trust-sdk E2E tests in CI

**Do Not Build:** Multichain, Trust Score v2, new API endpoints, payment tier changes, Graph.

## Phase 3 — Product-Market Signal (Days 75-104)

**Gate:** Phase 2 success criteria met.

**Objective:** Determine if trust infrastructure is a business.

**Deliverables:**
1. External usage dashboard in Console
2. Conditional: 1 new chain IF >5 external requests
3. Trust Score v2 spec (NOT implementation)
4. 1 partnership integration case study
5. Revenue model decision (x402 viable? API tiers?)
6. Product decision on TrustOps beta: promote to core (only if engagement proven), keep as internal beta, or remove entirely

**Conditional Rules:**
- Multichain: >5 unique external requests for a specific chain
- Score v2: >100 score queries/week
- New detection rules: >3 claimed agents using TrustOps
- x402 marketing: >0 external x402 payments

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Zero external demand | MEDIUM | CRITICAL | Phase 0 validation + kill criteria |
| Explorer drift | HIGH | HIGH | Non-goals doc + nav restructure |
| Solo operator bottleneck | HIGH | HIGH | Ruthless prioritization, async content |
| Certificate has no distribution | MEDIUM | HIGH | Track shares/verifications |
| x402 zero revenue | HIGH | LOW | Keep code, stop investment |
| 8004scan expands into trust | LOW | HIGH | Ship faster, establish API as standard |
| Trust Score v1 gameable | LOW | MEDIUM | Monitor patterns, spec v2 at Phase 3 |

## Success Metrics (90-day targets)

| Metric | Minimum | Strong | Pivot |
|--------|---------|--------|-------|
| External API keys | 10+ | 50+ | <5 |
| API key -> first call conversion | >50% | >75% | <25% |
| API calls/week | 100+ | 1000+ | <20 |
| npm downloads/month | 200+ | 1000+ | <50 |
| External integrations | 1+ | 3+ | 0 |
| Certificate shares | 10+ | 50+ | <3 |
| Claimed agents | 5+ | 20+ | <2 |

## Non-Goals

See [non-goals.md](./non-goals.md) for the full anti-drift memo.

Summary: DenScope is not an explorer, not a dashboard, not a certificate generator, not a platform, and not multichain by default.

## Final Decision

Approved with the constraint that Phase 0 (validation sprint) must execute before any Phase 1 work begins. All subsequent phases are gated by explicit go/no-go criteria. If 90-day metrics hit pivot thresholds, the team will document the pivot decision and redirect resources.
