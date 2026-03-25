# DenScope Product & Execution Roadmap

**Date:** 2026-03-23
**Author:** Staff Product Engineer + TPM audit
**Scope:** DenScope app + trust-sdk monorepo
**Method:** Full codebase inspection, not assumptions

---

## 1. Executive Summary

DenScope has over-built horizontally and under-leveraged vertically. The app has 21 working API endpoints, 252 passing tests, 6 pages, dual-theme design system, x402 micropayments, SIWE auth, and a published SDK monorepo on npm. By any engineering measure, this is impressive.

**The problem: the product doesn't know what it is yet.**

It presents as an "ERC-8004 explorer" — a Live Feed, a Graph, a Discovery page, a Console. But the actual wedge — the thing nobody else has — is **trust infrastructure**: a computed trust score, a verifiable certificate, a pay-per-call API, and an SDK that lets agents query trust programmatically.

Everything else is scaffolding that dilutes the message.

**Recommendation:** Collapse the product surface. Lead with Trust Certificate + API/SDK as the primary value prop. Restructure navigation around trust consumption, not event exploration. Pause Discovery and Graph. Double down on the wedge.

---

## 2. Current State by Surface

### Live Feed (/) — WORKING, LOW LEVERAGE
- Real-time event stream with filtering (kind, chain, agent ID)
- CertificateStation panel (generates trust certificates on-demand)
- Stats bar (head block, agent count, event count)
- **Verdict:** Functional but commodity. Every explorer has a feed. The CertificateStation bolted onto the right panel is the only differentiated element, but it's buried in an explorer UX.

### Graph (/graph) — WORKING, DEMO-ONLY VALUE
- d3-force canvas with agent nodes, status coloring, XRayPanel
- **Verdict:** Visually impressive, zero product utility. No user opens DenScope to see a force graph. It's a demo artifact. Remove from nav or hide behind a "Labs" toggle.

### Discovery (/discovery) — WORKING, CONFUSED IDENTITY
- Masonry grid of anomaly signals (first_blood, rising_star)
- 5 server-side detectors (reputation_drop, feedback_spike, sybil_cluster)
- DB-seeded, Realtime subscription
- **Verdict:** The detection rules are valuable infrastructure. But the UI presents them as a standalone page that's empty 99% of the time. The signals should be **surfaced in context** (agent dossier, console alerts) — not as a destination page.

### Console (/console) — WORKING, PRODUCT-CRITICAL
- SIWE auth, agent registration, claimed agents list
- Incident timeline (realtime), alert rules (webhooks), API key management
- **Verdict:** This is the operational center for agent owners. It's real, it works, and it's the only page that drives repeat usage. But it's item #4 in the nav — should be elevated.

### Agent Dossier (/agent/[chain]/[id]) — WORKING, STRONGEST PAGE
- SSR with OG metadata, trust score with breakdown
- Trust snapshot, identity card, event history, connected protocols
- Claim flow, share on X, embed snippet
- Trust Certificate generation + QR code + IPFS storage
- Verification page (/verify/[hash])
- **Verdict:** This is the product. A portable, verifiable, shareable trust profile for any ERC-8004 agent. This page + the certificate + the verification flow is the entire wedge.

### API Docs (/docs/api) — WORKING, SUPPORT
- Quick start, SDK examples, curl examples, x402 payment flow
- **Verdict:** Good but needs to be the second thing a developer sees after the landing pitch.

### Trust API (v1) — WORKING, PRODUCT-CRITICAL
- 5 endpoints: agent profile, score, signals, events, search
- 3 auth methods: API key, SIWE session, x402 micropayment
- Rate limiting (free 100/day, pro 10K/day)
- x402 pricing: /score $0.001, /signals $0.0005
- **Verdict:** Production-grade. This is what agents and developers consume. The API IS the product for programmatic users.

### Trust SDK (@denlabs/trust-sdk) — PUBLISHED, PRODUCT-CRITICAL
- Monorepo: trust-client-core (0 deps, 100% coverage) + trust-sdk (DenScope) + ayni-sdk (Ayni)
- MCP server: 5 tools for AI agent consumption
- 64/64 tests passing, all packages on npm
- **Verdict:** The SDK is the distribution channel. Published, typed, x402-ready. This is how the wedge scales.

---

## 3. Current State by Repo

### denscope (den-labs/denscope-xr)

| Dimension | Status | Detail |
|-----------|--------|--------|
| Tests | 252/252 passing | 50 files, ~7s |
| Build | Clean | 19 static + 7 dynamic routes |
| Deploy | Live | denscope.vercel.app (Vercel auto-deploy) |
| API | 21 endpoints | All functional, 3 auth methods |
| Auth | SIWE + API keys + x402 | Production-grade |
| DB | Supabase, 10 migrations, 20 tables | Serverless, pg_cron every 30s |
| Edge Function | erc8004-poller | Celo + Celo Sepolia, auto-indexing |
| Design System | v1.1 dual-theme | Light + dark, stable |
| Trust Certificates | Full pipeline | Generate, store (IPFS), verify, share |
| Open Issues | 3 (#128, #129 likely stale, #133 UX) | Low debt |

### trust-sdk (den-labs/trust-sdk)

| Dimension | Status | Detail |
|-----------|--------|--------|
| Tests | 64/64 passing | 24 E2E skipped (need API keys) |
| Build | Clean | All 4 packages build <2s |
| npm | 3 packages published | trust-sdk@0.2.0, trust-client-core@0.1.0, ayni-sdk@0.1.1 |
| MCP Server | Functional | 5 tools, stdio transport, 0 tests |
| Coverage | 100% on core | trust-client-core only |
| Open Issues | 0 | Clean |
| Docs | README + CHANGELOG + examples | Complete |

---

## 4. Product Priority Matrix

### CORE (invest heavily, this IS the product)

| Asset | Why |
|-------|-----|
| **Trust Certificate** | Portable, verifiable, shareable trust artifact. The single most differentiated output. No competitor has this. |
| **Agent Dossier page** | The human-readable trust profile. Every certificate links here. SEO surface. Share target. |
| **/verify/[hash] flow** | Makes certificates credible. Without verification, certificates are PDFs. |
| **Trust API (v1)** | The programmatic interface. Agents, dApps, and developers consume trust through this. |
| **trust-sdk + MCP server** | Distribution channel. npm install + AI tool integration = developer adoption. |
| **Console** | Operational center for agent owners. Drives retention (alerts, incidents, API keys). |

### SUPPORT (maintain, don't expand)

| Asset | Why |
|-------|-----|
| **Live Feed** | Useful as a "what's happening" context page. Keep it simple. Don't invest more. |
| **API Docs** | Necessary for developer adoption. Keep current with API changes. |
| **Design System** | Stable at v1.1. Don't redesign until product surface is settled. |
| **SIWE Auth** | Works. Don't touch it. |
| **Supabase infra** | Serverless pipeline is solid. Maintain, don't over-optimize. |

### INCUBATING (promising but premature)

| Asset | Why |
|-------|-----|
| **x402 micropayments** | Technically complete but no paying users yet. Keep the code, don't market it until there's SDK adoption. |
| **MCP Server** | Published but 0 tests, 0 users. Add tests, then validate with 1-2 AI agent teams. |

### PAUSE (stop spending time here)

| Asset | Why |
|-------|-----|
| **Discovery page** | See section 5. |
| **Graph page** | Demo artifact. Zero product utility. No user retention driver. |
| **OG share cards (root)** | Working, don't iterate. Agent-level OG cards are the ones that matter. |
| **Embed flow** | Nice-to-have. No evidence of external embedding demand. |

---

## 5. What to Pause

### Discovery — PAUSE and REDISTRIBUTE

**Don't delete it. Don't redesign it. Redistribute its value.**

The 5 detection rules (first_blood, rising_star, reputation_drop, feedback_spike, sybil_cluster) are genuinely valuable. But they don't need their own page. They should surface as:

1. **Badges on the Agent Dossier** — "Rising Star" badge, "Sybil Alert" warning banner
2. **Console Incident Timeline** — already exists, working
3. **API /signals endpoint** — already exists, working
4. **Certificate state field** — trust state already reflects incidents

The Discovery *page* adds a navigation item that confuses the product story. A user lands on DenScope and sees: Feed, Graph, Discovery, Console. That's an explorer. Strip it to: Agents, Console, API Docs. That's a trust platform.

**Action:** Remove /discovery from main nav. Keep the detection engine running server-side. Surface signals in agent dossier and console where they have context.

### Graph — PAUSE

Move to /labs/graph or remove from nav entirely. It's a visual demo that doesn't drive any product outcome. If someone asks "what does your graph page do?", the answer is "it looks cool." That's not a product surface.

---

## 6. 30-Day Plan (Weeks 1-4): Sharpen the Wedge

**Goal:** Make DenScope obviously a trust infrastructure product, not an explorer.

### Deliverables

| # | Deliverable | Dependency | Success Criteria |
|---|-------------|------------|------------------|
| 1 | **Restructure navigation** | None | Nav: Explore (feed), Verify (agent dossier), Console, Developers. Remove Discovery and Graph from main nav. |
| 2 | **Landing page pivot** | Nav restructure | Root (/) becomes a trust-focused landing: hero with "Trust infrastructure for ERC-8004 agents", quick score lookup (chain + agent ID input), featured certificates, SDK CTA. Feed moves to /explore. |
| 3 | **Agent dossier as primary surface** | None | /agent/[chain]/[id] gets priority treatment: trust certificate prominent (not buried), signal badges inline, "Get this via API" CTA. |
| 4 | **MCP server tests** | None | Write vitest suite for all 5 MCP tools. Target: 20+ tests. |
| 5 | **Close stale issues** | None | Verify #128, #129 are fixed. Close them. |
| 6 | **SDK README for landing** | None | Add "Trust Score in 3 lines" code snippet to the DenScope landing page. |

### Risks
- Restructuring nav may break existing bookmarks/links. Mitigation: keep old routes working, just change nav.
- Landing page pivot is UX work. Keep scope small: hero + search + 3 sections max.

---

## 7. 60-Day Plan (Weeks 5-8): Developer Adoption

**Goal:** Get the first 5 external developers/teams using the SDK or API.

### Deliverables

| # | Deliverable | Dependency | Success Criteria |
|---|-------------|------------|------------------|
| 1 | **Developer portal (/developers)** | 30-day nav restructure | Unified page: SDK install, API quickstart, MCP server setup, x402 explainer. Replace current /docs/api with a richer experience. |
| 2 | **SDK usage tracking** | API infra | Track API key creation, first call, weekly active keys. Dashboard in Console (or internal). |
| 3 | **MCP server validation** | MCP tests from 30-day | Get 1-2 AI agent teams to integrate trust-mcp-server. Document friction points. |
| 4 | **Trust Certificate v2** | Dossier improvements | Add "Trust History" (score over time chart), "Verification Count" (how many times certificate was verified). Requires new Supabase table for score snapshots. |
| 5 | **E2E in CI** | trust-sdk repo | Add GitHub Actions workflow that runs E2E tests against staging with API keys stored as secrets. |
| 6 | **Outbound content** | Landing page | 2 blog posts / threads: "Why Trust Scores Matter for AI Agents" + "How to Query Agent Trust in 3 Lines of TypeScript". |

### Risks
- Developer adoption is distribution, not engineering. Need outbound effort (Twitter, Farcaster, ecosystem channels).
- Trust Certificate v2 requires schema migration. Keep it additive (new table, don't modify existing).

---

## 8. 90-Day Plan (Weeks 9-12): Product-Market Signal

**Goal:** Have evidence that trust infrastructure is a real wedge, or pivot.

### Deliverables

| # | Deliverable | Dependency | Success Criteria |
|---|-------------|------------|------------------|
| 1 | **Usage metrics dashboard** | 60-day tracking | Internal dashboard: daily API calls, unique API keys, x402 payments, certificate verifications, SDK downloads (npm). |
| 2 | **Multi-chain expansion (1 chain)** | SDK architecture | Add Ethereum mainnet or Base to the trust-sdk. Requires new Edge Function poller + chain config. Validates the "multichain trust" story. |
| 3 | **Trust Score v2 spec** | Usage data from 60-day | Based on real usage patterns, spec improvements: time-decay, recency bias, network effects (A2A connections). Don't build — spec and validate. |
| 4 | **Partnership integration** | Developer adoption from 60-day | At least 1 external dApp or agent framework consuming trust scores in production. Document the integration as a case study. |
| 5 | **x402 revenue validation** | Adoption | If >0 x402 payments have occurred: double down. If 0: simplify to API-key-only model and reduce complexity. |
| 6 | **Product decision: Discovery** | 90 days of signal data | With 3 months of real usage data, decide: bring Discovery back as a first-class anomaly dashboard, keep it hidden, or remove it entirely. |

### Success Criteria (90-day)
- **Minimum viable:** 10+ API keys created by external users, 100+ API calls/week, 1 integration partner
- **Strong signal:** 50+ API keys, 1000+ calls/week, x402 payments occurring, 2+ integration partners
- **Pivot signal:** <5 API keys after outbound effort = trust infrastructure is not the wedge

---

## 9. Risks

### Strategic Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Explorer drift** | HIGH | The codebase already has 6 pages that look like an explorer. Every new feature (graph layout, discovery redesign) pulls toward "better explorer" instead of "trust infrastructure". Strict nav restructure in 30-day plan guards against this. |
| **No demand signal** | HIGH | All engineering is built on the assumption that agents/developers want trust scores. If 90 days pass with <5 external API keys, the wedge hypothesis is wrong. Track this metric from day 1. |
| **Celo-only** | MEDIUM | Trust infrastructure locked to Celo limits TAM. 90-day plan addresses with 1 new chain. But don't expand before validating demand on Celo. |
| **x402 complexity for no revenue** | MEDIUM | x402 adds significant code surface (22 tests, facilitator integration, payment recording). If no payments materialize in 90 days, consider removing to reduce maintenance. |
| **Solo operator risk** | MEDIUM | One person building, deploying, and marketing. Feature velocity is high but distribution bandwidth is zero. Consider delegating content/outbound. |
| **MCP server quality** | LOW | Published with 0 tests. An AI agent consuming bad data from the MCP server could erode trust in the trust product. Mitigated in 30-day plan. |

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Supabase free tier limits** | MEDIUM | ~86K Edge Function invocations/month from cron. Free tier is 500K. At 2 chains this is fine. At 5+ chains, need paid plan or architectural change. |
| **Trust Score v1 simplicity** | LOW | Formula is basic (positive ratio + age + activity - incidents). Fine for v1 but will be gamed if stakes increase. Score v2 spec in 90-day plan. |
| **IPFS dependency (Pinata)** | LOW | Certificate images stored on Pinata. If Pinata goes down, certificates degrade to text-only. Add gateway fallback. |

---

## 10. Final Recommendation

### The Wedge is the Trust Certificate + API/SDK

Not the feed. Not the graph. Not discovery. The wedge is:

> **A verifiable, portable trust artifact for any ERC-8004 agent, consumable by humans (certificate page + QR), developers (REST API + TypeScript SDK), and AI agents (MCP server + x402).**

This is what nobody else has. This is what scales.

### Recommended Nav / Product Architecture for DenScope v1

```
DenScope
|
+-- / (Landing)
|   Hero: "Trust infrastructure for autonomous agents"
|   Quick lookup: [chain] [agent ID] -> trust score
|   Featured certificates
|   SDK/API CTA
|
+-- /agent/[chain]/[id] (Trust Profile)
|   THE primary surface
|   Trust score + certificate + signals + identity + events
|   Share, embed, verify, claim
|
+-- /verify/[hash] (Certificate Verification)
|   Public verification page
|   Proves certificate authenticity
|
+-- /explore (Live Feed) [was /]
|   Real-time events
|   Secondary — "what's happening on-chain"
|
+-- /console (Owner Console)
|   Wallet-gated
|   Claimed agents, incidents, alerts, API keys, register
|
+-- /developers (API & SDK Docs)
|   SDK quickstart
|   API reference
|   MCP server setup
|   x402 payment flow
|
+-- /labs/graph (optional, hidden)
|   Force graph visualization
|   Not in main nav
```

### What "Explorer Drift" Looks Like (Avoid These)

- Spending time on Discovery page UX redesign when nobody uses Discovery
- Adding more event filters to the Live Feed
- Improving Graph interactivity or adding new node types
- Building agent comparison views or leaderboards
- Any feature where the primary value is "see more data"

### What High-Leverage Work Looks Like (Do These)

- Making the Trust Certificate the thing people share (Twitter cards, embeds)
- Making the SDK the easiest way to check agent trust (3 lines of code)
- Getting the MCP server into AI agent workflows (Claude, GPT, etc.)
- Building a landing page that says "trust infrastructure" not "explorer"
- Tracking whether anyone actually creates API keys and calls the API

### One Sentence

**Stop building a better explorer. Start selling trust infrastructure.**

---

*Audit based on full codebase inspection of denscope (252 tests, 21 endpoints, 6 pages) and trust-sdk (64 tests, 4 npm packages). All claims verified against code, not documentation.*
