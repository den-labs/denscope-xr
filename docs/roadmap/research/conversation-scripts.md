# Phase 0 Conversation Scripts

**Date:** 2026-03-24
**Issue:** #138
**Target:** 5 conversations across 3 personas
**Duration:** 12-15 min each
**Format:** async (DM/chat) or sync (call)

---

## General Rules

- Do NOT pitch or demo DenScope during the conversation
- Do NOT explain what DenScope does until after questions are answered
- Ask about current behavior first, then hypothetical adoption
- "Would you use X?" is weak. "What do you do today when X?" is strong.
- If they say "interesting" without a concrete use case, that's a negative signal
- Record exact quotes, not paraphrases

---

# Script A: Builder / Integrator

**Who:** dApp developer, AI agent builder, MCP tool developer, protocol developer building with agents

**Objective:** Determine if developers would integrate trust score data into their applications, and what would trigger that decision.

**Hypothesis:** Developers building agent-facing applications need a trust signal before executing actions (delegation, payments, collaboration) and would integrate an API/SDK if it saves them building their own scoring.

## Opening (30 sec)

> "I'm researching how developers working with on-chain agents handle trust decisions. I'm not selling anything — I want to understand what you actually do today. This takes ~12 minutes."

## Main Questions

### Q1: Current behavior
> "When your app or agent interacts with another on-chain agent for the first time, how do you decide whether to proceed?"

**Follow-ups:**
- "Is that a manual check or automated?"
- "What data points do you look at?"
- "How long does that process take?"

### Q2: Pain point
> "Has there been a time when an interaction with an agent went wrong — spam, bad data, wasted gas, unexpected behavior?"

**Follow-ups:**
- "What happened? What was the cost?"
- "How did you detect it was a bad agent?"
- "Did you change your approach after that?"

### Q3: Decision threshold
> "Imagine you had a 0-100 trust score for any ERC-8004 agent, updated in real-time, queryable via API. At what point in your workflow would you check it?"

**Follow-ups:**
- "Before what action specifically?"
- "What score would make you proceed vs. reject?"
- "Would you gate automated actions on this, or only manual decisions?"

### Q4: Integration reality
> "If that trust score were available as a 3-line SDK call (`npm install @denlabs/trust-sdk`), what would need to be true for you to integrate it this month?"

**Follow-ups:**
- "What's the blocker — time, priority, trust in the data, something else?"
- "Do you have a staging or test environment where you'd try it first?"
- "Who else would need to approve that integration?"

### Q5: Payment / cost
> "Would you pay per API call for trust data, or does it need to be free for you to try it?"

**Follow-ups:**
- "What's the maximum per-call cost that wouldn't require approval? ($0.001? $0.01?)"
- "Would a free tier of 100 calls/day be enough to evaluate?"
- "Have you ever integrated a paid API into a project? Which one?"

## Signal Classification

| Signal | Positive | Negative |
|--------|----------|----------|
| Current pain | Describes specific bad interaction, cost, or manual process | "Never had a problem" or "We don't interact with agents" |
| Trust check | Already does some form of manual/automated trust check | "We just proceed and hope for the best" (= no perceived need) |
| Integration intent | Names a specific place in their code or workflow | "Maybe someday" or "I'd have to think about it" |
| Score usage | Describes concrete threshold or gating logic | "I'd look at it but not act on it" |
| Payment | Has integrated paid APIs before, names a price point | "It needs to be free forever" or "I'd never pay for this" |

## Red Flags

- They've never built anything that interacts with other agents
- Their "agents" are scripts, not ERC-8004
- They express interest but can't name a single integration point
- They want trust data for humans, not agents
- "Interesting idea" without any behavioral follow-up

## Notes Template

```markdown
### Conversation A: Builder/Integrator
**Date:**
**Name/handle (optional):**
**Context:** (what they build, what chain, what agents)

**Q1 Current behavior:**
> (exact quote or close paraphrase)

**Q2 Pain point:**
> (specific incident or "none")

**Q3 Decision threshold:**
> (where in workflow, what score threshold)

**Q4 Integration reality:**
> (blocker, timeline, who decides)

**Q5 Payment:**
> (price tolerance, prior paid API experience)

**Overall signal:** STRONG / MODERATE / WEAK / NONE
**Key quote:**
**Would they try the SDK this month?** YES / MAYBE / NO
**Surprise or insight:**
```

---

# Script B: Agent Owner

**Who:** Person or team that has deployed an ERC-8004 agent on Celo, or is planning to. May or may not know their agent has a trust score.

**Objective:** Determine if agent owners care about their agent's reputation, would claim it, and would set up monitoring/alerts.

**Hypothesis:** Agent owners want visibility into how their agent is perceived, need to know about anomalies (sybil attacks, reputation drops), and would use a console to manage their agent's trust profile.

## Opening (30 sec)

> "I'm researching how people who deploy on-chain agents think about reputation and monitoring. Not selling anything — just want to understand what you care about today. ~12 minutes."

## Main Questions

### Q1: Current visibility
> "After you deploy an agent on-chain, how do you monitor how it's being used or perceived?"

**Follow-ups:**
- "Do you check block explorer manually? How often?"
- "Do you have any alerts set up for your agent's activity?"
- "Have you ever been surprised by something your agent did or received?"

### Q2: Reputation awareness
> "Do you know if anyone has given your agent positive or negative feedback on-chain?"

**Follow-ups:**
- "How would you find out if you didn't?"
- "If your agent received a burst of negative feedback, how quickly would you want to know?"
- "What would you do about it?"

### Q3: Trust score value
> "If your agent had a public trust score (0-100) visible to anyone, would that concern you or motivate you?"

**Follow-ups:**
- "Would you want to display a high score somewhere — your docs, your site?"
- "Would you change your agent's behavior based on the score?"
- "Would a low score affect your credibility or funding?"

### Q4: Console adoption
> "If you could claim your agent, see its trust score, get alerts on anomalies (sybil patterns, reputation drops), and manage API access — all in one dashboard — would you set that up?"

**Follow-ups:**
- "What's the first thing you'd want to see?"
- "Would you set up a Slack/Discord webhook for alerts?"
- "How often would you check this dashboard — daily, weekly, only when something breaks?"

### Q5: Certificate value
> "If you could generate a verifiable trust certificate for your agent — shareable link, QR code, IPFS-stored — where would you use it?"

**Follow-ups:**
- "Would you put it in your README, docs, grant application?"
- "Would you share it on Twitter/Farcaster?"
- "Would a certificate with a low score be worse than no certificate?"

## Signal Classification

| Signal | Positive | Negative |
|--------|----------|----------|
| Monitoring | Has some monitoring or wants it badly | "I deploy and forget" |
| Reputation | Cares about feedback, has checked | "Feedback doesn't matter for my use case" |
| Score motivation | Would display score, change behavior based on it | "It's just a number" |
| Console adoption | Would claim immediately, set up alerts | "Maybe later" or "Too much friction" |
| Certificate | Names a specific place to share it | "Cool but I wouldn't use it" |

## Red Flags

- They deployed an agent once and abandoned it
- Their agent is a test/tutorial deployment, not production
- They care about score but only if they can game it
- "I'd claim it if someone made me" (no intrinsic motivation)
- They don't check block explorer or any monitoring

## Notes Template

```markdown
### Conversation B: Agent Owner
**Date:**
**Name/handle (optional):**
**Context:** (what agent, what chain, what it does, production or test)

**Q1 Current visibility:**
> (how they monitor, how often)

**Q2 Reputation awareness:**
> (know about feedback? what would they do?)

**Q3 Trust score value:**
> (motivation to have a high score, concern about low)

**Q4 Console adoption:**
> (would they claim, set up alerts, check dashboard)

**Q5 Certificate value:**
> (where they'd share it, concrete use case)

**Overall signal:** STRONG / MODERATE / WEAK / NONE
**Key quote:**
**Would they claim their agent this week?** YES / MAYBE / NO
**Surprise or insight:**
```

---

# Script C: Ecosystem Operator

**Who:** Protocol security person, DAO contributor evaluating agents, grant reviewer, infrastructure operator who needs to assess agent trustworthiness at scale.

**Objective:** Determine if there's a B2B buyer for trust data — someone who needs to assess many agents and would pay for anomaly detection or bulk trust scoring.

**Hypothesis:** Ecosystem operators need trust signals to make decisions about which agents to fund, list, approve, or interact with, and currently have no systematic way to do this.

## Opening (30 sec)

> "I'm researching how people who evaluate or approve on-chain agents make trust decisions. Not selling anything — just trying to understand the process today. ~12 minutes."

## Main Questions

### Q1: Current evaluation process
> "When you need to evaluate whether an on-chain agent is trustworthy — for a grant, listing, partnership, or approval — what do you actually do?"

**Follow-ups:**
- "How many agents do you evaluate per month?"
- "How long does each evaluation take?"
- "What data sources do you use?"

### Q2: Pain at scale
> "What breaks in that process when you have 10 agents to evaluate? 50? 100?"

**Follow-ups:**
- "Have you ever approved an agent that turned out to be problematic?"
- "What was the cost of that mistake?"
- "Is there a vetting step you skip because it takes too long?"

### Q3: Trust data consumption
> "If you had an API that returned a trust score, risk label, and incident history for any ERC-8004 agent — how would you use it?"

**Follow-ups:**
- "Would you automate approval/rejection based on score?"
- "Would you use it as one input alongside others, or as the primary filter?"
- "What score threshold would you trust for automated decisions?"

### Q4: Anomaly detection value
> "If you could get real-time alerts when an agent you've approved shows anomalous behavior — sybil patterns, reputation drops, feedback spikes — would that change how you operate?"

**Follow-ups:**
- "Would you pay for that monitoring?"
- "Would you want a dashboard, webhooks to Slack, or raw API access?"
- "How fast do you need to know about an anomaly — minutes, hours, days?"

### Q5: Budget and procurement
> "Does your team/DAO/protocol have budget for security or evaluation tools?"

**Follow-ups:**
- "What's the range — under $100/month? Under $1000?"
- "Who approves that spend?"
- "Have you paid for any evaluation or security tool before? Which one?"

## Signal Classification

| Signal | Positive | Negative |
|--------|----------|----------|
| Evaluation volume | Evaluates 10+ agents/month | "We've evaluated 2 agents ever" |
| Pain at scale | Describes manual bottleneck, mistakes, time cost | "Our current process works fine" |
| API integration | Would automate or semi-automate with scores | "I'd rather just look at a page" |
| Anomaly alerts | Names specific scenario where alert saves money/reputation | "Nice to have" |
| Budget | Has budget, names range, has bought tools before | "We don't pay for tools" or "DAO would never approve" |

## Red Flags

- They evaluate agents by reading Twitter threads, not on-chain data
- Their "evaluation" is one person eyeballing a contract
- They don't interact with ERC-8004 agents specifically
- "We'd use it if it were free" with no budget path
- They conflate agent trust with smart contract audit

## Notes Template

```markdown
### Conversation C: Ecosystem Operator
**Date:**
**Name/handle (optional):**
**Context:** (role, org type, how many agents they evaluate, what chain)

**Q1 Current evaluation process:**
> (what they do, how long, data sources)

**Q2 Pain at scale:**
> (what breaks, cost of mistakes)

**Q3 Trust data consumption:**
> (how they'd use API, automation level)

**Q4 Anomaly detection value:**
> (would they pay, delivery preference, speed requirement)

**Q5 Budget:**
> (range, who approves, prior tool purchases)

**Overall signal:** STRONG / MODERATE / WEAK / NONE
**Key quote:**
**Would they trial an API this quarter?** YES / MAYBE / NO
**Surprise or insight:**
```

---

# Cross-Conversation Synthesis Template

Complete after all 5 conversations.

```markdown
# Phase 0 Conversation Synthesis

**Date:**
**Conversations completed:** X / 5
**Personas covered:** Builder (X), Agent Owner (X), Ecosystem Operator (X)

## Signal Summary

| Persona | Respondents | Strong | Moderate | Weak | None |
|---------|-------------|--------|----------|------|------|
| Builder / Integrator | | | | | |
| Agent Owner | | | | | |
| Ecosystem Operator | | | | | |

## Strongest Sub-Hypothesis

Which showed the most pull?
- [ ] Trust API / SDK (developer integration)
- [ ] Trust Certificate (agent owner display/sharing)
- [ ] Anomaly Detection / TrustOps (operator monitoring)
- [ ] None showed actionable demand

**Evidence:**
> (2-3 key quotes or behavioral signals)

## Weakest Sub-Hypothesis

Which showed the least pull?
- [ ] Trust API / SDK
- [ ] Trust Certificate
- [ ] Anomaly Detection / TrustOps

**Evidence:**
> (why — quotes, lack of pain, no use case)

## Surprises

Things that came up that we didn't ask about or expect:
1.
2.
3.

## Behavioral Indicators (not opinions)

| Indicator | Count |
|-----------|-------|
| Named a specific integration point for trust data | /5 |
| Described a concrete incident caused by lack of trust data | /5 |
| Would try SDK/API this month (unprompted) | /5 |
| Has budget or authority to pay for trust tooling | /5 |
| Currently does some form of agent trust evaluation | /5 |
| Expressed zero need for trust data | /5 |

## Kill Criteria Check

From the hardened strategy, kill criteria are met if ALL of:
- Zero conversations produce "I would use this for X" (specific use case)
- All conversations are polite but non-committal ("interesting idea")
- No respondent names a concrete integration point or workflow change

**Kill criteria met?** YES / NO

## Go/No-Go Recommendation

Based on conversations + baseline metrics (#137):

**Recommendation:** GO / PIVOT / PAUSE

**If GO — lead with:**
> (which sub-hypothesis: API, certificate, or TrustOps)

**If PIVOT — to what:**
> (alternative thesis or buyer)

**If PAUSE — redirect to:**
> (Ayni, other DenLabs project, or shelf)

**Rationale:**
> (3-5 sentences grounded in evidence, not hope)
```
