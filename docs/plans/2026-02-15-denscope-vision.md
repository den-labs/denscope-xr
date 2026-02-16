# DenScope — Product Vision

> The trust layer for autonomous agents.

## Product Identity

DenScope is not a block explorer that also shows agents. It is an **agent-native product** — everything is designed from the perspective of the agent as a first-class citizen. Etherscan indexes transactions; DenScope indexes *trust*.

**One-liner:** Real-time observability, reputation scoring, and discovery for ERC-8004 agents on any chain.

## Three Surfaces, One Pipeline

| Surface | Audience | Value | Monetization |
|---------|----------|-------|--------------|
| **Explorer** (public) | Anyone | Discover agents, see reputation, share cards | Free — growth engine |
| **Console** (authenticated) | Agent owners | Monitor MY agent: signals, incidents, alerts | Free tier + paid pro |
| **API** (developer) | dApps, frameworks | Trust scores, signals, agent metadata programmatically | Usage-based pricing |

The explorer is what people see. The console is what owners use. The API is what protocols integrate. All three read from the same data pipeline — one indexer, one source of truth.

## Revenue Flywheel

```
Agent cards (free, viral) → attract agent owners
    → Observability Console (paid) → retain owners, generate data
        → Reputation API (paid) → monetize the data moat
            → Framework integrations → scale distribution
```

Each layer feeds the next. Cards are the top-of-funnel, the console is retention, and the API is the real business where you sell the network effect of having the most complete agent reputation data on-chain.

**Revenue timeline:** Event-driven. No fixed date. Ship when the ecosystem has traction. Free tier viable indefinitely, paid tier when demand exists.

## Architecture

One data pipeline feeds all three surfaces. No separate databases or duplicated indexers.

```
On-chain (ERC-8004 contracts)
    │
    ▼
┌─────────────────────────────┐
│  Indexer (exists)           │
│  pg_cron → Edge Function    │
│  → Forno RPC → scope_events │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Supabase (source of truth) │
│  scope_events, agents,      │
│  indexer_cursors             │
│  + NEW: owner_profiles,     │
│    alert_rules, incidents   │
└──┬──────────┬───────────┬───┘
   │          │           │
   ▼          ▼           ▼
Explorer   Console       API
(public)   (auth'd)    (keyed)
```

### What exists and does not change

- Indexer (Edge Function + pg_cron) — indexes events from all chains
- `scope_events`, `agents`, `indexer_cursors` — same tables
- Realtime subscriptions — explorer receives live push
- Discovery rules engine — runs in browser

### New tables (incremental)

| Table | Purpose |
|-------|---------|
| `owner_profiles` | Wallet address → agent claim. One owner can claim multiple agents. |
| `alert_rules` | 3 predefined rules per agent: reputation_drop, sybil_detected, feedback_spike |
| `incidents` | Timeline of significant events: what happened, when, why it matters |

### Auth

Supabase Auth with wallet connect (Sign-In with Ethereum). Owner signs a message, verified against `ownerOf()` on-chain. Zero passwords.

### API

Supabase Edge Functions as API gateway. Rate limited by API key (`api_keys` table). Read-only endpoints over the same tables.

## Product Surfaces — Detail

### Explorer (exists — M1-M3 complete)

The growth engine. Already built:

- **Agent cards** — every `/agent/{chain}/{id}` is a landing page with OG image. One tweet = one impression = one potential owner discovering DenScope.
- **Live Feed** — the visual hook. Real-time on-chain events with pulse animations.
- **Trust Graph** — visual differentiator. No other agent explorer has this.
- **Discovery Signals** — pattern detection (first_blood, rising_star, sybil_alert).
- **Filters** — kind, chain, agent ID, severity, search. URL params for shareable views.

**What it still needs for growth:**
- Functional CTA on every agent card: "Are you the owner? Claim this agent"
- Improved share-to-X with image preview

### Console (new — M4/M5)

Owner authenticates with wallet, claims agent (verified on-chain via `ownerOf()`), accesses:

**1. Signals Feed** (curated, 5-8 top signals)
- `reputation_drop` — score dropped X% in Y time
- `sybil_cluster` — suspicious interactions detected
- `feedback_spike` — unusual feedback spike (positive or negative)
- `first_interaction` — new client interacted with the agent
- `validation_complete` — a validator responded about the agent

**2. Incidents** (timeline + "why it matters")
- Each significant signal generates an incident
- Chronological timeline: what happened, tx hash, estimated impact
- "Why it matters": one-sentence explanation for the owner

**3. Alerts** (1 channel + 3 predefined rules)
- Channel: webhook URL (owner pastes their Telegram bot, Discord webhook, or Slack)
- 3 rules activated by default:
  - Reputation drops > 20% in 24h
  - Sybil pattern detected
  - Zero feedback in 7 days (agent going cold)
- No custom rules in V1. Toggle on/off only.

### API (M6+)

Read-only endpoints, rate-limited by API key:

```
GET /v1/agent/{chain}/{id}          → agent profile + metadata
GET /v1/agent/{chain}/{id}/score    → trust score + breakdown
GET /v1/agent/{chain}/{id}/signals  → active signals
GET /v1/agent/{chain}/{id}/events   → event history (paginated)
GET /v1/search?q=                   → agent search
```

The trust score is the premium product: a number derived from signals, feedback history, validation status, and agent age. The formula is transparent and documented.

## Milestones

Event-driven. Each milestone is independently shippable and generates visibility. No external dependencies.

### M4: Owner Claim & Profile

**Unlock:** Agent owners can claim their agent. Bridge from "public explorer" to "my product."

- Supabase Auth with wallet (SIWE)
- Claim flow: connect wallet → verify `ownerOf()` on-chain → link profile
- Owner dashboard shell (authenticated layout, sidebar, empty states)
- "Claimed" badge visible on public agent card
- Functional CTA on `/agent/{chain}/{id}`: "Claim this agent"

**Shippable moment:** "Agent owners can now claim their agents on DenScope."

### M5: Signals, Incidents & Alerts

**Unlock:** The owner has a reason to return daily. DenScope goes from "tool I visit once" to "dashboard I monitor."

- 5 server-side signal rules
- Incidents table + timeline UI
- Webhook alerts (1 URL, 3 predefined rules, on/off toggle)
- Notification badge in nav for new incidents

**Shippable moment:** "DenScope now monitors your agent 24/7 and alerts you when something happens."

### M6: Reputation API

**Unlock:** Other protocols can consume trust data. DenScope becomes infrastructure.

- API key management in console
- Edge Function endpoints (5 routes)
- Trust score algorithm v1 (transparent formula, documented)
- Rate limiting (free: 100 req/day, pro: 10K req/day)
- Public API docs page (`/docs/api`)

**Shippable moment:** "Any dApp can now query agent reputation via the DenScope API."

### M7+: Scale & Moat (future, no scope yet)

- More chains (Avalanche, Base, Arbitrum)
- Agent framework SDKs (npm package for LangChain, CrewAI)
- Trust score v2 (ML-based, historical trends)
- Agent comparison tool
- Embeddable trust badges for third-party sites

## Competitive Moat

The moat builds in layers:

**Layer 1 — Data moat (in progress).** DenScope is the only dedicated ERC-8004 indexer. Every minute that passes accumulates more historical data that nobody else has. A fork cannot replicate time.

**Layer 2 — Owner network (M4).** When owners claim their agents, they choose DenScope as their home. Their alerts, incidents, and API keys live here. Migration costs effort. Each claimed owner is a retained user.

**Layer 3 — API integrations (M6).** When a protocol integrates `GET /v1/agent/{chain}/{id}/score` into their contract flow or frontend, that integration stays. Changing trust score providers requires refactoring code. Classic infrastructure moat.

### Why DenScope wins

| Potential competitor | Why they don't win |
|---------------------|-------------------|
| Block explorers (Celoscan, Etherscan) | See agents as just another transaction. Don't understand ERC-8004 as a primitive. Won't build signals or trust scores. |
| Agent platforms (Olas, Autonolas) | Vendor-locked to their own framework. DenScope is chain-agnostic and framework-agnostic. |
| Generic monitoring (Tenderly, Forta) | Monitor contracts, not agents. No social layer (cards, share, claim). |
| Someone forks DenScope | Can copy the code, not the historical data, not the claimed owners, not the API integrations. |

### Timing advantage

ERC-8004 is early. ~280 events on 2 chains. The market is small TODAY. But that means DenScope can become THE standard explorer before the ecosystem explodes. When there are 10,000 agents on 10 chains, DenScope is already the incumbent with the full history. Like building Etherscan in 2015 when there were 10 contracts.

## Growth Playbook

### Build in public loop

```
Ship feature → Tweet with demo → Community reacts
     ↑                                    │
     │                                    ▼
     └──── Feedback informs ← ← ← ← next feature
```

### Tactics by milestone

**M4 (Claim):**
- Tweet thread: "Your AI agent now has a verified profile on-chain. Here's how to claim it." with 30s video
- Tag known agent owners on Celo. Few enough for 1:1 outreach
- The "Claimed" badge creates FOMO for other owners

**M5 (Signals + Alerts):**
- Demo video: "I got a Telegram alert 47 seconds after negative feedback on my agent"
- Each new signal rule is a tweet
- Incidents timeline is highly visual — screenshots that share themselves

**M6 (API):**
- "Trust score for any ERC-8004 agent in one curl command" — developer bait
- Publish trust score formula openly. Transparency = trust = differentiator
- Integration bounties: "integrate DenScope trust scores, get 6 months free pro"

### Agent cards as zero-effort content engine

Each agent card is:
1. **A shareable URL** — `/agent/42220/5` is a permanent landing page
2. **An OG image** — looks good on Twitter, Discord, Telegram with zero effort
3. **A CTA** — "Claim this agent" converts visitors to owners
4. **An embed** — any blog or docs can embed the widget

Card volume grows linearly with registered agents. DenScope doesn't create content — agents registering on-chain create cards automatically.

### Metrics that matter

| Metric | Indicates | Target M4 | Target M6 |
|--------|-----------|-----------|-----------|
| Agents indexed | Ecosystem coverage | All Celo agents | +2 chains |
| Owners claimed | Console PMF | 10 | 50 |
| Cards shared (OG hits) | Growth engine virality | 100/week | 500/week |
| API calls/day | Developer adoption | — | 100/day |
| Alert webhooks active | Retention / stickiness | 5 | 30 |

## API Buyers

**Primary: dApps / protocols.** Any protocol that lets an agent interact needs to answer "can I trust this agent?" before executing. That question is the API: `GET /score/{chain}/{agentId}` → trust score + signals.

**Secondary: Agent frameworks.** If CrewAI or LangChain integrate DenScope trust scoring in their orchestration, every agent built on those frameworks consumes the API automatically. Depends on on-chain ecosystem maturity — second step.

---

*Document created: 2026-02-15. Approved by @wolfcito.*
*Context: Brainstorming session recovering lost product vision and defining DenScope's evolution from explorer to trust infrastructure.*
