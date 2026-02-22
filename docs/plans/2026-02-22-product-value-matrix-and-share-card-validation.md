# Denscope Product Value Matrix and Share Card Validation (PoC -> Product)

## Context

This document captures product decisions and validation frameworks discussed while evaluating whether current tabs/routes meaningfully contribute to Denscope's product value or mainly consume attention and engineering resources.

Key themes:
- Move from "looks interesting" to "enables a user decision"
- Treat `/graph` as a hypothesis, not a sacred feature
- Elevate the shareable agent card from a visual artifact to a growth + trust mechanism
- Tie the card to ERC-8004 feedback as a proof-of-usefulness signal

## Product Narrative (Current Direction)

Denscope should be positioned as:

- observability for agent activity
- reputation/trust interpretation
- operational response tooling

Proposed core loop:

1. Detect activity (`/` live feed)
2. Prioritize signals (`/discovery`)
3. Understand trust/risk (`XRay`, `/agent/[chain]/[id]`)
4. Take action (`/console`)
5. Distribute trust proof (shareable card, embeds, API/docs)

## Tab / Route Value Matrix

Scoring (1-5):
- Value: real user usefulness
- Frequency: expected recurrent usage
- Actionability: enables a decision/action
- Differentiation: adds something unique
- Cost: performance + maintenance + attention (higher is worse)

Heuristic net score:
- (Value + Frequency + Actionability + Differentiation) - Cost

### `/` (Live Feed)

- Role: Real-time observability entry point
- Persona: Operator, analyst, agent owner
- JTBD: "What is happening now and what deserves attention?"
- Value: 5
- Frequency: 5
- Actionability: 5
- Differentiation: 4
- Cost: 3
- Net: 16
- Decision: `KEEP (CORE)`

### `XRay Panel` (Inspection Layer)

- Role: Fast agent inspection without leaving current flow
- Persona: Operator, investigator
- JTBD: "Give me enough context to decide quickly"
- Value: 5
- Frequency: 4
- Actionability: 4
- Differentiation: 4
- Cost: 3
- Net: 14
- Decision: `KEEP (CORE UX)`

### `/agent/[chain]/[id]` (Full Agent Report)

- Role: Full evidence-backed trust/risk dossier
- Persona: Analyst, auditor, partner, owner
- JTBD: "I need the full picture and evidence"
- Value: 5
- Frequency: 3
- Actionability: 5
- Differentiation: 4
- Cost: 3
- Net: 14
- Decision: `KEEP (CORE)`

### `/discovery`

- Role: Signal prioritization and pattern surfacing
- Persona: Analyst, operator
- JTBD: "Show me what matters without scanning everything"
- Value: 4
- Frequency: 3
- Actionability: 4
- Differentiation: 4
- Cost: 3
- Net: 12
- Decision: `KEEP (CORE INSIGHTS)`

### `/console`

- Role: Operations center (claim, alerts, incidents, API keys)
- Persona: Agent owner, operator
- JTBD: "Configure, protect, and operate my agents"
- Value: 5
- Frequency: 4
- Actionability: 5
- Differentiation: 4
- Cost: 3
- Net: 15
- Decision: `KEEP (CORE)`

### `/docs/api`

- Role: Developer enablement and technical adoption
- Persona: Integrator, partner engineer
- JTBD: "Integrate Denscope fast and correctly"
- Value: 4
- Frequency: 3
- Actionability: 4
- Differentiation: 3
- Cost: 2
- Net: 12
- Decision: `KEEP (GROWTH / DEV ENABLEMENT)`

### `/graph`

- Original hypothesis: Visualize relationships between agents
- Current reality: High-friction selection, redundant with Feed + XRay, high render cost
- Persona: Not clearly defined (risk signal)
- JTBD: Unclear / weakly articulated
- Value: 2
- Frequency: 1
- Actionability: 1
- Differentiation: 2
- Cost: 5
- Net: 1
- Decision: `MOVE TO LABS` (or temporary sunset from main nav)

Notes:
- The visual idea is not invalid; the current implementation has not proven product utility.
- Re-invest only with a concrete investigation use case (clusters, sybil/coordinated patterns, anomaly analysis).

## `/graph` Decision Summary

Short-term recommendation:

1. Remove from primary navigation (keep code behind Labs/flag)
2. Preserve as experiment, not core commitment
3. Re-enter roadmap only with a validated user decision it improves

Question that must be answered before revival:

- "What decision can a user make faster with `/graph` than with Feed + Discovery + XRay?"

If no crisp answer exists, keep it in Labs.

## Shareable Agent Card (Trust Certificate) - Product Role

### Why this can matter

The shareable card is not only a design artifact. It can become a product distribution mechanism if it:

1. Creates utility for the sharer (status, proof, promotion, transparency)
2. Creates utility for the receiver (understandable trust/risk signal + context)
3. Creates return traffic to Denscope (share -> click -> portal -> action)

### Strategic classification

- Not core operational workflow
- Yes: `Core-adjacent` growth/distribution layer
- Priority should scale only after it proves measurable return and trust signal usefulness

## Shareable Card Validation Matrix (ERC-8004 Feedback Powered)

### Product thesis

If Denscope turns ERC-8004 feedback into a clear, credible, and shareable trust/risk summary, then:
- agent owners will share it to prove usefulness/credibility
- receivers will click through to validate context
- Denscope will gain qualified traffic and repeat visits

### Validation matrix

#### Hypothesis H1: Owners will share a trust card when it helps them signal credibility

- User: Agent owner / builder
- Need: "I need a compact proof that my agent is useful/trustworthy"
- Card must show:
  - identity (name/agent)
  - chain
  - trust/risk snapshot
  - feedback volume and positivity context
  - timestamp/snapshot context
- Test:
  - expose share CTA in XRay + full agent report
  - track share-intent and completed share actions
- Success signals:
  - meaningful share intent rate from viewed cards
  - repeated sharing by same owner over time
- Failure signals:
  - low share usage despite views
  - owners report "looks nice but says nothing useful"
- Risk:
  - weak trust model or unclear semantics reduces confidence in sharing

#### Hypothesis H2: Receivers will click through if the card communicates enough value and curiosity

- User: Viewer on social media
- Need: "Why should I care about this agent?"
- Card must communicate:
  - what the score means (or plain-language label)
  - risk level / confidence / recent activity
  - clear reason to inspect more
- Test:
  - compare two card variants (status-forward vs narrative-forward)
  - measure CTR to Denscope
- Success signals:
  - strong CTR from shared links
  - sessions continue beyond landing page
- Failure signals:
  - impressions without clicks
  - clicks bounce immediately (message-content mismatch)
- Risk:
  - "badge effect" without explanation creates skepticism

#### Hypothesis H3: ERC-8004 feedback is the strongest narrative anchor for the card

- User: Sharer + receiver
- Need: "Why is this trust claim credible?"
- Claim:
  - feedback transactions act as onchain evidence of usefulness/validation
- Test:
  - compare card copy/structure:
    - generic trust score only
    - trust score + feedback evidence summary
- Success signals:
  - higher share rate with evidence-backed card
  - higher CTR / time-on-page from evidence-backed cards
- Failure signals:
  - no lift from adding feedback evidence
- Risk:
  - users do not understand what ERC-8004 feedback means without education

#### Hypothesis H4: Share cards can drive return loops, not only one-time vanity traffic

- User: Returning viewers and sharers
- Need: "Follow agent quality over time"
- Mechanism:
  - snapshot-based cards + refreshed trust state
- Test:
  - track repeat visits from shared links and revisit rates to agent pages
- Success signals:
  - repeat visits to the same agent report
  - viewers explore additional agents/features
- Failure signals:
  - one-click visits with no continuation
- Risk:
  - landing experience does not continue the story started by the card

## Metrics Framework (Anti-Vanity)

### Core metrics (meaningful)

- `% XRay/Agent Report views -> share CTA click`
- `% share CTA clicks -> completed share intent`
- `CTR from social share -> Denscope`
- `% share-referred visits -> full agent report viewed`
- `% share-referred visits -> further action` (claim, explore, follow-up visit)
- `repeat share rate` by owners
- `repeat visit rate` from share-referred traffic

### Vanity metrics (insufficient alone)

- raw share count
- impressions without click-through
- social likes without return traffic

## Relevance / Prioritization Timing (When It Deserves More Attention)

### Now (Deserves investment)

Prioritize the shareable card as a validated experiment if:
- trust/risk snapshot is already understandable
- card communicates useful content (not only decoration)
- landing page/report continues the story
- instrumentation is in place

Recommended placement now:
- XRay panel
- Full agent report page

### Next (Increase prominence if validated)

Promote further if:
- share usage is consistent
- CTR and return traffic are strong
- referred users continue into core journey (Feed/Report/Console)

Possible upgrades:
- better templates
- owner-specific share modes
- periodic "fresh snapshot" nudges

### Later (Strategic narrative layer)

Only after trust model credibility and retention improve:
- campaign-grade card variants
- ecosystem badges / embeds
- recurring summaries ("weekly trust snapshots")

## Suggested Product Prioritization (PoC -> Next Level)

1. Strengthen core journey (`Feed -> XRay -> Report -> Console`)
2. Improve signal quality (`Discovery`)
3. Treat `/graph` as Labs until proven useful
4. Build shareable card as a measurable growth + trust feature
5. Tie card semantics tightly to ERC-8004 feedback evidence

## Agent Switching Guidance (BMAD / Strategy Work)

Use this as a practical handoff map during product strategy work:

Related collaboration policy (persistent session preference):
- See `docs/process/collaboration-protocol.md` for the agreed rule that the assistant can manage agent switches proactively but must notify Wolfcito before switching and explain why.

### Stay with `brainstorming-coach` (Carson) when:
- exploring hypotheses
- generating alternative product directions
- reframing feature narratives
- evaluating "does this deserve to exist?"

### Switch to `innovation-strategist` (Victor) when:
- choosing market positioning
- defining differentiation and moat
- prioritizing strategic bets (e.g., trust card as growth channel)

### Switch to `design-thinking-coach` (Maya) when:
- defining user jobs and moments of use
- designing the share card flow (share intent -> landing -> trust understanding)
- clarifying user comprehension problems (e.g., "what does feedback mean?")

### Switch to `creative-problem-solver` (Dr. Quinn) when:
- a feature is clearly valuable but blocked by execution constraints
- you need structured decomposition of a hard problem (e.g., trust model semantics, fraud/risk scoring framing)

### Switch back to implementation agent (Codex / engineering mode) when:
- hypotheses and metrics are approved
- success criteria are defined
- you are ready to instrument, prototype, or refactor

## Immediate Next Decisions (Recommended)

1. Mark `/graph` as Labs in product strategy (not core)
2. Define the share card MVP around ERC-8004 feedback evidence (not only score aesthetics)
3. Add a measurement plan before expanding card prominence
4. Establish a per-tab ownership + success metric table for quarterly prioritization
