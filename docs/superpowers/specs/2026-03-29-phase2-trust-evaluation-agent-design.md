# DenScope Phase 2: Trust Evaluation Agent — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Author:** Wolfcito + Claude (Product Strategy + Technical Lead)

---

## 1. Executive Recommendation

DenScope Phase 2 repositions the product from **trust surface** (displaying scores) to **trust evaluation system** (issuing contextual judgments).

The central deliverable is the **DenScope Agent v0**: an evaluation endpoint that composes existing judgment capabilities (score, status, sybil risk, signals) and interprets them through configurable presets. This endpoint is exposed as API, SDK method, and MCP tool — in that order.

Phase 2 does not start with Discovery redesign (#133), developer portal, or certificate v2. It starts with evaluation capability because that is the real differentiation: **contextual trust judgment, not visibility**.

### Product Thesis

The SDK alone is not the full trust layer.

- **SDK** = evidence layer (raw records, feedbacks, validations, scores, activity)
- **DenScope Agent** = judgment layer (interprets evidence, applies context, emits evaluation)
- **Presets** = product layer (categories that change the judgment for specific use cases)

The differentiator is not another trust score. The differentiator is **contextual evaluation for a concrete decision**.

---

## 2. Why Discovery Redesign Should NOT Be First

- Discovery (#133) is a **presentation** problem, not a **capability** problem. Redesigning how anomalies are displayed adds no new capability.
- Without an evaluation layer, Discovery remains a feed of raw signals — nice looking but not actionable.
- The redesign makes sense **after** TrustOps beta has clearer workflow framing, because Discovery workflows change based on what the system can evaluate.
- Executing #133 first reinforces the "explorer" positioning we are moving away from.

**#133 remains deferred until the evaluation endpoint exists and has at least one productive preset.**

---

## 3. Phase 2 Order

| Step | Deliverable | Why this order |
|------|------------|----------------|
| **P2-1** | SKALE trust slice | Validates real multichain, activates second market |
| **P2-2** | Evaluation composer + 3 presets | Core capability — everything else depends on this |
| **P2-3** | `POST /api/v1/trust/evaluate` endpoint | Public surface for the evaluation capability |
| **P2-4** | SDK `evaluate()` method | Typed convenience for integrators |
| **P2-5** | MCP `trust_evaluate` tool | AI assistant surface |
| **P2-6** | Developer portal | Docs, API keys, onboarding — now with `/evaluate` as headline feature |
| **P2-7** | Trust certificate v2 | Certificates backed by evaluation, not just score |
| **P2-8** | Discovery / TrustOps beta (#133) | Now with evaluation context to give it meaning |
| *(optional)* | DenScope Agent ERC-8004 registration | On-chain identity — valuable for ecosystem but not required for v0 value |

### Core path vs secondary path

- **Core path:** SKALE -> EVAL -> SDK -> MCP (blocks value delivery)
- **Secondary path:** Agent registration, developer portal, cert v2, Discovery (enhances but does not block)

---

## 4. Product Framing

### SDK as Evidence Layer

The trust-sdk provides normalized evidence through 5 methods:

| Method | Returns |
|--------|---------|
| `getAgent()` | Profile, metadata, feedback counts, claim status |
| `getScore()` | Trust score 0-100 with breakdown and stats |
| `getSignals()` | Open/resolved incidents with severity |
| `getEvents()` | On-chain event history (paginated) |
| `search()` | Agent search across the oracle |

The SDK does not interpret. It does not judge. It delivers structured evidence for consumers or the evaluation layer to decide.

### DenScope Agent as Judgment Layer

The `/evaluate` endpoint takes evidence (internally via direct function calls, not HTTP to itself) and applies contextual judgment. It composes:

- `computeTrustScore()` — numeric score 0-100
- `getAgentStatus()` — HEALTHY / WARNING / CRITICAL / NEW
- `getSybilRisk()` — LOW / MEDIUM / HIGH
- `getShareCardState()` — trustworthy / monitoring / high_risk / insufficient_signal
- Signal history — incidents with severity and resolution status
- Activity summary — freshness, velocity, trend

The composition is **deterministic** (no LLM, no randomness). Same input produces same output. This makes evaluations auditable, reproducible, and defensible.

### Presets as Product Layer

Each preset defines what weighs more, what thresholds apply, and what action to recommend. Presets are not cosmetic labels — they change the real output.

V0 ships with 3 presets covering 3 risk levels and 3 consumer profiles:

| Preset | For | Philosophy |
|--------|-----|-----------|
| `default_safety` | Any app needing a basic gate | Permissive with minimal signal, conservative without |
| `agent_to_agent` | Agents evaluating other agents | Sensitive to recent activity and sybil patterns |
| `defi_counterparty` | DeFi protocols evaluating counterparties | Demands strong proof, assumes no trust |

---

## 5. V0 Scope — DenScope Agent

### In scope

- Endpoint: `POST /api/v1/trust/evaluate`
- Request body: `{ chainId, agentId, preset, context?, sensitivity?, objective? }`
- Response: structured evaluation (schema in section 7)
- 3 presets: `default_safety`, `agent_to_agent`, `defi_counterparty`
- Auth: API key or x402 (same model as `/score`)
- Deterministic evaluation: same input -> same output
- Template-based rationale (human-readable explanation)
- SDK method: `denscope.evaluate({ chainId, agentId, preset })`
- MCP tool: `trust_evaluate` with same params

### Out of scope (v0)

- Custom presets / user-defined rules
- Historical evaluation (evaluation over time)
- Batch evaluation (multiple agents in one call)
- LLM-generated rationale
- Chat interface / conversational agent
- Autonomous agent behavior
- Preset marketplace
- Cross-oracle evaluation (Ayni + DenScope combined)
- Rule engine / abstract preset framework

---

## 6. Internal Evaluation Design — Direct Composition

### Architecture

```
POST /api/v1/trust/evaluate
{ chainId, agentId, preset, context?, sensitivity? }
          │
          ▼
   ┌──────────────┐
   │ Load preset   │
   │ config        │
   └──────┬───────┘
          │
   ┌──────▼──────────────────────────┐
   │ Gather evidence (parallel)       │
   │ ├─ computeTrustScore()           │
   │ ├─ getAgentStatus()              │
   │ ├─ getSybilRisk()                │
   │ ├─ getShareCardState()           │
   │ ├─ fetch recent signals          │
   │ └─ fetch activity summary        │
   └──────┬──────────────────────────┘
          │
   ┌──────▼──────────────────────────┐
   │ Apply preset interpretation      │
   │ ├─ map score -> trust_band       │
   │ ├─ compute signal_strength       │
   │ ├─ determine status (freshness)  │
   │ ├─ determine risk_level          │
   │ ├─ collect flags[]               │
   │ ├─ resolve recommended_action    │
   │ └─ compute decision_confidence   │
   └──────┬──────────────────────────┘
          │
   ┌──────▼──────────────────────────┐
   │ Generate rationale               │
   │ (template-based, not LLM)        │
   └──────┬──────────────────────────┘
          │
          ▼
   Return EvaluationResponse
```

### Preset Configuration (internal, not exposed via API)

```ts
type PresetConfig = {
  id: string
  label: string
  description: string

  // Trust band thresholds (score-based)
  trustBand: {
    high: number      // score >= this -> 'high'
    medium: number    // score >= this -> 'medium'
    low: number       // score >= this -> 'low'
    // below low -> 'insufficient_signal' if feedbacks < minFeedbacks
  }

  // Signal gates
  minFeedbacks: number
  minConfidence: 'low' | 'medium' | 'high'

  // Risk calibration
  sybilWeight: 'normal' | 'elevated' | 'critical'
  incidentTolerance: number  // max open incidents before risk escalation

  // Action thresholds
  allowThreshold: number     // score >= this -> allow
  reviewThreshold: number    // score >= this -> review (below -> limit)

  // Freshness
  staleDays: number          // days without activity -> 'stale'
  dormantDays: number        // days without activity -> 'dormant'
}
```

### Preset Values

| Config | `default_safety` | `agent_to_agent` | `defi_counterparty` |
|--------|-------------------|-------------------|----------------------|
| minFeedbacks | 3 | 5 | 10 |
| trustBand.high | 60 | 65 | 75 |
| trustBand.medium | 35 | 40 | 55 |
| trustBand.low | 15 | 20 | 30 |
| sybilWeight | normal | elevated | critical |
| incidentTolerance | 2 | 1 | 0 |
| allowThreshold | 60 | 65 | 75 |
| reviewThreshold | 35 | 40 | 55 |
| staleDays | 30 | 14 | 7 |
| dormantDays | 90 | 45 | 21 |

### Field Semantics — status vs risk_level

These two fields serve distinct purposes and must not be conflated:

**`status`** = freshness / operating state (temporal observation)
- `active` — activity within staleDays threshold
- `stale` — no activity beyond staleDays but within dormantDays
- `dormant` — no activity beyond dormantDays
- `anomalous` — severe incidents or conflict patterns detected (NOT just inactivity)

**`risk_level`** = risk judgment (evaluation conclusion)
- `minimal` — low risk indicators across all dimensions
- `moderate` — some risk indicators present but within tolerance
- `elevated` — risk indicators exceed normal tolerance
- `critical` — hard risk signals present (sybil high, critical incidents)

Valid but requires clear rationale: `status: dormant` + `risk_level: minimal` (agent is inactive but has no negative indicators). The rationale template must explain this explicitly.

### recommended_action Precedence

The `recommended_action` field follows a strict precedence hierarchy to prevent inconsistent outputs:

```
1. HARD GATES (override everything)
   ├─ feedbacks < minFeedbacks           -> limit + insufficient_signal
   ├─ sybilWeight = critical AND          -> limit
   │  sybil risk HIGH
   └─ open critical incidents > 0         -> limit (defi_counterparty)
                                          -> review (others)

2. PRESET THRESHOLDS
   ├─ score >= allowThreshold             -> allow
   ├─ score >= reviewThreshold            -> review
   └─ score < reviewThreshold             -> limit

3. FRESHNESS MODIFIERS
   ├─ status = dormant                    -> downgrade allow -> review
   └─ status = anomalous                  -> downgrade allow -> review
                                          -> downgrade review -> limit

4. FINAL ACTION (after all modifiers applied)
```

Hard gates always win. Preset thresholds set the baseline. Freshness modifiers can only downgrade, never upgrade.

### decision_confidence

A new field that captures how confident the evaluation system is in its own judgment, distinct from signal_strength:

- **`signal_strength`** = how much evidence exists (quantity of data)
- **`decision_confidence`** = how certain the evaluator is about its conclusion (quality of judgment)

Derivation:
```
signal_strength = f(feedbackCount, confidence from score)
  strong:   feedbacks >= 20 AND confidence = high
  moderate: feedbacks >= minFeedbacks AND confidence >= medium
  weak:     feedbacks >= minFeedbacks AND confidence = low
  none:     feedbacks < minFeedbacks

decision_confidence = f(signal_strength, consistency of indicators)
  high:   signal_strength >= moderate
          AND all indicators agree (no conflicting signals)
          AND no anomalous status
  medium: signal_strength >= weak
          AND at most 1 conflicting indicator
  low:    signal_strength = none
          OR 2+ conflicting indicators
          OR anomalous status with limited data
```

Example: moderate evidence + all rules consistent = `decision_confidence: high`.
Example: strong evidence + sybil risk contradicts positive ratio = `decision_confidence: medium`.

---

## 7. Evaluation Response Schema

```ts
type EvaluateRequest = {
  chainId: number
  agentId: number
  preset: 'default_safety' | 'agent_to_agent' | 'defi_counterparty'
  context?: string       // free-text context hint (v0: logged but not used in logic)
  sensitivity?: 'low' | 'normal' | 'high'  // v0: defaults to 'normal', reserved
  objective?: string     // free-text objective hint (v0: logged but not used in logic)
}

type EvaluateResponse = {
  evaluation: {
    // Core judgment
    trust_band: 'high' | 'medium' | 'low' | 'insufficient_signal'
    status: 'active' | 'stale' | 'dormant' | 'anomalous'
    signal_strength: 'strong' | 'moderate' | 'weak' | 'none'
    risk_level: 'minimal' | 'moderate' | 'elevated' | 'critical'
    decision_confidence: 'low' | 'medium' | 'high'
    recommended_action: 'allow' | 'review' | 'limit'

    // Supporting detail
    flags: string[]
    rationale: string

    // Evidence summary (not raw — use SDK for full data)
    evidence: {
      score: number
      score_confidence: 'low' | 'medium' | 'high'  // renamed from 'confidence' to avoid confusion with decision_confidence
      feedbackCount: number
      positiveRatio: number  // 0.0–1.0 (NOT 0–100)
      openIncidents: number
      lastActivityDays: number
      ageDays: number
    }

    // Metadata
    preset: string
    evaluatedAt: string   // ISO 8601
    chainId: number
    agentId: number
  }
}
```

### Possible flags (non-exhaustive)

- `insufficient_signal` — below minimum feedback threshold for preset
- `sybil_risk_high` — sybil cluster detected (open)
- `sybil_risk_resolved` — sybil cluster detected but resolved
- `incident_open_critical` — open incident with critical severity
- `incident_open_warning` — open incident with warning severity
- `no_recent_activity` — no events within staleDays
- `dormant` — no events within dormantDays
- `reputation_declining` — negative trend detected
- `newly_registered` — agent registered recently (< 7 days)
- `unclaimed` — agent not claimed by owner

### Example Response

```json
{
  "evaluation": {
    "trust_band": "high",
    "status": "active",
    "signal_strength": "strong",
    "risk_level": "minimal",
    "decision_confidence": "high",
    "recommended_action": "allow",
    "flags": [],
    "rationale": "Agent scores 78/100 with high confidence (42 feedbacks, 88% positive). No open incidents. Active within last 3 days. All indicators consistent. Recommended action: allow.",
    "evidence": {
      "score": 78,
      "score_confidence": "high",
      "feedbackCount": 42,
      "positiveRatio": 0.88,
      "openIncidents": 0,
      "lastActivityDays": 3,
      "ageDays": 120
    },
    "preset": "default_safety",
    "evaluatedAt": "2026-03-29T18:30:00Z",
    "chainId": 42220,
    "agentId": 5
  }
}
```

### Example: Strict preset, weak signal

```json
{
  "evaluation": {
    "trust_band": "insufficient_signal",
    "status": "active",
    "signal_strength": "none",
    "risk_level": "moderate",
    "decision_confidence": "low",
    "recommended_action": "limit",
    "flags": ["insufficient_signal", "newly_registered"],
    "rationale": "Agent has only 4 feedbacks (defi_counterparty requires 10 minimum). Registered 5 days ago. Insufficient signal for financial context evaluation. Recommended action: limit until more evidence is available.",
    "evidence": {
      "score": 55,
      "score_confidence": "low",
      "feedbackCount": 4,
      "positiveRatio": 0.75,
      "openIncidents": 0,
      "lastActivityDays": 1,
      "ageDays": 5
    },
    "preset": "defi_counterparty",
    "evaluatedAt": "2026-03-29T18:30:00Z",
    "chainId": 42220,
    "agentId": 12
  }
}
```

---

## 8. Issue Pack

| # | Title | Type | Milestone | Depends on |
|---|-------|------|-----------|------------|
| 1 | `feat: SKALE poller + trust scoring for SKALE Base` | feat | M-SKALE | — |
| 2 | `feat: evaluation composer + preset configs` | feat | M-EVAL | — |
| 3 | `feat: POST /api/v1/trust/evaluate endpoint` | feat | M-EVAL | #2 |
| 4 | `feat: default_safety preset implementation` | feat | M-EVAL | #2 |
| 5 | `feat: agent_to_agent preset implementation` | feat | M-EVAL | #2 |
| 6 | `feat: defi_counterparty preset implementation` | feat | M-EVAL | #2 |
| 7 | `test: evaluation endpoint integration tests` | test | M-EVAL | #3, #4, #5, #6 |
| 8 | `feat: SDK evaluate() method in trust-sdk` | feat | M-SDK-EVAL | #3 |
| 9 | `feat: MCP trust_evaluate tool` | feat | M-MCP-EVAL | #3 |
| 10 | `docs: developer portal with /evaluate docs + quick start` | docs | M-DEVPORTAL | #3, #8 |
| 11 | `feat: trust certificate v2 backed by evaluation` | feat | M-CERT | #3 |
| 12 | `ux: Discovery redesign as TrustOps beta (#133)` | ux | M-TRUSTOPS | #3 |
| *(opt)* | `feat: register DenScope as ERC-8004 agent on-chain` | feat | — | #3 |

---

## 9. Milestone Ordering

```
M-SKALE ──────────┐
                   ├──► M-EVAL ──► M-SDK-EVAL ──► M-MCP-EVAL
(can start early)  │
                   └──► M-DEVPORTAL ──► M-CERT ──► M-TRUSTOPS
                        (starts after M-EVAL)
```

| Milestone | Name | Description |
|-----------|------|-------------|
| **M-SKALE** | SKALE Trust Slice | Poller, scoring, multichain validation |
| **M-EVAL** | Evaluation v0 | Composer + endpoint + 3 presets + tests |
| **M-SDK-EVAL** | SDK evaluate() | trust-sdk method wrapping /evaluate |
| **M-MCP-EVAL** | MCP trust_evaluate | MCP tool for AI assistants |
| **M-DEVPORTAL** | Developer Portal | Docs, API keys, onboarding with /evaluate |
| **M-CERT** | Trust Certificate v2 | Certificates backed by evaluation |
| **M-TRUSTOPS** | TrustOps Beta | Discovery redesign with evaluation context |

### Core path (blocks value delivery)

M-SKALE -> M-EVAL -> M-SDK-EVAL -> M-MCP-EVAL

### Secondary path (enhances, does not block)

M-DEVPORTAL -> M-CERT -> M-TRUSTOPS

Agent ERC-8004 registration is optional and can happen at any point after M-EVAL.

---

## 10. Risks & Non-Goals

### Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Preset calibration** | Thresholds are educated guesses; may not match real agent distribution | Make thresholds internal constants, iterate with Celo + SKALE data after launch |
| **Rationale quality** | Template-based text may sound robotic | v0 prioritizes clarity over naturalness; LLM-backed rationale is a v1 option |
| **Adoption without developer portal** | Endpoint exists but nobody finds it | M-SKALE and M-EVAL can run in parallel with minimal docs; formal portal follows |
| **Field confusion** | Consumers misinterpret status vs risk_level | Clear documentation + rationale field explains the full picture |
| **Scope creep into rule engine** | "Just one more config" pressure during implementation | Hard constraint: v0 is direct composition, no abstract framework |
| **Preset calibration churn** | Thresholds will change as real data flows in | Presets are internal and may be recalibrated without changing the endpoint response shape. Explicit preset versioning may be added later if calibration churn becomes material for consumers |

### Non-goals (v0)

- Custom presets defined by users
- Batch evaluation (multiple agents per call)
- Historical evaluation / trending over time
- LLM in the evaluation loop
- Chat interface / conversational agent
- Autonomous agent behavior
- Preset marketplace
- Cross-oracle evaluation (Ayni + DenScope combined)
- Rule engine / abstract preset framework
- Sensitivity/context/objective affecting evaluation logic (v0: logged, reserved)

---

## 11. Success Criteria

Phase 2 v0 is successful when:

1. A consumer can call `POST /api/v1/trust/evaluate` with a preset and receive a structured, useful evaluation
2. The same agent evaluated with `default_safety` vs `defi_counterparty` returns demonstrably different judgments
3. The evaluation is deterministic, auditable, and explainable via the rationale field
4. The SDK exposes `evaluate()` as a typed method
5. The MCP server exposes `trust_evaluate` as a tool consumable by AI assistants
6. At least 2 chains (Celo + SKALE) have active agents being evaluated

---

## Appendix: Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Endpoint path | `POST /api/v1/trust/evaluate` | Decoupled from agent resource routing; allows future batch/multi-object evaluation |
| Evaluation approach | Direct composition | v0 has 3 presets; rule engine is premature abstraction. Refactor at preset 5-6 |
| Exposure order | API -> SDK -> MCP | Endpoint is source of truth; SDK and MCP are surfaces |
| No LLM in v0 | Deterministic only | Auditability, reproducibility, defensibility |
| Agent registration | Optional | Value comes from evaluation capability, not on-chain identity |
| Discovery (#133) | Deferred to M-TRUSTOPS | Presentation problem, not capability problem |
