# DenScope Q2 2026 Execution Pack

**Date:** 2026-03-23
**Source:** Hardened Strategy (2026-03-23-denscope-hardened-strategy.md)
**Repo:** den-labs/denscope-xr

---

## Milestones

### M-VAL: Validation Sprint
- **Goal:** Establish baseline metrics and qualitative demand signal before committing to feature work.
- **Scope:** Analytics deployment, Supabase metric counts, npm download tracking, 5 user conversations, go/no-go decision memo.
- **Exit Criteria:**
  - Vercel Analytics (or equivalent) live and tracking page views by route
  - Supabase counts documented: api_keys, owner_profiles, certificate_snapshots, x402_payments
  - npm download counts for @denlabs/trust-sdk, trust-client-core, ayni-sdk documented
  - 5 structured conversations completed and synthesized
  - Go/no-go memo written with decision and rationale
- **Duration:** 14 days

### M-FOUND: Foundation
- **Goal:** Make trust product accessible, measurable, and correctly positioned.
- **Scope:** Landing page pivot, nav restructure, MCP server tests, internal instrumentation dashboard, stale issue cleanup.
- **Exit Criteria:**
  - Root (/) shows trust-focused landing with score lookup
  - Nav collapsed to 3 items (Explore, Console, Developers)
  - MCP server has 20+ passing tests
  - Instrumentation dashboard operational (daily metric tracking)
  - Issues #128, #129 verified and closed
  - Phase 2 gate evaluated: at least 2 of (3+ API keys with >50% first-call conversion, 5+ certificate shares, 50+ npm downloads)
- **Duration:** 30 days (days 15-44)

### M-DEVTRACT: Developer Traction
- **Goal:** Convert awareness into first external developer integrations.
- **Scope:** Developer portal, MCP integration validation, content publishing, TrustOps beta, E2E CI.
- **Exit Criteria:**
  - /developers page live with SDK + API + MCP docs
  - 1 MCP server integration documented (self-validated)
  - 2 content pieces published on 2+ channels
  - TrustOps beta (internal/gated validation surface, NOT public nav) available to claimed agents only
  - trust-sdk E2E tests running in GitHub Actions
  - Phase 3 gate evaluated: at least 1 of (10+ API keys, 1 external integration, 200+ npm downloads/month, 3+ TrustOps users)
- **Duration:** 30 days (days 45-74)

### M-PMF: Product-Market Signal
- **Goal:** Determine if trust infrastructure is a sustainable product.
- **Scope:** Usage dashboard, conditional chain expansion, Trust Score v2 spec, partnership case study, revenue model decision.
- **Exit Criteria:**
  - Usage metrics dashboard in Console
  - Revenue model decision documented (x402 viable? tier upgrades?)
  - TrustOps decision made (promote to core ONLY if engagement proven / keep as internal beta / remove entirely)
  - If demand exists: 1 partnership case study
  - If demand absent: pivot decision documented
- **Duration:** 30 days (days 75-104)

---

## GitHub Project Structure

### Project Board: "DenScope Q2 2026"

**Views:**

| View | Type | Purpose |
|------|------|---------|
| Board | Kanban | Day-to-day execution tracking |
| Roadmap | Timeline | Phase visualization with milestone markers |
| Backlog | Table | All issues sorted by priority + milestone |

**Custom Fields:**

| Field | Type | Values |
|-------|------|--------|
| Phase | Single select | Phase 0, Phase 1, Phase 2, Phase 3 |
| Epic | Single select | E-INSTRUMENT, E-CONVERSATIONS, E-LANDING, E-NAV, E-MCP-TESTS, E-CLEANUP, E-DEVPORTAL, E-MCP-INTEGRATION, E-CONTENT, E-TRUSTOPS-BETA, E-E2E-CI, E-METRICS-DASH, E-CONDITIONAL-CHAIN, E-SCORE-V2-SPEC, E-PARTNERSHIP, E-REVENUE-EVAL |
| Owner Type | Single select | product, frontend, backend, infra, docs |
| Gate | Single select | G0, G1, G2, G3, none |

**Statuses:**

| Status | Meaning |
|--------|---------|
| Backlog | Not yet scheduled |
| Ready | Scheduled for current phase, unblocked |
| In Progress | Actively being worked on |
| In Review | PR open or awaiting verification |
| Blocked | Waiting on dependency or decision |
| Done | Merged and verified |

**Priority Scheme:**

| Priority | Label | Meaning |
|----------|-------|---------|
| P0 | priority/critical | Must ship for phase to succeed |
| P1 | priority/high | Should ship, phase weakened without it |
| P2 | priority/normal | Valuable but deferrable |
| P3 | priority/low | Nice-to-have, do if time allows |

**Milestone Mapping:**

| Milestone | Phase | Gate |
|-----------|-------|------|
| M-VAL | Phase 0 | G0 |
| M-FOUND | Phase 1 | G1 |
| M-DEVTRACT | Phase 2 | G2 |
| M-PMF | Phase 3 | G3 |

**Labels to Create:**

```
phase/0-validation
phase/1-foundation
phase/2-traction
phase/3-pmf
epic/instrument
epic/conversations
epic/landing
epic/nav
epic/mcp-tests
epic/cleanup
epic/devportal
epic/mcp-integration
epic/content
epic/trustops-beta
epic/e2e-ci
epic/metrics-dash
type/feat
type/chore
type/test
type/docs
type/decision
type/research
priority/critical
priority/high
priority/normal
priority/low
owner/product
owner/frontend
owner/backend
owner/infra
owner/docs
```

---

## GitHub Instantiation Rules

**Phases are gated. GitHub artifacts must reflect this.**

- **Create now:** All 4 milestones, labels, project board, Phase 0 issues only.
- **Create as draft/backlog:** A small subset of clearly-defined Phase 1 issues (landing pivot, nav restructure, instrumentation dashboard) may be created in Backlog status — but NOT assigned, NOT scheduled, and NOT worked on until Phase 0 gate passes.
- **Do NOT create yet:** Full Phase 1 issue pack, any Phase 2 issues, any Phase 3 issues. These will be instantiated only after their prior gate passes.
- **Rationale:** Creating future-phase issues prematurely creates false momentum, dilutes focus, and encourages working ahead of validation. Keep GitHub aligned with gated execution, not aspirational planning.

---

## Epic Issue Pack

### E-INSTRUMENT — Usage Instrumentation
- **Goal:** Cannot validate without data. Every downstream decision depends on metrics.
- **Issues:** #V1, #V2
- **Sequence:** #V1 first (deploy analytics), then #V2 (Supabase + npm counts). Both week 1.
- **Blockers:** None. This is the unblocking epic.

### E-CONVERSATIONS — User Research
- **Goal:** Qualitative signal on whether trust infrastructure is demanded.
- **Issues:** #V3, #V4
- **Sequence:** #V3 (prepare scripts) then #V4 (conduct + synthesize). Parallel with E-INSTRUMENT.
- **Blockers:** None.

### E-LANDING — Landing Page Pivot
- **Goal:** Root (/) communicates "trust infrastructure" not "explorer."
- **Issues:** #F1
- **Sequence:** After Phase 0 go decision.
- **Blockers:** Phase 0 go/no-go (Issue #V5).

### E-NAV — Navigation Restructure
- **Goal:** Collapse nav from 6 items to 3. Remove explorer surfaces.
- **Issues:** #F2
- **Sequence:** Parallel with E-LANDING. After Phase 0 go decision.
- **Blockers:** Phase 0 go/no-go (Issue #V5).

### E-MCP-TESTS — MCP Server Quality (CONDITIONAL)
- **Goal:** Published tool with 0 tests is a reputational risk.
- **Condition:** Only prioritize in Phase 1 if MCP surfaces in Phase 0 interviews, onboarding usage, or clear developer demand. If no MCP signal in Phase 0, defer to Phase 2.
- **Issues:** #F3
- **Sequence:** After Phase 0 go decision. No dependency on E-LANDING or E-NAV.
- **Blockers:** Phase 0 go/no-go (Issue #V5) + MCP demand signal.

### E-CLEANUP — Issue Hygiene
- **Goal:** Close stale issues, reduce false noise.
- **Issues:** #F4
- **Sequence:** Anytime in Phase 1.
- **Blockers:** None.

### E-DEVPORTAL — Developer Portal
- **Goal:** Unified "start here" for developers.
- **Issues:** #D1
- **Sequence:** Start of Phase 2.
- **Blockers:** E-MCP-TESTS (documentation accuracy).

### E-MCP-INTEGRATION — MCP Validation
- **Goal:** Prove MCP server works in a real AI workflow.
- **Issues:** #D2
- **Sequence:** After E-MCP-TESTS.
- **Blockers:** #F3 (MCP tests passing).

### E-CONTENT — Developer Content
- **Goal:** Distribution. Engineering without outreach = zero adoption.
- **Issues:** #D3, #D4
- **Sequence:** After E-DEVPORTAL (link target for content).
- **Blockers:** #D1 (developer portal live).

### E-TRUSTOPS-BETA — Discovery as Internal/Gated Validation Surface
- **Goal:** Test whether anomaly detection has value for agent operators. Discovery is NO LONGER a public-core nav surface. It is reframed as TrustOps Beta — an internal, gated validation surface only surfaced to authenticated claimed-agent owners. It must not be treated as validated product value.
- **Issues:** #D5
- **Sequence:** Phase 2, weeks 3-4.
- **Blockers:** Console auth working, instrumentation from E-INSTRUMENT.

### E-E2E-CI — SDK E2E in CI
- **Goal:** Prevent API regressions. 24 E2E tests exist but are skipped.
- **Issues:** #D6
- **Sequence:** Phase 2, no hard dependencies.
- **Blockers:** None.

---

## Draft GitHub Issues

### Phase 0 — Validation Sprint (M-VAL)

---

#### #V1: Deploy analytics and track page views by route

**Background:** DenScope has been live for months with zero usage instrumentation. Every product decision is derived from code inspection, not user behavior. This is the single highest-leverage task.

**Objective:** Deploy analytics tracking so page views, unique visitors, and referral sources are visible daily.

**Scope:**
- Deploy Vercel Analytics (built-in, 1-click) or PostHog (self-hosted, more granular)
- Verify tracking on all 6 page routes (/, /graph, /discovery, /console, /agent/[chain]/[id], /docs/api)
- Verify tracking on /verify/[hash] (certificate verification)
- Document how to access the dashboard

**Out of Scope:** Custom event tracking, funnel analysis, A/B testing, PostHog feature flags.

**Acceptance Criteria:**
- [ ] Analytics deployed and visible in dashboard
- [ ] Page views tracked by route for all main pages
- [ ] Unique visitor count available
- [ ] Referral sources visible (if supported)
- [ ] Dashboard URL documented in docs/ or README

**Dependencies:** None
**Labels:** phase/0-validation, epic/instrument, type/chore, priority/critical, owner/infra
**Milestone:** M-VAL

---

#### #V2: Establish baseline Supabase and npm metrics

**Background:** Supabase tables contain evidence of product usage (api_keys, owner_profiles, certificate_snapshots, x402_payments) but these have never been counted. npm download counts for @denlabs packages are unknown.

**Objective:** Run counts on all relevant tables and npm packages. Document as baseline.

**Scope:**
- Query Supabase: `SELECT COUNT(*) FROM api_keys`, `owner_profiles`, `certificate_snapshots`, `x402_payments`, `alert_rules`, `siwe_nonces` (distinct used nonces)
- Cross-reference api_keys with api_usage_log to compute API key -> first successful call conversion rate
- Query npm: `npm view @denlabs/trust-sdk`, `@denlabs/trust-client-core`, `@denlabs/ayni-sdk` (check weekly downloads)
- Document all numbers in a baseline-metrics.md file
- Include the date and exact queries used for reproducibility

**Out of Scope:** Building a dashboard, automated tracking, historical analysis.

**Acceptance Criteria:**
- [ ] All Supabase table counts documented
- [ ] npm download counts for 3 packages documented
- [ ] baseline-metrics.md committed to docs/roadmap/
- [ ] Numbers include date stamp

**Dependencies:** Supabase access
**Labels:** phase/0-validation, epic/instrument, type/research, priority/critical, owner/infra
**Milestone:** M-VAL

---

#### #V3: Prepare structured conversation scripts for 5 personas

**Background:** No qualitative user research has been conducted. The trust infrastructure thesis is untested with potential users.

**Objective:** Write conversation scripts for 5 target personas with focused questions that distinguish "interesting idea" from "I would use this."

**Scope:**
- 5 scripts, one per persona: agent owner, dApp developer, protocol security, AI agent builder, ecosystem participant
- Each script: 5-7 questions, max 15 minutes
- Must include: "Would you pay for this?" and "What would you do with a trust score?"
- Must avoid: leading questions, feature demos, pitching

**Out of Scope:** Conducting conversations (separate issue), survey tools, landing page tests.

**Acceptance Criteria:**
- [ ] 5 conversation scripts written
- [ ] Each script has clear persona definition, questions, and success signal
- [ ] Scripts distinguish polite interest from actionable demand
- [ ] Saved to docs/roadmap/research/

**Dependencies:** None
**Labels:** phase/0-validation, epic/conversations, type/research, priority/critical, owner/product
**Milestone:** M-VAL

---

#### #V4: Conduct 5 user conversations and synthesize findings

**Background:** Scripts prepared in #V3. Now execute conversations and synthesize.

**Objective:** Talk to 5 people from target personas. Document what resonated, what didn't, and which persona showed strongest signal.

**Scope:**
- Identify and reach out to 5 candidates (DM, ecosystem channels, existing contacts)
- Conduct conversations using prepared scripts
- Take notes per conversation
- Write 1-page synthesis: strongest persona, weakest persona, key quotes, demand signals, concerns

**Out of Scope:** Surveys, paid research, more than 5 conversations in this phase.

**Acceptance Criteria:**
- [ ] 5 conversations completed
- [ ] Individual notes per conversation saved
- [ ] 1-page synthesis memo with: strongest/weakest persona, key quotes, demand signal assessment
- [ ] Recommendation on which sub-hypothesis to pursue (certificate, API, signals)

**Dependencies:** #V3 (scripts ready)
**Labels:** phase/0-validation, epic/conversations, type/research, priority/critical, owner/product
**Milestone:** M-VAL

---

#### #V5: Phase 0 go/no-go decision

**Background:** Phase 0 metrics and conversations are complete. Time to make the call.

**Objective:** Review all data and make an explicit decision: proceed with Phase 1, pivot, or pause.

**Scope:**
- Review analytics data (if 14 days of tracking exists)
- Review Supabase baseline metrics
- Review npm download counts
- Review conversation synthesis
- Apply kill criteria from hardened strategy
- Write decision memo: go (proceed to Phase 1), pivot (new thesis), or pause (redirect resources)

**Out of Scope:** Any implementation work. This is a decision gate.

**Acceptance Criteria:**
- [ ] Decision memo written with: metrics summary, conversation synthesis, decision, rationale
- [ ] If go: confirm which sub-hypothesis (certificate, API, signals) to lead with
- [ ] If go: confirm Phase 1 scope unchanged or adjusted based on findings
- [ ] If no-go: document pivot options with rationale
- [ ] Memo committed to docs/roadmap/decisions/

**Dependencies:** #V1, #V2, #V4
**Labels:** phase/0-validation, type/decision, priority/critical, owner/product
**Milestone:** M-VAL

---

### Phase 1 — Foundation (M-FOUND)

---

#### #F1: Landing page pivot — trust-first messaging with score lookup

**Background:** Root (/) shows a Live Feed, positioning DenScope as an explorer. The validated thesis (from Phase 0) requires trust-first messaging. Current feed moves to /explore.

**Objective:** Replace root page with trust-focused landing.

**Scope:**
- Hero section: "Trust infrastructure for autonomous agents" (or validated messaging from Phase 0)
- Score lookup widget: chain selector + agent ID input -> navigates to /agent/[chain]/[id]
- Featured certificates section: pull latest 3-6 from certificate_snapshots
- "Get started" CTA: links to /developers (or /docs/api until developer portal ships)
- Move current Live Feed to /explore
- Add redirect: ensure /feed or any bookmarks to old feed still work

**Out of Scope:** Full marketing site, pricing page, blog, testimonials, animation polish.

**Acceptance Criteria:**
- [ ] Root (/) shows trust-focused landing page
- [ ] Score lookup widget navigates to /agent/[chain]/[id]
- [ ] Featured certificates pulled from Supabase
- [ ] SDK/API CTA visible above fold
- [ ] Live Feed accessible at /explore
- [ ] All existing tests pass
- [ ] Lighthouse performance score >= 90

**Dependencies:** #V5 (Phase 0 go decision)
**Labels:** phase/1-foundation, epic/landing, type/feat, priority/critical, owner/frontend
**Milestone:** M-FOUND

---

#### #F2: Restructure navigation to 3-item trust-focused nav

**Background:** 6-item nav reads as "explorer." Must collapse to communicate trust infrastructure.

**Objective:** Main nav: Explore, Console, Developers. Remove Graph and Discovery from nav.

**Scope:**
- Update desktop nav component
- Update mobile dropdown menu
- /graph accessible at /labs/graph (or just /graph via direct URL, not in nav)
- /discovery accessible via direct URL, not in nav
- Ensure theme toggle remains accessible
- Add redirects if any routes change path

**Out of Scope:** Removing Graph or Discovery code, changing route paths (only nav visibility).

**Acceptance Criteria:**
- [ ] Main nav shows exactly: Explore, Console, Developers
- [ ] Mobile menu matches desktop nav
- [ ] /graph still renders when accessed directly
- [ ] /discovery still renders when accessed directly
- [ ] Theme toggle accessible
- [ ] All tests pass

**Dependencies:** None (can parallel with #F1)
**Labels:** phase/1-foundation, epic/nav, type/feat, priority/high, owner/frontend
**Milestone:** M-FOUND

---

#### #F3: MCP server unit test suite

**Background:** MCP server published to npm with 5 tools and 0 tests. Returning incorrect trust data from an MCP tool is a reputational risk for a trust product.

**Objective:** Write vitest suite covering all 5 MCP tools with happy path and error cases.

**Scope:**
- Tests for: trust_get_score, trust_get_agent, trust_get_signals, trust_search_agents, trust_get_events
- Oracle resolution: valid oracle (denscope, ayni), invalid oracle, case sensitivity
- Chain resolution: by name ("celo", "fuji"), by numeric ID (42220), invalid chain
- Response formatting: verify humanized output matches expected format
- Error handling: network errors, 401/403, 404, malformed responses
- Mock fetch (same pattern as trust-client-core tests)

**Out of Scope:** E2E tests against live endpoints, MCP protocol-level tests, integration with actual MCP client.

**Acceptance Criteria:**
- [ ] 20+ tests covering all 5 tools
- [ ] Happy path for each tool
- [ ] Error cases for each tool (invalid oracle, invalid chain, network error)
- [ ] Oracle resolution edge cases
- [ ] Chain name vs numeric ID resolution
- [ ] All tests pass: `pnpm --filter @denlabs/trust-mcp-server test`

**Dependencies:** None
**Labels:** phase/1-foundation, epic/mcp-tests, type/test, priority/high, owner/backend
**Milestone:** M-FOUND

---

#### #F4: Verify and close stale issues #128, #129

**Background:** Issues #128 (Discovery DB seeding) and #129 (Realtime subscription drops) appear fixed in commit 10f2d48 but remain open on GitHub.

**Objective:** Verify fixes are working and close issues.

**Scope:**
- Test Discovery page loads with DB-seeded signals (not session-only)
- Test Realtime subscription survives page navigation (navigate away and back)
- Close both issues with commit reference if confirmed fixed
- Reopen with reproduction steps if still broken

**Out of Scope:** Any Discovery improvements or redesign work.

**Acceptance Criteria:**
- [ ] #128 verified: Discovery shows signals from DB on page load
- [ ] #129 verified: Realtime subscription persists across navigation
- [ ] Both issues closed with reference to fixing commit
- [ ] OR issues reopened with clear reproduction steps

**Dependencies:** None
**Labels:** phase/1-foundation, epic/cleanup, type/chore, priority/normal, owner/backend
**Milestone:** M-FOUND

---

#### #F5: Internal instrumentation dashboard

**Background:** Phase 0 established baseline metrics manually. Phase 1 needs ongoing daily tracking to evaluate Phase 2 gate.

**Objective:** Create an internal page or script that surfaces key metrics daily.

**Scope:**
- Supabase queries: api_keys count (total, last 7d), api_usage_log count (last 7d), owner_profiles count, certificate_snapshots count (total, last 7d), x402_payments count
- Display in one of: internal Next.js page (/internal/metrics, no nav link), CLI script, or Supabase dashboard
- Must be refreshable on demand

**Out of Scope:** External-facing dashboard, historical trends, charts, alerting.

**Acceptance Criteria:**
- [ ] All key metrics queryable on demand
- [ ] Refresh takes <5 seconds
- [ ] Documented: how to access, what each metric means
- [ ] Updated daily during Phase 1

**Dependencies:** #V1 (analytics), #V2 (baseline established)
**Labels:** phase/1-foundation, epic/instrument, type/feat, priority/high, owner/infra
**Milestone:** M-FOUND

---

### Phase 2 — Developer Traction (M-DEVTRACT)

---

#### #D1: Unified developer portal at /developers

**Background:** /docs/api is a single page with examples. Developers need a comprehensive "start here" that covers SDK, API, MCP, and authentication in a structured way.

**Objective:** Build /developers page as the single entry point for all developer documentation.

**Scope:**
- Sections: Quick Start, SDK (trust-sdk), API Reference (all v1 endpoints), MCP Server, Authentication (API key, x402)
- Code snippets with copy-to-clipboard (TypeScript, curl, MCP config JSON)
- All examples verified against live endpoints
- /docs/api redirects to /developers

**Out of Scope:** Interactive API playground, Swagger/OpenAPI spec, video tutorials, versioned docs.

**Acceptance Criteria:**
- [ ] /developers page live with all sections
- [ ] Every code snippet tested and working
- [ ] Copy-to-clipboard on all code blocks
- [ ] /docs/api redirects to /developers
- [ ] Page renders without layout issues on mobile
- [ ] All tests pass

**Dependencies:** #F3 (MCP tests, for documentation accuracy)
**Labels:** phase/2-traction, epic/devportal, type/feat, priority/critical, owner/frontend
**Milestone:** M-DEVTRACT

---

#### #D2: Validate MCP server in real Claude Code workflow

**Background:** The MCP server has 5 tools and (after #F3) tests, but has never been used in a real workflow. Cannot recommend externally without self-validation.

**Objective:** Integrate trust-mcp-server into Claude Code. Document setup, usage, and friction.

**Scope:**
- Configure MCP server in Claude Code settings (settings.json)
- Use all 5 tools in a real task (e.g., "check trust score of agent X before interacting")
- Document: setup steps, config JSON, what worked, what was confusing, data quality
- Write integration guide (markdown, committed to trust-sdk repo)
- Log friction points as issues in trust-sdk repo

**Out of Scope:** GPT integration, other MCP clients, automated testing of MCP flows.

**Acceptance Criteria:**
- [ ] MCP server configured and running in Claude Code
- [ ] All 5 tools invoked successfully with real agent data
- [ ] Integration guide committed to trust-sdk docs/
- [ ] Friction points logged as issues (if any)
- [ ] Setup reproducible by following the guide

**Dependencies:** #F3 (MCP tests passing)
**Labels:** phase/2-traction, epic/mcp-integration, type/research, priority/critical, owner/backend
**Milestone:** M-DEVTRACT

---

#### #D3: Publish "Why Trust Scores Matter for AI Agents"

**Background:** Zero distribution effort has been made. Engineering without outreach produces zero adoption.

**Objective:** Write and publish 1 long-form piece explaining the trust thesis with DenScope as the concrete solution.

**Scope:**
- 800-1200 words
- Structure: Problem (agents have no reputation) -> Why it matters (delegation, payments, collaboration) -> Solution (DenScope trust API) -> How it works (3-line SDK example)
- Publish on: Twitter/X thread, Farcaster, 1 ecosystem channel (Celo Discord or ERC-8004 forum)
- Include links to /developers and @denlabs/trust-sdk npm page

**Out of Scope:** Paid promotion, video, podcast, design assets beyond basic images.

**Acceptance Criteria:**
- [ ] Article written and reviewed
- [ ] Published on at least 2 channels
- [ ] Includes working links to /developers and npm
- [ ] Engagement tracked (likes, replies, clicks if measurable)

**Dependencies:** #D1 (developer portal as link target)
**Labels:** phase/2-traction, epic/content, type/docs, priority/critical, owner/product
**Milestone:** M-DEVTRACT

---

#### #D4: Publish "Query Agent Trust in 3 Lines of TypeScript"

**Background:** Developers need concrete, copy-paste examples. A tutorial-style piece complements the thesis piece (#D3).

**Objective:** Write and publish a practical tutorial showing SDK usage.

**Scope:**
- 500-800 words
- Code-heavy: install SDK, create client, get score — with real output
- Cover: API key mode, x402 mode (optional), error handling
- Publish on: same channels as #D3

**Out of Scope:** Full API walkthrough, MCP tutorial (separate if needed), video.

**Acceptance Criteria:**
- [ ] Tutorial written with verified code examples
- [ ] Published on at least 2 channels
- [ ] Code examples copy-paste-runnable
- [ ] Links to /developers for deeper docs

**Dependencies:** #D1 (developer portal)
**Labels:** phase/2-traction, epic/content, type/docs, priority/high, owner/docs
**Milestone:** M-DEVTRACT

---

#### #D5: Gate Discovery behind Console as TrustOps beta

**Background:** Discovery is mispositioned as a public explorer surface. The detection rules are valuable but need validation as an operator tool for claimed agent owners.

**Objective:** Gate Discovery behind SIWE auth, rebrand as "TrustOps (Beta)", filter to user's claimed agents.

**Scope:**
- Require authenticated session to access /discovery (or move to /console/trustops)
- Filter signals: only show incidents for the logged-in user's claimed agents
- Add "TrustOps (Beta)" label in page header
- Track page views and engagement via instrumentation

**Out of Scope:** UX redesign (Issue #133 deferred), new detection rules, notification improvements.

**Acceptance Criteria:**
- [ ] Unauthenticated users cannot access Discovery/TrustOps
- [ ] Authenticated users see only their claimed agents' signals
- [ ] "TrustOps (Beta)" label visible
- [ ] Page view tracking active
- [ ] All tests pass

**Dependencies:** Console auth working, instrumentation (#V1)
**Labels:** phase/2-traction, epic/trustops-beta, type/feat, priority/normal, owner/frontend
**Milestone:** M-DEVTRACT

---

#### #D6: Enable trust-sdk E2E tests in GitHub Actions

**Background:** 24 E2E tests exist in trust-sdk but are permanently skipped (require API keys). API regressions go undetected between releases.

**Objective:** Run E2E tests in CI against production with scoped API keys.

**Scope:**
- GitHub Actions workflow: run on PR + push to main
- Repository secrets: DENSCOPE_API_KEY, AYNI_API_KEY
- Test execution: both trust-sdk and ayni-sdk E2E suites
- Failure blocks merge

**Out of Scope:** Staging environment, test data seeding, new E2E tests.

**Acceptance Criteria:**
- [ ] GitHub Actions workflow file committed
- [ ] Secrets configured in repository settings
- [ ] E2E tests run and pass on CI
- [ ] PR check blocks merge on failure
- [ ] Workflow documented in trust-sdk CONTRIBUTING.md or README

**Dependencies:** None
**Labels:** phase/2-traction, epic/e2e-ci, type/test, priority/high, owner/backend
**Milestone:** M-DEVTRACT

---

### Phase 3 — Product-Market Signal (M-PMF)

Phase 3 issues are intentionally lighter. They will be refined based on Phase 2 learnings.

---

#### #P1: External usage metrics in Console

**Background:** If developers are using the API, they need visibility into their own usage. Also validates demand internally.

**Objective:** Add a metrics section to Console showing API key usage, rate limits, and call history.

**Scope:** Console page or section showing: calls this period, rate limit remaining, top endpoints called, last call timestamp.

**Out of Scope:** Analytics for all users (admin), billing, usage alerts.

**Acceptance Criteria:**
- [ ] Console shows per-key usage metrics
- [ ] Data sourced from api_usage_log
- [ ] Refreshes on page load

**Dependencies:** Phase 2 gate passed, api_usage_log has data
**Labels:** phase/3-pmf, epic/metrics-dash, type/feat, priority/high, owner/frontend
**Milestone:** M-PMF

---

#### #P2: CONDITIONAL — Add 1 new chain

**Background:** Multichain is gated by demand. This issue only activates if >5 external requests for a specific chain are documented.

**Objective:** Add support for 1 additional chain to the trust pipeline.

**Scope:** Chain config, Edge Function update, deploy_blocks entry, SDK wrapper, documentation update.

**Out of Scope:** More than 1 chain, chain-specific features.

**Acceptance Criteria:**
- [ ] Demand documented (>5 requests with source)
- [ ] Chain config added to denscope
- [ ] Edge Function polling new chain
- [ ] SDK wrapper updated
- [ ] Tests pass

**Dependencies:** >5 external requests documented
**Labels:** phase/3-pmf, epic/conditional-chain, type/feat, priority/normal, owner/backend
**Milestone:** M-PMF

---

#### #P3: Trust Score v2 spec (design only)

**Background:** v1 formula is basic (positive ratio + age + activity - incidents). Spec v2 based on real usage patterns. No implementation — spec only.

**Objective:** Write a design spec for Trust Score v2 incorporating time-decay, recency, and network effects.

**Scope:** Analyze v1 usage data, research scoring models, write spec with formula, weights, rationale. No code.

**Out of Scope:** Implementation, migration plan, backward compatibility analysis.

**Acceptance Criteria:**
- [ ] Spec written with proposed formula, weights, and rationale
- [ ] Analysis of v1 weaknesses based on real usage data
- [ ] Reviewed and committed to docs/

**Dependencies:** >100 score queries/week
**Labels:** phase/3-pmf, epic/score-v2-spec, type/docs, priority/normal, owner/product
**Milestone:** M-PMF

---

#### #P4: Revenue model decision

**Background:** x402 is built. API tiers exist. Neither has generated revenue. Must decide: double down, simplify, or remove.

**Objective:** Make an explicit decision on DenScope's revenue model.

**Scope:** Review: x402 payment count, API tier upgrade interest, willingness-to-pay from conversations, competitive pricing. Write decision memo.

**Out of Scope:** Implementation of new pricing, billing system.

**Acceptance Criteria:**
- [ ] Decision memo: keep x402, remove x402, add paid tiers, stay free, or other
- [ ] Rationale based on data (not assumption)
- [ ] Committed to docs/roadmap/decisions/

**Dependencies:** 90 days of metrics data
**Labels:** phase/3-pmf, epic/revenue-eval, type/decision, priority/critical, owner/product
**Milestone:** M-PMF

---

#### #P5: Discovery/TrustOps final decision

**Background:** TrustOps beta (Phase 2) tested Discovery as a gated operator tool. Now decide its future.

**Objective:** Promote TrustOps to core, keep as beta, or remove entirely.

**Scope:** Review TrustOps beta engagement metrics. Write decision memo.

**Out of Scope:** Implementation of whatever decision is made (that's a separate issue).

**Acceptance Criteria:**
- [ ] TrustOps engagement data reviewed (page views, time-on-page, return visits)
- [ ] Decision: promote / keep beta / remove
- [ ] Rationale documented
- [ ] Committed to docs/roadmap/decisions/

**Dependencies:** #D5 (TrustOps beta deployed), 30+ days of beta data
**Labels:** phase/3-pmf, type/decision, priority/high, owner/product
**Milestone:** M-PMF

---

## Issue Sequence Summary

```
Phase 0 (14 days):
  #V1  Deploy analytics                    [P0, infra]
  #V2  Baseline Supabase + npm metrics     [P0, infra]       depends: Supabase access
  #V3  Prepare conversation scripts        [P0, product]
  #V4  Conduct 5 conversations             [P0, product]     depends: #V3
  #V5  Go/no-go decision                   [P0, product]     depends: #V1, #V2, #V4

Phase 1 (30 days):
  #F1  Landing page pivot                  [P0, frontend]    depends: #V5 (go)
  #F2  Nav restructure                     [P1, frontend]    depends: #V5 (go)
  #F3  MCP server tests                    [P1, backend]     depends: #V5 (go)
  #F4  Close stale issues                  [P2, backend]
  #F5  Internal instrumentation dashboard  [P1, infra]       depends: #V1, #V2

Phase 2 (30 days):
  #D1  Developer portal                    [P0, frontend]    depends: #F3
  #D2  MCP integration validation          [P0, backend]     depends: #F3
  #D3  Content: "Why Trust Scores"         [P0, product]     depends: #D1
  #D4  Content: "3 Lines of TypeScript"    [P1, docs]        depends: #D1
  #D5  TrustOps beta                       [P2, frontend]    depends: #V1
  #D6  E2E tests in CI                     [P1, backend]

Phase 3 (30 days):
  #P1  Usage metrics in Console            [P1, frontend]
  #P2  CONDITIONAL: new chain              [P1, backend]     depends: >5 requests
  #P3  Trust Score v2 spec                 [P1, product]     depends: >100 queries/week
  #P4  Revenue model decision              [P0, product]
  #P5  TrustOps final decision             [P1, product]     depends: #D5
```

Total: 20 issues across 4 milestones.
