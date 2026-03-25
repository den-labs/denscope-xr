# DenScope Hardened Strategy Package

**Date:** 2026-03-23
**Role:** Principal Product Strategist + Red-Team Reviewer + TPM
**Input:** Full codebase audit (denscope 252 tests, 21 endpoints; trust-sdk 64 tests, 4 npm packages)
**Method:** Adversarial review of baseline roadmap + independent strategic assessment

---

# 1. Executive Verdict

- DenScope has shipped 10 milestones of engineering with zero milestones of validated demand. The product is overbuilt relative to proof of market pull.
- The claim "Trust Certificate is the wedge" is a founder hypothesis, not a market truth. No external user has generated a certificate, shared one, or verified one. The evidence is: it works. The missing evidence is: anyone cares.
- Console is labeled "product-critical" but has zero tracked activations. No data on API key creation rate, alert rule setup, or repeat logins. It's assumed critical, not proven critical.
- Discovery is correctly identified as mispositioned, but the original roadmap's recommendation to "pause and redistribute" is premature. The detection rules are the most defensible technical asset. They may BE the product for a different buyer (protocol security teams, agent operators) that hasn't been tested.
- The 30/60/90 plan is a shipping plan, not a validation plan. It assumes the wedge is correct and invests 90 days of building before checking. This is backwards for a pre-PMF product.
- 8004scan already owns "explore ERC-8004 agents." DenScope cannot win on that axis. But "trust scoring + certificates + programmatic API" is unclaimed territory. The question is whether that territory has inhabitants.
- The SDK is the strongest distribution asset but has zero external installs tracked. npm download count is the fastest signal of developer interest and it's not being monitored.
- x402 micropayments are a technical achievement looking for a customer. 22 tests, facilitator integration, payment recording — and the likely total revenue to date is $0.00.
- The MCP server is the most forward-looking asset (AI agents consuming trust programmatically) but is published with zero tests and zero known integrations. It's a bet on a future that may arrive, but it's untested.
- The single most important thing DenScope can do in the next 14 days is instrument usage and talk to 5 potential users. Not ship. Not redesign. Measure and listen.

---

# 2. Claims Under Attack

## Claim 1: "The wedge is Trust Certificate + API/SDK"

**Red-Team Attack:** This conflates three different products. The Certificate is a visual artifact (human consumption). The API is a data service (developer consumption). The SDK is a distribution wrapper (developer convenience). These serve different buyers with different needs. Calling all three "the wedge" means the wedge is undefined.

**Why It Might Fail:** Certificates are a nice-to-have unless there's a context where trust is REQUIRED. Who is required to show an agent trust certificate? Nobody, currently. The API is useful only if someone is building something that needs trust scores at runtime. The SDK is useful only if the API is useful.

**Missing Evidence:**
- Zero certificate shares tracked
- Zero certificate verifications tracked
- Zero external API calls tracked (or if tracked, not reported)
- Zero npm download data cited
- No user interview data on whether trust scores influence any real decision

**Hardening Move:** Split the wedge hypothesis into three testable sub-hypotheses:
1. H1: Agent owners want to display trust certificates (test: do they share them?)
2. H2: Developers want trust scores in their apps (test: do they create API keys?)
3. H3: AI agents want trust data at runtime (test: does anyone configure the MCP server?)
Track each independently. The wedge is whichever one shows pull first.

---

## Claim 2: "Console is product-critical"

**Red-Team Attack:** Console is product-critical for a product that has proven users. DenScope does not have proven users. Console is infrastructure for a growth phase that hasn't been earned. The features are real (SIWE auth, agent registration, alerts, API keys, incidents) but the assumption that "agent owners will manage their agents here" is untested.

**Why It Might Fail:** Agent owners may not know DenScope exists. Even if they find it, claiming an agent requires a wallet signature — friction. Setting up alerts requires understanding webhook URLs — technical. Creating API keys requires a use case — circular (need users who need the API). Console is a retention tool for users that haven't been acquired.

**Missing Evidence:**
- Zero SIWE login count reported
- Zero agent claim count reported
- Zero alert rule count reported
- Zero API key creation count reported

**Hardening Move:** Add instrumentation before investing more. Track: SIWE logins/week, claims/week, alert rules created, API keys created. If these are all zero after 30 days of the product being live, Console is premature.

---

## Claim 3: "Pause Discovery and Graph"

**Red-Team Attack:** This is correct for Graph (demo artifact). But for Discovery, the recommendation may be throwing away the most defensible technical moat. The 5 detection rules (reputation_drop, feedback_spike, sybil_cluster, first_blood, rising_star) are real-time anomaly detection on ERC-8004 agents. This is closer to "security monitoring" than "exploration." The original roadmap correctly says "redistribute the value" but doesn't explore who might actually pay for anomaly detection.

**Why It Might Fail:** If the real buyer is protocol security teams or agent operators who need alerts, hiding Discovery means hiding the one surface that demonstrates the monitoring capability. The problem isn't Discovery existing — it's Discovery being positioned as a consumer feature when it's an operator tool.

**Missing Evidence:**
- No exploration of the "TrustOps" buyer persona
- No assessment of whether alert rules (Console) are the right delivery mechanism for this value
- No competitive scan of agent security monitoring tools

**Hardening Move:** Don't kill Discovery. Reframe it as "TrustOps" — an internal/beta surface for agent operators. Gate it behind Console auth. Test whether claimed agent owners engage with their incident feeds. If they do, Discovery is the product for operators. If they don't, then pause it.

---

## Claim 4: "Restructure navigation around trust consumption"

**Red-Team Attack:** This assumes the current navigation is the reason people aren't using DenScope. It's more likely that people aren't using DenScope because they don't know it exists, not because the nav is wrong. Restructuring navigation is a local optimization on a product with a distribution problem.

**Why It Might Fail:** You can have the perfect nav structure and zero users. Nav restructure is low-cost but also low-impact if the bottleneck is awareness, not UX.

**Missing Evidence:**
- No traffic data cited (Vercel analytics?)
- No funnel data (how many visitors → how many reach agent dossier → how many generate certificate)
- No referral source data

**Hardening Move:** Instrument before restructuring. Add Vercel Analytics or PostHog. Track page views per surface for 14 days. If traffic data shows most visitors already reach /agent/[chain]/[id] organically (via OG cards, direct links), nav restructure matters less. If traffic shows everyone bounces from /, landing page matters more.

---

## Claim 5: "30/60/90 plan: restructure nav (30d) → developer adoption (60d) → validate demand (90d)"

**Red-Team Attack:** This is backwards. Validation should be Phase 0, not Phase 3. The plan invests 60 days of building before checking if anyone wants what's being built. A pre-PMF product should validate first, build second.

**Why It Might Fail:** After 90 days of shipping, if demand signals are zero, you've spent 90 days on the wrong thing. The cost of validation is 2 weeks. The cost of building without validation is 3 months.

**Missing Evidence:** The entire plan lacks user research. No interviews, no surveys, no usage data analysis. Every recommendation is derived from code inspection, not market signal.

**Hardening Move:** Insert Phase 0 (14-day validation sprint) before the 30/60/90 plan. Gate all subsequent phases on Phase 0 results.

---

## Claim 6: "x402 micropayments are incubating"

**Red-Team Attack:** "Incubating" is generous. x402 is a technical capability with zero revenue and zero paying users. The facilitator integration (UltravioletaDAO), the payment recording, the hybrid auth middleware — this is 22 tests of code serving a market that doesn't exist yet. Autonomous agents paying for trust data via HTTP 402 is a 2027+ scenario, not 2026.

**Why It Might Fail:** The x402 standard is nascent. The number of autonomous agents with USDC wallets that need trust scores is approximately zero today. Building payment infrastructure for a non-existent buyer is premature optimization.

**Missing Evidence:**
- Zero x402 payments recorded
- Zero evidence of autonomous agents needing trust scores at runtime
- No assessment of x402 standard adoption beyond DenLabs ecosystem

**Hardening Move:** Keep the code. Remove x402 from all marketing materials and documentation until there's at least 1 external x402 payment. Don't invest more engineering time.

---

## Claim 7: "MCP server is the distribution channel for AI agents"

**Red-Team Attack:** The MCP server is published with zero tests and zero known integrations. Publishing a package is not distribution. Distribution requires someone to install it, configure it, and use it. The MCP ecosystem is growing but DenScope's server hasn't been validated with any real AI agent workflow.

**Why It Might Fail:** MCP tool discovery is fragmented. An AI agent developer needs to know DenScope exists, understand why trust scores matter, find the MCP server, configure it, and then build a workflow around it. Each step has friction. Publication != adoption.

**Missing Evidence:**
- Zero known MCP integrations
- Zero npm installs tracked for @denlabs/trust-mcp-server
- No outreach to AI agent teams documented

**Hardening Move:** Write tests (30-day plan, agreed). But more importantly: manually integrate the MCP server into 1 Claude Code workflow and 1 GPT workflow. Document the experience. If you can't make it work smoothly yourself, no one else will.

---

# 3. Core Strategic Risks

## Product Risks

| Risk | Assessment |
|------|-----------|
| **Building for a buyer that doesn't exist** | HIGH. No evidence that agent owners, developers, or AI agents currently need trust scores. The entire product thesis rests on "trust matters" — which is true in theory but unproven in practice for ERC-8004. |
| **Certificate is artifact, not product** | MEDIUM. A trust certificate is a PDF with a QR code. The product is the scoring engine + the data pipeline + the API. If certificates are the wedge, the wedge is a presentation layer, not a moat. |
| **Conflating differentiation with demand** | HIGH. "Nobody else has this" is not the same as "people want this." DenScope is differentiated. It is not yet demanded. |

## Adoption Risks

| Risk | Assessment |
|------|-----------|
| **Zero distribution strategy** | HIGH. The roadmap is 100% product engineering, 0% distribution. No content plan, no community strategy, no outbound, no partnerships pipeline. |
| **SDK without ecosystem** | MEDIUM. @denlabs/trust-sdk is published on npm but the ERC-8004 ecosystem is tiny. How many agents exist? How many have owners? How many owners are developers? The TAM is unknown. |
| **Console requires acquired users** | MEDIUM. Console is a retention/activation tool. But there's no acquisition funnel feeding into it. |

## Positioning Risks

| Risk | Assessment |
|------|-----------|
| **Explorer drift** | MEDIUM-HIGH. The Live Feed, Graph, and Discovery are all explorer surfaces. Even with the roadmap's recommendation to pause Graph/Discovery, the feed remains and pulls the positioning toward "explorer." |
| **8004scan overlap** | MEDIUM. 8004scan owns browse/registry/leaderboard/feedback. If DenScope's landing page looks like an explorer, users will compare and choose the incumbent. |
| **"Trust infrastructure" is vague** | MEDIUM. What does "trust infrastructure" mean to a developer who hasn't heard of ERC-8004? The positioning needs a concrete use case, not an abstract category. |

## Technical Risks

| Risk | Assessment |
|------|-----------|
| **Supabase free tier at scale** | LOW. Currently fine. Only becomes a risk with multichain expansion. |
| **Trust Score v1 gameable** | LOW-MEDIUM. Simple positive-ratio formula can be gamed by self-feedback. Only matters if scores have real consequences. |
| **Single-chain dependency** | MEDIUM. Celo-only limits the addressable market. But expanding before validating demand is worse. |

## Execution Risks

| Risk | Assessment |
|------|-----------|
| **Solo operator** | HIGH. One person doing product, engineering, design, infra, and (theoretically) distribution. Shipping velocity is exceptional but distribution velocity is zero. |
| **Shipping addiction** | MEDIUM. 10 milestones shipped, 117 issues closed. The muscle is building. The atrophied muscle is selling. The roadmap perpetuates this pattern. |
| **Validation avoidance** | HIGH. The roadmap defers validation to day 90. This is a common founder pattern: keep building because building feels productive, defer talking to users because it feels uncertain. |

---

# 4. Hardened Product Thesis

## One-Sentence Thesis

DenScope is the trust scoring API for ERC-8004 agents — a programmable, verifiable, chain-agnostic trust layer that agent owners, developers, and AI systems consume to make trust-informed decisions.

## Wedge Hypothesis

The wedge is NOT the certificate (artifact), NOT the explorer (commodity), NOT the console (retention tool). The wedge is the **scored trust data available programmatically** — the API endpoint that returns a trust score, the SDK that wraps it, the MCP tool that exposes it. The certificate and the dossier page are **distribution surfaces** for the underlying data product.

If the API has no callers, the certificate has no credibility, and the console has no users.

## Anti-Thesis (What DenScope Must NOT Become)

- NOT an explorer (8004scan does this, and better in some areas)
- NOT a dashboard (dashboards are retention tools for acquired users)
- NOT a certificate generator (certificates without consumers are PDFs)
- NOT a platform (platforms require ecosystem, not engineering)
- NOT multichain by default (multichain is earned through single-chain validation)

---

# 5. Phase 0 — Validation Sprint (14 Days)

**Objective:** Before building anything else, establish whether the trust infrastructure hypothesis has any external signal of demand.

## Goals

1. Instrument all product surfaces with usage tracking
2. Establish baseline metrics (all may be zero — that's data)
3. Conduct 5 structured conversations with potential users
4. Determine which sub-hypothesis (certificate, API, signals) has the most pull
5. Make a go/no-go decision on the 30/60/90 plan

## Metrics to Instrument (Week 1)

| Metric | Source | Baseline Expected |
|--------|--------|-------------------|
| Page views by route | Vercel Analytics or PostHog | Unknown |
| Unique visitors/week | Vercel Analytics | Unknown |
| /agent/[chain]/[id] views | Analytics | Unknown |
| Certificate generations | Supabase: certificate_snapshots count | Unknown |
| Certificate verifications (/verify) | Analytics | Likely 0 |
| SIWE logins | Supabase: siwe_nonces used | Unknown |
| Agent claims | Supabase: owner_profiles count | Unknown |
| API keys created | Supabase: api_keys count | Unknown |
| API calls/day | Supabase: api_usage_log | Unknown |
| x402 payments | Supabase: x402_payments count | Likely 0 |
| npm downloads/week | npm stats API | Unknown |
| MCP server installs | npm stats API | Likely 0 |
| Alert rules created | Supabase: alert_rules count | Unknown |

## Structured Conversations (Week 1-2)

Talk to 5 people from these categories:

| # | Persona | Question to Answer |
|---|---------|-------------------|
| 1 | ERC-8004 agent owner (if any exist on Celo) | Do you care about your agent's trust score? Would you claim it? Would you set up alerts? |
| 2 | dApp developer building with agents | Would you query trust scores in your app? What would you do with the score? |
| 3 | Protocol security person | Would you pay for anomaly detection on agent behavior? Is sybil detection valuable? |
| 4 | AI agent builder (MCP/Claude/GPT ecosystem) | Would you use an MCP tool to check trust before interacting with an agent? |
| 5 | Crypto ecosystem participant (investor, DAO member) | Would you check an agent's trust score before delegating funds/authority? |

## Proof Points (End of Week 2)

| Signal | Interpretation |
|--------|---------------|
| >0 external API keys created | Someone wants the data |
| >0 certificates shared on social media | Visual artifact has distribution value |
| >0 agent claims | Agent owners engage |
| >100 unique visitors/week to /agent pages | Organic discovery exists |
| 3+ conversations confirm "I would use this" | Qualitative demand signal |
| npm downloads >50/week | Developer interest |

## Kill Criteria

If after 14 days ALL of the following are true:
- Zero external API keys
- Zero certificate shares
- Zero agent claims
- <20 unique visitors/week
- All 5 conversations are polite but non-committal ("interesting idea" without "I would use this for X")

Then the trust infrastructure hypothesis needs fundamental rethinking. Options:
- Pivot to TrustOps (B2B security monitoring for protocols)
- Pivot to trust data provider (sell data to existing explorers)
- Pivot to agent tooling (registration + management, not scoring)
- Pause DenScope and focus resources on Ayni or other DenLabs projects

---

# 6. Hardened 30 / 60 / 90 Plan

## Phase 1 — Foundation (Days 15-44, post-validation)

**Gate:** Phase 0 validation sprint shows at least 2 of 5 proof points.

**Objective:** Make the trust data product accessible and measurable.

**Key Deliverables:**

| # | Deliverable | Owner Type | Priority |
|---|-------------|-----------|----------|
| 1 | Usage instrumentation dashboard (internal) | Infra | P0 |
| 2 | Landing page pivot: trust-first messaging, score lookup, SDK CTA | Frontend + Product | P0 |
| 3 | Nav restructure: Agents, Console, Developers (3 items max) | Frontend | P1 |
| 4 | MCP server test suite (20+ tests) | Backend | P1 |
| 5 | Close stale issues (#128, #129) | Infra | P2 |

**What NOT to Build:**
- No Discovery redesign
- No Graph improvements
- No new detection rules
- No Trust Score v2
- No multichain expansion
- No x402 marketing
- No new certificate features
- No embed improvements

**Dependencies:**
- Phase 0 proof points met
- Vercel Analytics or PostHog deployed (from Phase 0)

**Risks:**
- Landing page pivot may reduce feed engagement (mitigation: feed moves to /explore, not deleted)
- Nav restructure may confuse returning users (mitigation: redirects for old routes)

**Success Criteria:**
- Instrumentation dashboard live, tracking all Phase 0 metrics daily
- Landing page live with trust-first messaging
- MCP server has test coverage

**Go / No-Go for Phase 2:**
- At least 3 new API keys created in 30 days
- OR at least 5 certificates shared on social media
- OR at least 50 npm downloads of @denlabs/trust-sdk
- If none: pause expansion, focus on distribution/outbound

---

## Phase 2 — Developer Traction (Days 45-74)

**Gate:** Phase 1 go criteria met.

**Objective:** Convert awareness into developer integration.

**Key Deliverables:**

| # | Deliverable | Owner Type | Priority |
|---|-------------|-----------|----------|
| 1 | Developer portal (/developers): unified SDK + API + MCP docs | Docs + Frontend | P0 |
| 2 | 1 real MCP server integration (own workflow, documented) | Backend + Product | P0 |
| 3 | 2 content pieces: "Why Trust Scores" + "Trust in 3 Lines of Code" | Product + Docs | P0 |
| 4 | E2E tests in CI for trust-sdk | Backend | P1 |
| 5 | Usage tracking: API calls/week, SDK downloads/week, key creation rate | Infra | P1 |
| 6 | TrustOps beta: gate Discovery behind Console auth, test with claimed agent owners | Frontend + Product | P2 |

**What NOT to Build:**
- No multichain expansion
- No Trust Score v2
- No new API endpoints
- No payment tier changes
- No Graph resurrection

**Dependencies:**
- Phase 1 landing page + instrumentation live
- MCP tests passing (Phase 1 deliverable)

**Risks:**
- Content distribution requires channels. Without Twitter/Farcaster presence, content goes unread. Mitigation: post to ecosystem-specific channels (Celo Discord, ERC-8004 working group if it exists).
- TrustOps beta may have zero users if no agents are claimed. This is informative.

**Success Criteria:**
- Developer portal live
- 1 documented MCP integration
- Content published on 2+ channels
- TrustOps beta available to claimed agents

**Go / No-Go for Phase 3:**
- At least 10 total API keys (cumulative)
- OR at least 1 external integration using trust-sdk
- OR at least 200 npm downloads/month
- OR TrustOps beta shows engagement (>3 claimed agent owners using alerts)
- If none: the trust infrastructure thesis is not validated. Reassess.

---

## Phase 3 — Product-Market Signal (Days 75-104)

**Gate:** Phase 2 go criteria met.

**Objective:** Determine if trust infrastructure is a business, not just a project.

**Key Deliverables:**

| # | Deliverable | Owner Type | Priority |
|---|-------------|-----------|----------|
| 1 | Usage metrics dashboard (external-facing in Console) | Frontend + Infra | P1 |
| 2 | Conditional: 1 new chain IF >5 external integrations request it | Backend + Infra | P1 (conditional) |
| 3 | Trust Score v2 spec (NOT implementation) | Product | P1 |
| 4 | 1 partnership integration case study | Product | P0 |
| 5 | Revenue model validation: are x402 payments happening? API tier upgrade interest? | Product | P0 |
| 6 | Product decision on Discovery/TrustOps: promote, keep beta, or remove | Product | P1 |

**What NOT to Build:**
- No multichain unless gated by demand (>5 requests)
- No Trust Score v2 implementation (spec only)
- No new detection rules (unless TrustOps shows demand)
- No mobile app
- No email/SMS alerts

**Conditional Expansion Rules:**
- Multichain: requires >5 unique external requests for a specific chain, OR a partnership that requires it
- Trust Score v2: requires >100 score queries/week, OR feedback that v1 is insufficient
- New detection rules: requires >3 claimed agent owners actively using TrustOps
- x402 marketing: requires >0 x402 payments from external users

**Success Criteria (90-day cumulative):**

| Signal | Minimum Viable | Strong Signal | Pivot Signal |
|--------|---------------|---------------|-------------|
| External API keys | 10+ | 50+ | <5 |
| API calls/week | 100+ | 1000+ | <20 |
| npm downloads/month | 200+ | 1000+ | <50 |
| External integrations | 1+ | 3+ | 0 |
| x402 payments | >0 is a signal | >10 is strong | 0 is expected |
| Certificate shares | 10+ | 50+ | <3 |
| Claimed agents | 5+ | 20+ | <2 |

---

# 7. What to Pause / What to Hide / What to Keep

| Surface | Decision | Rationale |
|---------|----------|-----------|
| **Agent Dossier** | **KEEP — promote to primary** | The human-readable trust profile. Best SEO surface. Share target. Make it the default destination from landing page. |
| **Trust Certificate** | **KEEP — but instrument** | Track generations, shares, verifications. If certificates aren't shared, they're not distributing. Reduce investment if shares stay zero. |
| **API/SDK** | **KEEP — primary investment** | This is the actual product for programmatic consumers. Instrument downloads and API calls aggressively. |
| **Console** | **KEEP — but prove activation** | Instrument everything. If zero logins in 30 days, it's premature. Don't expand features until activation is proven. |
| **Live Feed** | **KEEP — demote to /explore** | Supporting credibility surface. Don't invest more. Move off root route. |
| **MCP Server** | **KEEP — add tests, validate manually** | High-potential future bet. Add tests (30-day). Manually integrate into 1 workflow (60-day). Don't promote until validated. |
| **Discovery** | **HIDE — reframe as TrustOps beta** | Gate behind Console auth. Test with claimed agent owners. If engagement appears, promote. If not, remove at 90 days. |
| **Graph** | **PAUSE — remove from nav** | Zero product utility. Move to /labs/graph or remove entirely. Don't invest any engineering time. |
| **x402** | **KEEP CODE — stop marketing** | The code is built and tested. Don't invest more. Don't promote until external demand appears. Remove from public docs unless someone asks. |
| **Multichain** | **DO NOT BUILD — conditional gate** | Only expand if >5 external requests for a specific chain, or a partnership requires it. Celo-only is fine for validation. |

---

# 8. Milestones

## M-VAL: Validation Sprint
- **Goal:** Establish baseline metrics and qualitative demand signal
- **Epics:** E-INSTRUMENT, E-CONVERSATIONS
- **Exit Criteria:** 14-day metrics baseline established, 5 conversations completed, go/no-go decision made

## M-FOUND: Foundation
- **Goal:** Make trust data product accessible with measurable funnel
- **Epics:** E-LANDING, E-NAV, E-MCP-TESTS, E-CLEANUP
- **Exit Criteria:** Landing page live, nav restructured, MCP tests passing, instrumentation dashboard operational. Phase 2 gate criteria evaluated.

## M-DEVTRACT: Developer Traction
- **Goal:** Get first external developers actively using SDK or API
- **Epics:** E-DEVPORTAL, E-MCP-INTEGRATION, E-CONTENT, E-TRUSTOPS-BETA, E-E2E-CI
- **Exit Criteria:** Developer portal live, 1 MCP integration documented, 2 content pieces published, TrustOps beta available. Phase 3 gate criteria evaluated.

## M-PMF: Product-Market Signal
- **Goal:** Determine if trust infrastructure has sustainable demand
- **Epics:** E-METRICS-DASH, E-CONDITIONAL-CHAIN, E-SCORE-V2-SPEC, E-PARTNERSHIP, E-REVENUE-EVAL
- **Exit Criteria:** Usage metrics dashboard live, at least 1 partnership case study, revenue model decision made, Discovery/TrustOps decision made.

---

# 9. Epic Buckets

## E-INSTRUMENT — Usage Instrumentation
- **Rationale:** Cannot validate without data. Every decision downstream depends on this.
- **Workstreams:** Vercel Analytics or PostHog setup, Supabase metric queries, npm download tracking script, internal dashboard (can be a simple Next.js page or Supabase dashboard)
- **Sequencing:** Phase 0, week 1. Blocks everything.

## E-CONVERSATIONS — User Research
- **Rationale:** Code inspection tells you what's built. Conversations tell you what's wanted.
- **Workstreams:** Identify 5 personas, prepare question scripts, conduct conversations, synthesize findings
- **Sequencing:** Phase 0, weeks 1-2. Parallel with E-INSTRUMENT.

## E-LANDING — Landing Page Pivot
- **Rationale:** Root (/) must communicate "trust infrastructure" not "explorer." Current feed-first landing confuses positioning.
- **Workstreams:** Hero section, score lookup widget, featured certificates, SDK/API CTA, feed moves to /explore
- **Sequencing:** Phase 1, week 1-2. Depends on Phase 0 go decision.

## E-NAV — Navigation Restructure
- **Rationale:** 6-item nav (Feed, Graph, Discovery, Console, Agent, Docs) screams "explorer." Collapse to 3: Agents, Console, Developers.
- **Workstreams:** Remove Graph/Discovery from nav, add redirects, update mobile menu
- **Sequencing:** Phase 1, week 1. Parallel with E-LANDING.

## E-MCP-TESTS — MCP Server Quality
- **Rationale:** Published tool with 0 tests. Reputational risk if it returns bad data.
- **Workstreams:** vitest suite for all 5 tools, oracle resolution, error handling, response formatting
- **Sequencing:** Phase 1, weeks 2-3. No dependencies.

## E-CLEANUP — Issue Hygiene
- **Rationale:** Stale issues (#128, #129) create false impression of active bugs.
- **Workstreams:** Verify fixes, close issues, review remaining open issues
- **Sequencing:** Phase 1, week 1. No dependencies.

## E-DEVPORTAL — Developer Portal
- **Rationale:** /docs/api is functional but not compelling. Developers need a unified "start here" experience.
- **Workstreams:** Unified page with SDK install, API quickstart, MCP setup, x402 explainer, runnable examples
- **Sequencing:** Phase 2, weeks 1-2. Depends on E-MCP-TESTS.

## E-MCP-INTEGRATION — MCP Validation
- **Rationale:** The MCP server has never been validated in a real workflow. Integrate it yourself first.
- **Workstreams:** Integrate into 1 Claude Code workflow, document setup, test all 5 tools, write integration guide
- **Sequencing:** Phase 2, weeks 1-2. Depends on E-MCP-TESTS.

## E-CONTENT — Developer Content
- **Rationale:** Engineering without distribution = zero adoption. Need outbound content.
- **Workstreams:** Blog post: "Why Trust Scores Matter for AI Agents", Tutorial: "Query Agent Trust in 3 Lines of TypeScript"
- **Sequencing:** Phase 2, weeks 2-3. Depends on E-DEVPORTAL (link to docs).

## E-TRUSTOPS-BETA — Discovery as Operator Tool
- **Rationale:** Discovery rules are valuable but mispositioned. Test as a gated operator surface.
- **Workstreams:** Gate Discovery behind Console auth, add "TrustOps" label, track engagement
- **Sequencing:** Phase 2, weeks 3-4. Depends on Console instrumentation from E-INSTRUMENT.

## E-E2E-CI — SDK E2E in CI
- **Rationale:** 24 E2E tests exist but are skipped. Running them in CI prevents API regression.
- **Workstreams:** GitHub Actions workflow, staging API keys as secrets, test execution on PR
- **Sequencing:** Phase 2, weeks 2-3. No hard dependencies.

## E-METRICS-DASH — External Usage Dashboard
- **Rationale:** If API usage grows, users want to see their consumption. Also validates demand.
- **Workstreams:** Console page showing API calls, rate limit usage, key activity
- **Sequencing:** Phase 3, weeks 1-2. Depends on E-INSTRUMENT data.

## E-CONDITIONAL-CHAIN — Multichain Expansion (Gated)
- **Rationale:** Only build if demand is proven. >5 external requests for a specific chain.
- **Workstreams:** New chain config, Edge Function update, deploy_blocks entry, SDK wrapper
- **Sequencing:** Phase 3, conditional. Gate: >5 requests.

## E-SCORE-V2-SPEC — Trust Score v2 Design
- **Rationale:** v1 is basic (positive ratio + age + activity). Spec v2 based on real usage patterns.
- **Workstreams:** Analyze v1 usage data, research time-decay/recency models, write spec. NO IMPLEMENTATION.
- **Sequencing:** Phase 3, weeks 2-4. Depends on usage data from Phase 2.

---

# 10. Draft Issues

## Phase 0 — Validation Sprint

### Issue 1
- **Title:** instrument: deploy analytics and establish baseline metrics
- **Problem:** Zero usage data exists. Every product decision is based on code inspection, not user behavior.
- **Objective:** Deploy analytics tracking and create a baseline metrics dashboard.
- **Scope:** Vercel Analytics (or PostHog), Supabase metric queries for certificate_snapshots, api_keys, api_usage_log, owner_profiles, x402_payments, siwe_nonces. npm download tracking for @denlabs/trust-sdk, @denlabs/trust-client-core, @denlabs/ayni-sdk.
- **Out of Scope:** Custom dashboard UI, historical backfill, alerting.
- **Acceptance Criteria:**
  - Analytics deployed and tracking page views by route
  - Script or query that reports all Phase 0 metrics (see Section 5)
  - Baseline numbers documented (even if all zero)
- **Dependencies:** None
- **Labels:** infra, validation, P0
- **Milestone:** M-VAL

### Issue 2
- **Title:** research: conduct 5 structured user conversations
- **Problem:** No qualitative signal on whether trust infrastructure is demanded by any buyer persona.
- **Objective:** Talk to 5 potential users from different personas and document findings.
- **Scope:** Identify candidates (agent owner, dApp developer, protocol security, AI agent builder, ecosystem participant). Prepare question script per persona. Conduct async or sync conversations. Synthesize findings into a 1-page memo.
- **Out of Scope:** Surveys, landing page tests, paid user research.
- **Acceptance Criteria:**
  - 5 conversations completed
  - 1-page synthesis memo with: what resonated, what didn't, strongest persona, weakest persona
  - Go/no-go recommendation based on findings
- **Dependencies:** None
- **Labels:** product, validation, P0
- **Milestone:** M-VAL

### Issue 3
- **Title:** decision: Phase 0 go/no-go for 30/60/90 plan
- **Problem:** The 30/60/90 plan should only execute if validation shows signal.
- **Objective:** Review Phase 0 metrics and conversation findings. Make explicit go/no-go decision.
- **Scope:** Review all metrics, synthesize conversation findings, apply kill criteria (Section 5), write decision memo.
- **Out of Scope:** Implementation of any Phase 1+ work.
- **Acceptance Criteria:**
  - Decision memo with: metrics summary, conversation synthesis, decision (go/pivot/pause), rationale
  - If go: confirm which sub-hypothesis showed strongest signal
  - If no-go: document pivot options
- **Dependencies:** Issue 1, Issue 2
- **Labels:** product, decision, P0
- **Milestone:** M-VAL

## Phase 1 — Foundation

### Issue 4
- **Title:** feat: landing page pivot — trust-first messaging with score lookup
- **Problem:** Root (/) shows a Live Feed, positioning DenScope as an explorer. Must communicate "trust infrastructure."
- **Objective:** Replace root page with trust-focused landing: hero, score lookup widget (chain + agent ID), featured certificates, SDK CTA.
- **Scope:** New landing page component, move current feed to /explore with redirect from /feed.
- **Out of Scope:** Full marketing site, pricing page, blog integration.
- **Acceptance Criteria:**
  - Root (/) shows trust-focused landing
  - Score lookup widget: input chain + agent ID, navigates to /agent/[chain]/[id]
  - Featured certificates section (pull latest from certificate_snapshots)
  - "Get started with SDK" CTA linking to /developers
  - Current feed accessible at /explore
  - All existing tests pass, no broken routes
- **Dependencies:** Phase 0 go decision (Issue 3)
- **Labels:** frontend, product, P0
- **Milestone:** M-FOUND

### Issue 5
- **Title:** feat: restructure navigation — 3-item trust-focused nav
- **Problem:** 6-item nav (Feed, Graph, Discovery, Console, Agent, Docs) reads as "explorer." Need to collapse.
- **Objective:** Restructure main nav to: Explore (feed), Console, Developers.
- **Scope:** Update desktop nav, mobile dropdown, add redirects for removed routes. Graph removed from nav (accessible at /labs/graph). Discovery removed from nav (accessible at /console/trustops when gated later).
- **Out of Scope:** Removing Graph/Discovery code or routes, just nav visibility.
- **Acceptance Criteria:**
  - Main nav: Explore, Console, Developers
  - /graph still accessible via direct URL, not in nav
  - /discovery still accessible via direct URL, not in nav
  - Mobile menu updated
  - No broken routes, all tests pass
- **Dependencies:** None (can parallel with Issue 4)
- **Labels:** frontend, P1
- **Milestone:** M-FOUND

### Issue 6
- **Title:** test: MCP server unit test suite
- **Problem:** MCP server published with 0 tests. Reputational risk if it returns incorrect data.
- **Objective:** Write vitest suite covering all 5 MCP tools.
- **Scope:** Tests for: trust_get_score, trust_get_agent, trust_get_signals, trust_search_agents, trust_get_events. Test oracle resolution (denscope/ayni), chain name resolution, error handling, response formatting.
- **Out of Scope:** E2E tests against live endpoints, integration tests with actual MCP clients.
- **Acceptance Criteria:**
  - 20+ unit tests covering all 5 tools
  - Happy path + error cases for each tool
  - Oracle resolution tests (valid/invalid oracle names)
  - Chain resolution tests (name vs numeric ID)
  - All tests pass in CI
- **Dependencies:** None
- **Labels:** backend, testing, P1
- **Milestone:** M-FOUND

### Issue 7
- **Title:** chore: close stale issues and verify fixes
- **Problem:** Issues #128 (Discovery DB seeding) and #129 (Realtime subscription drops) appear fixed in commit 10f2d48 but remain open.
- **Objective:** Verify fixes and close issues.
- **Scope:** Test Discovery DB seeding behavior, verify Realtime subscription persists across navigation, close issues if confirmed.
- **Out of Scope:** Any new fixes or improvements.
- **Acceptance Criteria:**
  - Both issues verified as fixed or reopened with reproduction steps
  - Issues closed with commit reference
- **Dependencies:** None
- **Labels:** chore, P2
- **Milestone:** M-FOUND

## Phase 2 — Developer Traction

### Issue 8
- **Title:** feat: unified developer portal at /developers
- **Problem:** /docs/api exists but is a single page. Developers need a comprehensive "start here" experience.
- **Objective:** Build a developer portal with: SDK quickstart, API reference, MCP server setup, authentication guide.
- **Scope:** New /developers route with tabbed or sectioned layout. Code snippets with copy buttons. Live examples (curl + TypeScript + MCP config). Replace /docs/api or redirect to /developers.
- **Out of Scope:** Interactive API playground, Swagger/OpenAPI spec, video tutorials.
- **Acceptance Criteria:**
  - /developers page live with: Quick Start, SDK, API Reference, MCP Server, Authentication sections
  - Copy-to-clipboard code snippets
  - All examples verified to work
  - /docs/api redirects to /developers
- **Dependencies:** Issue 6 (MCP tests, for documentation accuracy)
- **Labels:** frontend, docs, P0
- **Milestone:** M-DEVTRACT

### Issue 9
- **Title:** validate: integrate MCP server into real AI workflow
- **Problem:** MCP server has never been used in a real workflow. Cannot recommend to others without self-validation.
- **Objective:** Integrate trust-mcp-server into 1 Claude Code workflow. Document setup, usage, friction points.
- **Scope:** Configure MCP server in Claude Code settings. Use all 5 tools in a real task. Document: setup steps, what worked, what was confusing, what data was useful. Write integration guide.
- **Out of Scope:** GPT integration (defer), automated testing, publishing guide as content yet.
- **Acceptance Criteria:**
  - MCP server successfully configured and used in Claude Code
  - All 5 tools invoked and returning correct data
  - Integration guide written (can be a docs/guides/ markdown file)
  - Friction points documented (for future improvement)
- **Dependencies:** Issue 6 (MCP tests passing)
- **Labels:** backend, product, validation, P0
- **Milestone:** M-DEVTRACT

### Issue 10
- **Title:** content: publish "Why Trust Scores Matter for AI Agents"
- **Problem:** Zero distribution. Need outbound content to drive awareness.
- **Objective:** Write and publish 1 long-form piece explaining the trust score thesis with DenScope as the solution.
- **Scope:** 800-1200 word article. Publish on: Twitter/X thread, Farcaster, and 1 ecosystem channel (Celo Discord or ERC-8004 forum).
- **Out of Scope:** Paid promotion, video content, landing page integration.
- **Acceptance Criteria:**
  - Article written and reviewed
  - Published on at least 2 channels
  - Includes link to /developers and @denlabs/trust-sdk
  - Track engagement (likes, replies, click-throughs if possible)
- **Dependencies:** Issue 8 (developer portal to link to)
- **Labels:** product, docs, P0
- **Milestone:** M-DEVTRACT

### Issue 11
- **Title:** feat: gate Discovery behind Console as TrustOps beta
- **Problem:** Discovery is mispositioned as a public explorer surface. It may be valuable as an operator tool.
- **Objective:** Gate Discovery behind Console authentication. Reframe as "TrustOps" for claimed agent owners.
- **Scope:** Require SIWE session to access /discovery (or move to /console/trustops). Add "TrustOps (Beta)" label. Filter signals to show only claimed agents' incidents. Track page views and engagement.
- **Out of Scope:** UX redesign (Issue #133 deferred), new detection rules, notification system.
- **Acceptance Criteria:**
  - Discovery requires authenticated session
  - Only shows signals for user's claimed agents
  - "TrustOps (Beta)" label visible
  - Page views tracked in instrumentation
- **Dependencies:** Issue 1 (instrumentation), Console auth working
- **Labels:** frontend, product, P2
- **Milestone:** M-DEVTRACT

### Issue 12
- **Title:** ci: enable trust-sdk E2E tests in GitHub Actions
- **Problem:** 24 E2E tests exist but are permanently skipped. API regressions go undetected.
- **Objective:** Run E2E tests in CI against live staging endpoints.
- **Scope:** GitHub Actions workflow, staging API keys as repository secrets, test execution on PR + main push.
- **Out of Scope:** Staging environment setup (use production with test keys), test expansion.
- **Acceptance Criteria:**
  - GitHub Actions workflow runs E2E tests
  - API keys stored as repository secrets
  - Tests run on PR and main push
  - Failures block merge
- **Dependencies:** None
- **Labels:** backend, infra, testing, P1
- **Milestone:** M-DEVTRACT

---

# 11. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Trigger |
|---|------|-----------|--------|------------|---------|
| R1 | Zero external demand for trust scores | MEDIUM | CRITICAL | Phase 0 validation sprint with kill criteria | <5 API keys at 90 days |
| R2 | Explorer drift in nav/positioning | HIGH | HIGH | Strict nav restructure in Phase 1, "do not build" rules | Any feature that primarily shows more data |
| R3 | Solo operator bottleneck | HIGH | HIGH | Prioritize ruthlessly, defer distribution to content (async) | Shipping velocity drops, no outbound activity |
| R4 | Trust Score v1 gamed | LOW | MEDIUM | Monitor scoring patterns, spec v2 at Phase 3 | Same address provides 100% positive feedback |
| R5 | x402 zero revenue indefinitely | HIGH | LOW | Keep code, stop investment, re-evaluate at 90 days | 0 payments at 90 days |
| R6 | MCP server returns bad data | MEDIUM | HIGH | Test suite in Phase 1 (Issue 6) | Any incorrect score returned |
| R7 | Supabase free tier limits | LOW | MEDIUM | Monitor invocation count, plan upgrade path | >400K invocations/month |
| R8 | Certificate has no distribution | MEDIUM | HIGH | Track shares/verifications, reduce investment if zero | 0 shares at 60 days |
| R9 | 8004scan expands into trust scoring | LOW | HIGH | Ship faster, establish trust API as standard | 8004scan announces trust features |
| R10 | Multichain expansion without demand | MEDIUM | MEDIUM | Conditional gate: >5 external requests | Any pressure to "support more chains" |
| R11 | Content goes unread | MEDIUM | MEDIUM | Distribute on 3+ channels, track engagement | <10 engagements per post |
| R12 | Validation conversations produce false positives | MEDIUM | HIGH | Ask "would you pay?" not "is this interesting?", track actions not words | Conversations positive but metrics stay zero |

---

# 12. Final Recommendation

## What to Do Now (This Week)

1. **Deploy analytics.** Vercel Analytics takes 5 minutes. Every day without data is a day of building blind.
2. **Check Supabase tables.** Run counts on api_keys, owner_profiles, certificate_snapshots, x402_payments. Know where you stand.
3. **Check npm downloads.** `npm view @denlabs/trust-sdk` — see if anyone has installed it.
4. **Start 5 conversations.** DM 5 people in the ERC-8004 / Celo / AI agent ecosystem. Ask: "Would you check an agent's trust score before interacting with it? Why or why not?"
5. **Write the Phase 0 go/no-go criteria** and commit to evaluating them honestly in 14 days.

## What to Defer

- Landing page pivot (until Phase 0 validates direction)
- Nav restructure (until Phase 0 validates direction)
- Developer portal expansion (until Phase 1)
- Multichain (until Phase 3 + demand gate)
- Trust Score v2 (until Phase 3 + usage data)
- Discovery redesign (Issue #133 — indefinitely, pending TrustOps validation)
- Graph improvements (indefinitely)
- x402 marketing (until external payment occurs)
- New detection rules (until TrustOps shows engagement)

## What to Validate

| Hypothesis | Validation Method | Timeline |
|-----------|-------------------|----------|
| Agent owners want trust certificates | Track certificate generations + shares | Phase 0-1 |
| Developers want trust scores in apps | Track API key creation + calls | Phase 0-2 |
| AI agents want trust data at runtime | MCP server integration test + external usage | Phase 1-2 |
| Anomaly detection has operator value | TrustOps beta engagement | Phase 2 |
| Trust infrastructure has a revenue model | x402 payments + API tier interest | Phase 3 |

## What Would Make Me Pivot

- **14 days:** All Phase 0 metrics are zero AND all 5 conversations are non-committal. Action: fundamental thesis rethink.
- **60 days:** <5 API keys, 0 external integrations, 0 certificates shared. Action: pause DenScope, redirect to Ayni or other DenLabs projects.
- **90 days:** Metrics stagnant despite content + outreach. Action: the trust infrastructure thesis for ERC-8004 is wrong. Consider: pivot to B2B security monitoring (TrustOps for protocols), pivot to trust data licensing, or archive.

## Answers to the 10 Required Questions

1. **Weakest claim:** "Console is product-critical." It has zero proven activations. It's infrastructure for growth that hasn't happened.

2. **Most likely founder bias:** "The wedge is Trust Certificate + API/SDK." This is three different products bundled under one name because they were all built by the same person. The wedge should be ONE thing, validated by demand.

3. **Is Discovery useless?** No. The detection rules are genuinely valuable. But Discovery as a public consumer page is useless. As a gated operator tool (TrustOps), it could be the product for protocol security teams. Test it.

4. **Is Console truly core?** Not yet. It's core IF users arrive, claim agents, and set up alerts. Until activation is proven, it's a feature waiting for users.

5. **Is the Trust Certificate the product, the artifact, or the distribution layer?** It's the **distribution layer**. The product is the scoring engine + data pipeline. The certificate is how that product becomes visible and shareable. Don't confuse the wrapper with the contents.

6. **What if the real wedge is the API, not the UI?** Then DenScope the app becomes a documentation site + API dashboard. The landing page is developer docs, not a trust explorer. This is a legitimate outcome and should be tracked. If API calls grow but page views don't, follow the API.

7. **What if the real wedge is signals/alerts, not certificates?** Then TrustOps is the product. Discovery + Console alerts become the primary surface. The buyer is protocol security teams, not agent owners. This requires the TrustOps beta (Phase 2) to validate.

8. **What must be true at 30/60/90 days?** See go/no-go criteria in Section 6. In short: 30d = instrumented + messaging aligned; 60d = developers engaging; 90d = sustainable usage pattern OR honest pivot.

9. **What should be paused immediately?** Graph (remove from nav today). Discovery redesign (Issue #133 — defer). Any x402 marketing. Any multichain expansion planning.

10. **What should never be built unless demand appears?** Trust Score v2 implementation. Multichain expansion. Email/SMS alerts. Mobile app. Agent comparison views. Leaderboards. Any feature where "building more" substitutes for "finding users."

---

*Red-team review based on: full codebase audit (DenScope 252 tests, 21 endpoints, 6 pages + trust-sdk 64 tests, 4 npm packages), baseline roadmap analysis, competitive positioning against 8004scan, and first-principles evaluation of pre-PMF product strategy.*
