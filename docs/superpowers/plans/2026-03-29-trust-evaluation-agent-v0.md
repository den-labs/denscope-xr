# Trust Evaluation Agent v0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a contextual trust evaluation endpoint (`POST /api/v1/trust/evaluate`) to DenScope that composes existing judgment functions through configurable presets, then expose it as an SDK method and MCP tool.

**Architecture:** The evaluation composer gathers evidence from existing pure functions (`computeTrustScore`, `getAgentStatus`, `getSybilRisk`, `getShareCardState`) and Supabase queries, then applies preset-specific thresholds to produce a structured judgment with `trust_band`, `status`, `risk_level`, `decision_confidence`, `recommended_action`, `flags`, and `rationale`. No LLM, no rule engine — deterministic composition.

**Tech Stack:** Next.js 16 API routes, TypeScript, Supabase (admin client), vitest, trust-sdk (tsup), MCP SDK

**Spec:** `docs/superpowers/specs/2026-03-29-phase2-trust-evaluation-agent-design.md`

---

## File Structure

### DenScope (new files)

| File | Responsibility |
|------|---------------|
| `src/types/evaluation.ts` | All evaluation types: request, response, preset config, enums |
| `src/lib/evaluation/presets.ts` | Preset configurations (default_safety, agent_to_agent, defi_counterparty) |
| `src/lib/evaluation/gather.ts` | Evidence gathering — parallel fetch of score, incidents, agent data |
| `src/lib/evaluation/interpret.ts` | Preset interpretation — applies thresholds, computes bands/status/risk/action |
| `src/lib/evaluation/rationale.ts` | Template-based rationale generation |
| `src/lib/evaluation/compose.ts` | Top-level composer — orchestrates gather → interpret → rationale |
| `src/app/api/v1/trust/evaluate/route.ts` | POST endpoint with hybrid auth |
| `src/lib/evaluation/__tests__/presets.test.ts` | Preset config validation tests |
| `src/lib/evaluation/__tests__/interpret.test.ts` | Core interpretation logic tests |
| `src/lib/evaluation/__tests__/rationale.test.ts` | Rationale template tests |
| `src/lib/evaluation/__tests__/compose.test.ts` | Integration tests for full composer |

### trust-sdk (modifications)

| File | Responsibility |
|------|---------------|
| `packages/trust-client-core/src/types.ts` | Add `EvaluateOptions`, `EvaluateResponse` types |
| `packages/trust-client-core/src/client.ts` | Add `evaluate()` method to `TrustClient` |
| `packages/trust-client-core/src/__tests__/client.test.ts` | Add `evaluate()` tests |
| `packages/mcp-server/src/index.ts` | Add `trust_evaluate` tool |

---

## Task 1: Evaluation Types

**Files:**
- Create: `src/types/evaluation.ts`

- [ ] **Step 1: Create the evaluation types file**

```ts
// src/types/evaluation.ts

// --- Enums ---

export type TrustBand = 'high' | 'medium' | 'low' | 'insufficient_signal'
export type EvalStatus = 'active' | 'stale' | 'dormant' | 'anomalous'
export type SignalStrength = 'strong' | 'moderate' | 'weak' | 'none'
export type RiskLevel = 'minimal' | 'moderate' | 'elevated' | 'critical'
export type DecisionConfidence = 'low' | 'medium' | 'high'
export type RecommendedAction = 'allow' | 'review' | 'limit'

export type PresetId = 'default_safety' | 'agent_to_agent' | 'defi_counterparty'

export type SybilWeight = 'normal' | 'elevated' | 'critical'

// --- Request ---

export type EvaluateRequest = {
  chainId: number
  agentId: number
  preset: PresetId
  context?: string
  sensitivity?: 'low' | 'normal' | 'high'
  objective?: string
}

// --- Evidence (gathered from existing functions) ---

export type GatheredEvidence = {
  score: number
  scoreConfidence: 'low' | 'medium' | 'high'
  positiveRatio: number
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  openIncidents: number
  openCriticalIncidents: number
  openWarningIncidents: number
  hasSybilIncident: boolean
  resolvedSybilCount: number
  ageDays: number
  lastActivityDays: number
  agentExists: boolean
}

// --- Preset Config (internal) ---

export type PresetConfig = {
  id: PresetId
  label: string
  description: string
  trustBand: {
    high: number
    medium: number
    low: number
  }
  minFeedbacks: number
  minConfidence: 'low' | 'medium' | 'high'
  sybilWeight: SybilWeight
  incidentTolerance: number
  allowThreshold: number
  reviewThreshold: number
  staleDays: number
  dormantDays: number
}

// --- Interpretation result (before rationale) ---

export type InterpretationResult = {
  trust_band: TrustBand
  status: EvalStatus
  signal_strength: SignalStrength
  risk_level: RiskLevel
  decision_confidence: DecisionConfidence
  recommended_action: RecommendedAction
  flags: string[]
}

// --- Response ---

export type EvaluationEvidence = {
  score: number
  score_confidence: 'low' | 'medium' | 'high'
  feedbackCount: number
  positiveRatio: number  // 0.0-1.0
  openIncidents: number
  lastActivityDays: number
  ageDays: number
}

export type Evaluation = {
  trust_band: TrustBand
  status: EvalStatus
  signal_strength: SignalStrength
  risk_level: RiskLevel
  decision_confidence: DecisionConfidence
  recommended_action: RecommendedAction
  flags: string[]
  rationale: string
  evidence: EvaluationEvidence
  preset: PresetId
  evaluatedAt: string
  chainId: number
  agentId: number
}

export type EvaluateResponse = {
  evaluation: Evaluation
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build succeeds (types are not imported yet, just created)

- [ ] **Step 3: Commit**

```bash
git add src/types/evaluation.ts
git commit -m "feat: add evaluation types for trust evaluation agent v0"
```

---

## Task 2: Preset Configurations

**Files:**
- Create: `src/lib/evaluation/presets.ts`
- Create: `src/lib/evaluation/__tests__/presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/evaluation/__tests__/presets.test.ts
import { describe, it, expect } from 'vitest'
import { getPreset, PRESETS, isValidPreset } from '@/lib/evaluation/presets'

describe('presets', () => {
  it('returns default_safety preset', () => {
    const preset = getPreset('default_safety')
    expect(preset.id).toBe('default_safety')
    expect(preset.minFeedbacks).toBe(3)
    expect(preset.trustBand.high).toBe(60)
  })

  it('returns agent_to_agent preset', () => {
    const preset = getPreset('agent_to_agent')
    expect(preset.id).toBe('agent_to_agent')
    expect(preset.minFeedbacks).toBe(5)
    expect(preset.sybilWeight).toBe('elevated')
  })

  it('returns defi_counterparty preset', () => {
    const preset = getPreset('defi_counterparty')
    expect(preset.id).toBe('defi_counterparty')
    expect(preset.minFeedbacks).toBe(10)
    expect(preset.incidentTolerance).toBe(0)
    expect(preset.trustBand.high).toBe(75)
  })

  it('defi_counterparty is stricter than default_safety', () => {
    const safe = getPreset('default_safety')
    const defi = getPreset('defi_counterparty')
    expect(defi.minFeedbacks).toBeGreaterThan(safe.minFeedbacks)
    expect(defi.allowThreshold).toBeGreaterThan(safe.allowThreshold)
    expect(defi.staleDays).toBeLessThan(safe.staleDays)
  })

  it('validates known preset IDs', () => {
    expect(isValidPreset('default_safety')).toBe(true)
    expect(isValidPreset('agent_to_agent')).toBe(true)
    expect(isValidPreset('defi_counterparty')).toBe(true)
    expect(isValidPreset('unknown')).toBe(false)
  })

  it('all presets have consistent threshold ordering', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(preset.trustBand.high).toBeGreaterThan(preset.trustBand.medium)
      expect(preset.trustBand.medium).toBeGreaterThan(preset.trustBand.low)
      expect(preset.allowThreshold).toBeGreaterThanOrEqual(preset.reviewThreshold)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/presets.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement presets**

```ts
// src/lib/evaluation/presets.ts
import type { PresetConfig, PresetId } from '@/types/evaluation'

export const PRESETS: Record<PresetId, PresetConfig> = {
  default_safety: {
    id: 'default_safety',
    label: 'Default Safety',
    description: 'General safety evaluation for basic interaction gating',
    trustBand: { high: 60, medium: 35, low: 15 },
    minFeedbacks: 3,
    minConfidence: 'low',
    sybilWeight: 'normal',
    incidentTolerance: 2,
    allowThreshold: 60,
    reviewThreshold: 35,
    staleDays: 30,
    dormantDays: 90,
  },
  agent_to_agent: {
    id: 'agent_to_agent',
    label: 'Agent-to-Agent',
    description: 'Evaluation for inter-agent interactions with elevated sybil sensitivity',
    trustBand: { high: 65, medium: 40, low: 20 },
    minFeedbacks: 5,
    minConfidence: 'medium',
    sybilWeight: 'elevated',
    incidentTolerance: 1,
    allowThreshold: 65,
    reviewThreshold: 40,
    staleDays: 14,
    dormantDays: 45,
  },
  defi_counterparty: {
    id: 'defi_counterparty',
    label: 'DeFi Counterparty',
    description: 'Strict evaluation for financial contexts demanding strong proof',
    trustBand: { high: 75, medium: 55, low: 30 },
    minFeedbacks: 10,
    minConfidence: 'high',
    sybilWeight: 'critical',
    incidentTolerance: 0,
    allowThreshold: 75,
    reviewThreshold: 55,
    staleDays: 7,
    dormantDays: 21,
  },
}

export function getPreset(id: PresetId): PresetConfig {
  return PRESETS[id]
}

export function isValidPreset(id: string): id is PresetId {
  return id in PRESETS
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/presets.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluation/presets.ts src/lib/evaluation/__tests__/presets.test.ts
git commit -m "feat: add 3 evaluation preset configurations"
```

---

## Task 3: Evidence Gathering

**Files:**
- Create: `src/lib/evaluation/gather.ts`

- [ ] **Step 1: Implement evidence gathering**

This function queries Supabase for trust score, incidents, and agent data in parallel and returns a `GatheredEvidence` object. It uses the `supabaseAdmin` client (same as the score endpoint).

```ts
// src/lib/evaluation/gather.ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import { toTrustScore } from '@/types/trust-score'
import type { GatheredEvidence } from '@/types/evaluation'

export async function gatherEvidence(
  chainId: number,
  agentId: number,
): Promise<GatheredEvidence> {
  const [scoreResult, incidentResult, agentResult] = await Promise.all([
    supabaseAdmin
      .from('trust_scores')
      .select('*')
      .eq('chain_id', chainId)
      .eq('agent_id', agentId)
      .maybeSingle(),
    supabaseAdmin
      .from('incidents')
      .select('severity, signal_kind, resolved_at')
      .eq('chain_id', chainId)
      .eq('agent_id', agentId),
    supabaseAdmin
      .from('agents')
      .select('id, first_seen, last_seen')
      .eq('chain_id', chainId)
      .eq('agent_id', agentId)
      .maybeSingle(),
  ])

  if (!agentResult.data) {
    return {
      score: 0,
      scoreConfidence: 'low',
      positiveRatio: 0,
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      openIncidents: 0,
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
      resolvedSybilCount: 0,
      ageDays: 0,
      lastActivityDays: Infinity,
      agentExists: false,
    }
  }

  const score = scoreResult.data ? toTrustScore(scoreResult.data) : null
  const incidents = incidentResult.data ?? []

  const openIncidents = incidents.filter((i) => !i.resolved_at)
  const openCritical = openIncidents.filter((i) => i.severity === 'critical').length
  const openWarning = openIncidents.filter((i) => i.severity === 'warning').length
  const hasSybilIncident = openIncidents.some((i) => i.signal_kind === 'sybil_cluster')
  const resolvedSybilCount = incidents.filter(
    (i) => i.signal_kind === 'sybil_cluster' && i.resolved_at,
  ).length

  const now = Date.now()
  const firstSeen = agentResult.data.first_seen as string | null
  const lastSeen = agentResult.data.last_seen as string | null
  const ageDays = firstSeen
    ? Math.floor((now - new Date(firstSeen).getTime()) / 86_400_000)
    : 0
  const lastActivityDays = lastSeen
    ? Math.floor((now - new Date(lastSeen).getTime()) / 86_400_000)
    : Infinity

  return {
    score: score?.score ?? 0,
    scoreConfidence: score?.confidence ?? 'low',
    positiveRatio: score?.positiveRatio ?? 0,
    feedbackCount: score?.feedbackCount ?? 0,
    positiveCount: score?.positiveCount ?? 0,
    negativeCount: score?.negativeCount ?? 0,
    openIncidents: openIncidents.length,
    openCriticalIncidents: openCritical,
    openWarningIncidents: openWarning,
    hasSybilIncident,
    resolvedSybilCount,
    ageDays,
    lastActivityDays,
    agentExists: true,
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/evaluation/gather.ts
git commit -m "feat: add evidence gathering for evaluation composer"
```

---

## Task 4: Preset Interpretation Logic

**Files:**
- Create: `src/lib/evaluation/interpret.ts`
- Create: `src/lib/evaluation/__tests__/interpret.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/evaluation/__tests__/interpret.test.ts
import { describe, it, expect } from 'vitest'
import { interpretEvidence } from '@/lib/evaluation/interpret'
import { getPreset } from '@/lib/evaluation/presets'
import type { GatheredEvidence } from '@/types/evaluation'

function makeEvidence(overrides: Partial<GatheredEvidence> = {}): GatheredEvidence {
  return {
    score: 78,
    scoreConfidence: 'high',
    positiveRatio: 0.88,
    feedbackCount: 42,
    positiveCount: 37,
    negativeCount: 5,
    openIncidents: 0,
    openCriticalIncidents: 0,
    openWarningIncidents: 0,
    hasSybilIncident: false,
    resolvedSybilCount: 0,
    ageDays: 120,
    lastActivityDays: 3,
    agentExists: true,
    ...overrides,
  }
}

describe('interpretEvidence', () => {
  // --- trust_band ---
  describe('trust_band', () => {
    it('returns high for score above high threshold', () => {
      const result = interpretEvidence(makeEvidence({ score: 78 }), getPreset('default_safety'))
      expect(result.trust_band).toBe('high')
    })

    it('returns medium for score between medium and high', () => {
      const result = interpretEvidence(makeEvidence({ score: 45 }), getPreset('default_safety'))
      expect(result.trust_band).toBe('medium')
    })

    it('returns low for score between low and medium', () => {
      const result = interpretEvidence(makeEvidence({ score: 20 }), getPreset('default_safety'))
      expect(result.trust_band).toBe('low')
    })

    it('returns insufficient_signal when below minFeedbacks', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 2, score: 50 }),
        getPreset('default_safety'),
      )
      expect(result.trust_band).toBe('insufficient_signal')
    })
  })

  // --- status ---
  describe('status', () => {
    it('returns active when recent activity', () => {
      const result = interpretEvidence(makeEvidence({ lastActivityDays: 3 }), getPreset('default_safety'))
      expect(result.status).toBe('active')
    })

    it('returns stale when past staleDays', () => {
      const result = interpretEvidence(makeEvidence({ lastActivityDays: 35 }), getPreset('default_safety'))
      expect(result.status).toBe('stale')
    })

    it('returns dormant when past dormantDays', () => {
      const result = interpretEvidence(makeEvidence({ lastActivityDays: 100 }), getPreset('default_safety'))
      expect(result.status).toBe('dormant')
    })

    it('returns anomalous when critical incidents exist', () => {
      const result = interpretEvidence(
        makeEvidence({ openCriticalIncidents: 1, lastActivityDays: 1 }),
        getPreset('default_safety'),
      )
      expect(result.status).toBe('anomalous')
    })
  })

  // --- signal_strength ---
  describe('signal_strength', () => {
    it('returns strong for 20+ feedbacks with high confidence', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 25, scoreConfidence: 'high' }),
        getPreset('default_safety'),
      )
      expect(result.signal_strength).toBe('strong')
    })

    it('returns none when below minFeedbacks', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 1, scoreConfidence: 'low' }),
        getPreset('default_safety'),
      )
      expect(result.signal_strength).toBe('none')
    })
  })

  // --- recommended_action precedence ---
  describe('recommended_action', () => {
    it('hard gate: insufficient signal → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 2, score: 80 }),
        getPreset('default_safety'),
      )
      expect(result.recommended_action).toBe('limit')
    })

    it('hard gate: sybil critical + high risk → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ hasSybilIncident: true }),
        getPreset('defi_counterparty'),
      )
      expect(result.recommended_action).toBe('limit')
    })

    it('hard gate: defi_counterparty with any open incident → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ openCriticalIncidents: 1, score: 80 }),
        getPreset('defi_counterparty'),
      )
      expect(result.recommended_action).toBe('limit')
    })

    it('preset threshold: high score → allow', () => {
      const result = interpretEvidence(makeEvidence({ score: 78 }), getPreset('default_safety'))
      expect(result.recommended_action).toBe('allow')
    })

    it('preset threshold: mid score → review', () => {
      const result = interpretEvidence(makeEvidence({ score: 45 }), getPreset('default_safety'))
      expect(result.recommended_action).toBe('review')
    })

    it('preset threshold: low score → limit', () => {
      const result = interpretEvidence(makeEvidence({ score: 10 }), getPreset('default_safety'))
      expect(result.recommended_action).toBe('limit')
    })

    it('freshness modifier: dormant downgrades allow → review', () => {
      const result = interpretEvidence(
        makeEvidence({ score: 78, lastActivityDays: 100 }),
        getPreset('default_safety'),
      )
      expect(result.recommended_action).toBe('review')
    })

    it('freshness modifier: anomalous downgrades review → limit', () => {
      const result = interpretEvidence(
        makeEvidence({ score: 45, openCriticalIncidents: 1, lastActivityDays: 1 }),
        getPreset('default_safety'),
      )
      expect(result.recommended_action).toBe('limit')
    })
  })

  // --- decision_confidence ---
  describe('decision_confidence', () => {
    it('high when strong signal and consistent indicators', () => {
      const result = interpretEvidence(makeEvidence(), getPreset('default_safety'))
      expect(result.decision_confidence).toBe('high')
    })

    it('low when insufficient signal', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 1 }),
        getPreset('default_safety'),
      )
      expect(result.decision_confidence).toBe('low')
    })
  })

  // --- flags ---
  describe('flags', () => {
    it('flags insufficient_signal', () => {
      const result = interpretEvidence(
        makeEvidence({ feedbackCount: 1 }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('insufficient_signal')
    })

    it('flags sybil_risk_high', () => {
      const result = interpretEvidence(
        makeEvidence({ hasSybilIncident: true }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('sybil_risk_high')
    })

    it('flags dormant', () => {
      const result = interpretEvidence(
        makeEvidence({ lastActivityDays: 100 }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('dormant')
    })

    it('flags newly_registered', () => {
      const result = interpretEvidence(
        makeEvidence({ ageDays: 3 }),
        getPreset('default_safety'),
      )
      expect(result.flags).toContain('newly_registered')
    })

    it('no flags for clean agent', () => {
      const result = interpretEvidence(makeEvidence(), getPreset('default_safety'))
      expect(result.flags).toEqual([])
    })
  })

  // --- preset differentiation ---
  describe('presets produce different outputs', () => {
    it('same agent gets allow in default_safety but review in defi_counterparty', () => {
      const evidence = makeEvidence({ score: 65, feedbackCount: 12 })
      const safe = interpretEvidence(evidence, getPreset('default_safety'))
      const defi = interpretEvidence(evidence, getPreset('defi_counterparty'))
      // default_safety: 65 >= allowThreshold 60 → allow
      // defi_counterparty: 65 < allowThreshold 75 but >= reviewThreshold 55 → review
      expect(safe.recommended_action).toBe('allow')
      expect(defi.recommended_action).toBe('review')
    })

    it('defi_counterparty requires higher score for high trust_band', () => {
      const evidence = makeEvidence({ score: 65, feedbackCount: 15 })
      const safe = interpretEvidence(evidence, getPreset('default_safety'))
      const defi = interpretEvidence(evidence, getPreset('defi_counterparty'))
      expect(safe.trust_band).toBe('high')
      expect(defi.trust_band).toBe('medium')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/interpret.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement interpretation logic**

```ts
// src/lib/evaluation/interpret.ts
import type {
  GatheredEvidence,
  PresetConfig,
  InterpretationResult,
  TrustBand,
  EvalStatus,
  SignalStrength,
  RiskLevel,
  DecisionConfidence,
  RecommendedAction,
} from '@/types/evaluation'

const CONFIDENCE_ORDER = { low: 0, medium: 1, high: 2 } as const

export function interpretEvidence(
  evidence: GatheredEvidence,
  preset: PresetConfig,
): InterpretationResult {
  const flags = collectFlags(evidence, preset)
  const insufficientSignal = evidence.feedbackCount < preset.minFeedbacks

  const trust_band = deriveTrustBand(evidence, preset, insufficientSignal)
  const status = deriveStatus(evidence, preset)
  const signal_strength = deriveSignalStrength(evidence, preset)
  const risk_level = deriveRiskLevel(evidence, preset)
  const recommended_action = deriveAction(evidence, preset, status, insufficientSignal)
  const decision_confidence = deriveDecisionConfidence(signal_strength, flags, status)

  return {
    trust_band,
    status,
    signal_strength,
    risk_level,
    decision_confidence,
    recommended_action,
    flags,
  }
}

function deriveTrustBand(
  evidence: GatheredEvidence,
  preset: PresetConfig,
  insufficientSignal: boolean,
): TrustBand {
  if (insufficientSignal) return 'insufficient_signal'
  if (evidence.score >= preset.trustBand.high) return 'high'
  if (evidence.score >= preset.trustBand.medium) return 'medium'
  return 'low'
}

function deriveStatus(evidence: GatheredEvidence, preset: PresetConfig): EvalStatus {
  // Anomalous takes precedence — driven by severe incidents, not just inactivity
  if (evidence.openCriticalIncidents > 0) return 'anomalous'
  if (evidence.hasSybilIncident) return 'anomalous'
  if (evidence.lastActivityDays >= preset.dormantDays) return 'dormant'
  if (evidence.lastActivityDays >= preset.staleDays) return 'stale'
  return 'active'
}

function deriveSignalStrength(
  evidence: GatheredEvidence,
  preset: PresetConfig,
): SignalStrength {
  if (evidence.feedbackCount < preset.minFeedbacks) return 'none'
  if (evidence.feedbackCount >= 20 && evidence.scoreConfidence === 'high') return 'strong'
  if (CONFIDENCE_ORDER[evidence.scoreConfidence] >= CONFIDENCE_ORDER[preset.minConfidence]) return 'moderate'
  return 'weak'
}

function deriveRiskLevel(evidence: GatheredEvidence, preset: PresetConfig): RiskLevel {
  // Critical: hard risk signals
  if (evidence.hasSybilIncident && preset.sybilWeight === 'critical') return 'critical'
  if (evidence.openCriticalIncidents > 0) return 'critical'

  // Elevated: risk indicators exceed tolerance
  if (evidence.hasSybilIncident) return 'elevated'
  if (evidence.openIncidents > preset.incidentTolerance) return 'elevated'

  // Moderate: some risk present
  if (evidence.openIncidents > 0) return 'moderate'
  if (evidence.resolvedSybilCount > 0) return 'moderate'

  return 'minimal'
}

function deriveAction(
  evidence: GatheredEvidence,
  preset: PresetConfig,
  status: EvalStatus,
  insufficientSignal: boolean,
): RecommendedAction {
  // 1. HARD GATES
  if (insufficientSignal) return 'limit'
  if (preset.sybilWeight === 'critical' && evidence.hasSybilIncident) return 'limit'
  if (preset.incidentTolerance === 0 && evidence.openCriticalIncidents > 0) return 'limit'

  // Non-defi: critical incidents → review (not limit)
  if (evidence.openCriticalIncidents > 0 && preset.incidentTolerance > 0) {
    // Will be handled by freshness modifier below via anomalous status
  }

  // 2. PRESET THRESHOLDS
  let action: RecommendedAction
  if (evidence.score >= preset.allowThreshold) action = 'allow'
  else if (evidence.score >= preset.reviewThreshold) action = 'review'
  else action = 'limit'

  // 3. FRESHNESS MODIFIERS (can only downgrade)
  if (status === 'dormant' && action === 'allow') action = 'review'
  if (status === 'anomalous') {
    if (action === 'allow') action = 'review'
    else if (action === 'review') action = 'limit'
  }

  return action
}

function deriveDecisionConfidence(
  signal_strength: SignalStrength,
  flags: string[],
  status: EvalStatus,
): DecisionConfidence {
  if (signal_strength === 'none') return 'low'

  // Count conflicting indicators
  const conflictingFlags = flags.filter((f) =>
    f === 'sybil_risk_high' ||
    f === 'incident_open_critical' ||
    f === 'reputation_declining'
  )

  if (status === 'anomalous' && signal_strength === 'weak') return 'low'
  if (conflictingFlags.length >= 2) return 'low'

  if (signal_strength === 'weak') return 'medium'
  if (conflictingFlags.length === 1) return 'medium'

  return 'high'
}

function collectFlags(evidence: GatheredEvidence, preset: PresetConfig): string[] {
  const flags: string[] = []

  if (evidence.feedbackCount < preset.minFeedbacks) flags.push('insufficient_signal')
  if (evidence.hasSybilIncident) flags.push('sybil_risk_high')
  if (!evidence.hasSybilIncident && evidence.resolvedSybilCount > 0) flags.push('sybil_risk_resolved')
  if (evidence.openCriticalIncidents > 0) flags.push('incident_open_critical')
  if (evidence.openWarningIncidents > 0) flags.push('incident_open_warning')
  if (evidence.lastActivityDays >= preset.dormantDays) flags.push('dormant')
  else if (evidence.lastActivityDays >= preset.staleDays) flags.push('no_recent_activity')
  if (evidence.ageDays < 7) flags.push('newly_registered')

  return flags
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/interpret.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Fix any failing tests and iterate**

Review test output. If the preset differentiation test for `defi_counterparty` with `score: 65, feedbackCount: 12` returns unexpected results, adjust the test expectation to match the actual precedence logic (12 > minFeedbacks of 10, so it won't hit insufficient_signal gate; score 65 < allowThreshold 75 → `review` not `allow`). Update the test assertion if needed:

The first differentiation test should expect:
- `default_safety`: score 65 >= allowThreshold 60 → `allow`
- `defi_counterparty`: score 65 < allowThreshold 75 → `review`

If the test says `limit`, it means the hard gate fired. Verify feedbackCount 12 > minFeedbacks 10 — should pass the gate. Expected: `review`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/evaluation/interpret.ts src/lib/evaluation/__tests__/interpret.test.ts
git commit -m "feat: add evaluation interpretation logic with 3 presets"
```

---

## Task 5: Rationale Generation

**Files:**
- Create: `src/lib/evaluation/rationale.ts`
- Create: `src/lib/evaluation/__tests__/rationale.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/evaluation/__tests__/rationale.test.ts
import { describe, it, expect } from 'vitest'
import { generateRationale } from '@/lib/evaluation/rationale'
import type { GatheredEvidence, InterpretationResult } from '@/types/evaluation'

function makeEvidence(overrides: Partial<GatheredEvidence> = {}): GatheredEvidence {
  return {
    score: 78, scoreConfidence: 'high', positiveRatio: 0.88,
    feedbackCount: 42, positiveCount: 37, negativeCount: 5,
    openIncidents: 0, openCriticalIncidents: 0, openWarningIncidents: 0,
    hasSybilIncident: false, resolvedSybilCount: 0,
    ageDays: 120, lastActivityDays: 3, agentExists: true,
    ...overrides,
  }
}

function makeInterpretation(overrides: Partial<InterpretationResult> = {}): InterpretationResult {
  return {
    trust_band: 'high', status: 'active', signal_strength: 'strong',
    risk_level: 'minimal', decision_confidence: 'high',
    recommended_action: 'allow', flags: [],
    ...overrides,
  }
}

describe('generateRationale', () => {
  it('generates rationale for high-trust agent', () => {
    const rationale = generateRationale(makeEvidence(), makeInterpretation())
    expect(rationale).toContain('78/100')
    expect(rationale).toContain('42 feedbacks')
    expect(rationale).toContain('88%')
    expect(rationale).toContain('allow')
  })

  it('generates rationale for insufficient signal', () => {
    const rationale = generateRationale(
      makeEvidence({ feedbackCount: 2 }),
      makeInterpretation({
        trust_band: 'insufficient_signal',
        recommended_action: 'limit',
        flags: ['insufficient_signal'],
      }),
    )
    expect(rationale).toContain('insufficient')
    expect(rationale).toContain('limit')
  })

  it('mentions open incidents when present', () => {
    const rationale = generateRationale(
      makeEvidence({ openIncidents: 2, openCriticalIncidents: 1 }),
      makeInterpretation({ risk_level: 'critical', flags: ['incident_open_critical'] }),
    )
    expect(rationale).toContain('incident')
  })

  it('mentions dormant status', () => {
    const rationale = generateRationale(
      makeEvidence({ lastActivityDays: 100 }),
      makeInterpretation({ status: 'dormant', flags: ['dormant'] }),
    )
    expect(rationale).toContain('dormant')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/rationale.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement rationale generator**

```ts
// src/lib/evaluation/rationale.ts
import type { GatheredEvidence, InterpretationResult } from '@/types/evaluation'

export function generateRationale(
  evidence: GatheredEvidence,
  interpretation: InterpretationResult,
): string {
  const parts: string[] = []

  // Score summary
  if (interpretation.trust_band === 'insufficient_signal') {
    parts.push(
      `Agent has only ${evidence.feedbackCount} feedback(s) — insufficient signal for evaluation.`,
    )
  } else {
    const pct = Math.round(evidence.positiveRatio * 100)
    parts.push(
      `Agent scores ${evidence.score}/100 with ${evidence.scoreConfidence} confidence (${evidence.feedbackCount} feedbacks, ${pct}% positive).`,
    )
  }

  // Incidents
  if (evidence.openIncidents > 0) {
    const critical = evidence.openCriticalIncidents
    const warning = evidence.openWarningIncidents
    const details = [
      critical > 0 ? `${critical} critical` : '',
      warning > 0 ? `${warning} warning` : '',
    ].filter(Boolean).join(', ')
    parts.push(`${evidence.openIncidents} open incident(s) (${details}).`)
  } else {
    parts.push('No open incidents.')
  }

  // Sybil
  if (evidence.hasSybilIncident) {
    parts.push('Active sybil cluster detected.')
  }

  // Status
  if (interpretation.status === 'dormant') {
    parts.push(`Dormant — no activity in ${evidence.lastActivityDays} days.`)
  } else if (interpretation.status === 'stale') {
    parts.push(`Stale — last activity ${evidence.lastActivityDays} days ago.`)
  } else if (interpretation.status === 'anomalous') {
    parts.push('Status anomalous due to severe incidents.')
  } else {
    parts.push(`Active within last ${evidence.lastActivityDays} day(s).`)
  }

  // Action
  parts.push(`Recommended action: ${interpretation.recommended_action}.`)

  return parts.join(' ')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/rationale.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluation/rationale.ts src/lib/evaluation/__tests__/rationale.test.ts
git commit -m "feat: add template-based rationale generation"
```

---

## Task 6: Evaluation Composer

**Files:**
- Create: `src/lib/evaluation/compose.ts`
- Create: `src/lib/evaluation/__tests__/compose.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/evaluation/__tests__/compose.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { GatheredEvidence, PresetId } from '@/types/evaluation'

// Mock gatherEvidence — it hits Supabase
vi.mock('@/lib/evaluation/gather', () => ({
  gatherEvidence: vi.fn(),
}))

import { composeEvaluation } from '@/lib/evaluation/compose'
import { gatherEvidence } from '@/lib/evaluation/gather'

const mockGather = vi.mocked(gatherEvidence)

function makeEvidence(overrides: Partial<GatheredEvidence> = {}): GatheredEvidence {
  return {
    score: 78, scoreConfidence: 'high', positiveRatio: 0.88,
    feedbackCount: 42, positiveCount: 37, negativeCount: 5,
    openIncidents: 0, openCriticalIncidents: 0, openWarningIncidents: 0,
    hasSybilIncident: false, resolvedSybilCount: 0,
    ageDays: 120, lastActivityDays: 3, agentExists: true,
    ...overrides,
  }
}

describe('composeEvaluation', () => {
  it('returns full evaluation for healthy agent', async () => {
    mockGather.mockResolvedValue(makeEvidence())
    const result = await composeEvaluation({
      chainId: 42220, agentId: 5, preset: 'default_safety',
    })
    expect(result.evaluation.trust_band).toBe('high')
    expect(result.evaluation.recommended_action).toBe('allow')
    expect(result.evaluation.preset).toBe('default_safety')
    expect(result.evaluation.chainId).toBe(42220)
    expect(result.evaluation.agentId).toBe(5)
    expect(result.evaluation.rationale).toBeTruthy()
    expect(result.evaluation.evidence.score).toBe(78)
    expect(result.evaluation.evaluatedAt).toBeTruthy()
  })

  it('returns not-found error for non-existent agent', async () => {
    mockGather.mockResolvedValue(makeEvidence({ agentExists: false }))
    await expect(
      composeEvaluation({ chainId: 42220, agentId: 999, preset: 'default_safety' }),
    ).rejects.toThrow('Agent not found')
  })

  it('defi_counterparty is stricter than default_safety for same evidence', async () => {
    const evidence = makeEvidence({ score: 65, feedbackCount: 15 })
    mockGather.mockResolvedValue(evidence)

    const safe = await composeEvaluation({ chainId: 42220, agentId: 5, preset: 'default_safety' })
    const defi = await composeEvaluation({ chainId: 42220, agentId: 5, preset: 'defi_counterparty' })

    expect(safe.evaluation.trust_band).toBe('high')
    expect(defi.evaluation.trust_band).toBe('medium')
  })

  it('includes correct evidence summary', async () => {
    mockGather.mockResolvedValue(makeEvidence())
    const result = await composeEvaluation({
      chainId: 42220, agentId: 5, preset: 'default_safety',
    })
    expect(result.evaluation.evidence).toEqual({
      score: 78,
      score_confidence: 'high',
      feedbackCount: 42,
      positiveRatio: 0.88,
      openIncidents: 0,
      lastActivityDays: 3,
      ageDays: 120,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/compose.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement composer**

```ts
// src/lib/evaluation/compose.ts
import type { EvaluateRequest, EvaluateResponse } from '@/types/evaluation'
import { getPreset } from './presets'
import { gatherEvidence } from './gather'
import { interpretEvidence } from './interpret'
import { generateRationale } from './rationale'

export async function composeEvaluation(
  request: EvaluateRequest,
): Promise<EvaluateResponse> {
  const { chainId, agentId, preset: presetId } = request
  const preset = getPreset(presetId)

  const evidence = await gatherEvidence(chainId, agentId)
  if (!evidence.agentExists) {
    throw new Error('Agent not found')
  }

  const interpretation = interpretEvidence(evidence, preset)
  const rationale = generateRationale(evidence, interpretation)

  return {
    evaluation: {
      ...interpretation,
      rationale,
      evidence: {
        score: evidence.score,
        score_confidence: evidence.scoreConfidence,
        feedbackCount: evidence.feedbackCount,
        positiveRatio: evidence.positiveRatio,
        openIncidents: evidence.openIncidents,
        lastActivityDays: evidence.lastActivityDays,
        ageDays: evidence.ageDays,
      },
      preset: presetId,
      evaluatedAt: new Date().toISOString(),
      chainId,
      agentId,
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/__tests__/compose.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Run all evaluation tests together**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test src/lib/evaluation/`
Expected: All tests across presets, interpret, rationale, and compose PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/evaluation/compose.ts src/lib/evaluation/__tests__/compose.test.ts
git commit -m "feat: add evaluation composer orchestrating gather → interpret → rationale"
```

---

## Task 7: API Endpoint

**Files:**
- Create: `src/app/api/v1/trust/evaluate/route.ts`

- [ ] **Step 1: Implement the POST endpoint**

```ts
// src/app/api/v1/trust/evaluate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateHybrid, buildHybridHeaders } from '@/lib/x402/middleware'
import { recordX402Payment } from '@/lib/x402/payments'
import { composeEvaluation } from '@/lib/evaluation/compose'
import { isValidPreset } from '@/lib/evaluation/presets'
import type { PresetId } from '@/types/evaluation'

const ENDPOINT_PATH = '/api/v1/trust/evaluate'

export async function POST(req: NextRequest) {
  const auth = await authenticateHybrid(req.headers, {
    path: ENDPOINT_PATH,
    priceKey: 'evaluate',
    description: 'Contextual trust evaluation for ERC-8004 agent',
  })
  if (!auth.ok) return auth.error

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const chainId = Number(body.chainId)
  const agentId = Number(body.agentId)
  const preset = body.preset as string

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'chainId and agentId are required' }, { status: 400 })
  }

  if (!preset || !isValidPreset(preset)) {
    return NextResponse.json(
      { error: `Invalid preset. Available: default_safety, agent_to_agent, defi_counterparty` },
      { status: 400 },
    )
  }

  try {
    const result = await composeEvaluation({
      chainId,
      agentId,
      preset: preset as PresetId,
      context: body.context as string | undefined,
      sensitivity: body.sensitivity as 'low' | 'normal' | 'high' | undefined,
      objective: body.objective as string | undefined,
    })

    // Record x402 payment (fire-and-forget)
    if (auth.method === 'x402') {
      recordX402Payment({
        chainId,
        agentId,
        endpoint: ENDPOINT_PATH,
        x402: auth.x402,
        priceKey: 'evaluate',
      })
    }

    return NextResponse.json(result, { headers: buildHybridHeaders(auth) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Agent not found') {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    throw error
  }
}
```

- [ ] **Step 2: Add evaluate pricing to x402 config**

Read `src/lib/x402/config.ts` and add the `evaluate` price key to the pricing object. It should be priced the same as `score` ($0.001) since it composes score + signals:

Add `evaluate: 0.001` to the `pricing` record in the config.

- [ ] **Step 3: Verify build passes**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test`
Expected: All existing tests + new evaluation tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/trust/evaluate/route.ts src/lib/x402/config.ts
git commit -m "feat: add POST /api/v1/trust/evaluate endpoint with hybrid auth"
```

---

## Task 8: SDK evaluate() Method

**Files:**
- Modify: `trust-sdk/packages/trust-client-core/src/types.ts`
- Modify: `trust-sdk/packages/trust-client-core/src/client.ts`
- Create: `trust-sdk/packages/trust-client-core/src/__tests__/evaluate.test.ts`

- [ ] **Step 1: Add evaluation types to trust-client-core/src/types.ts**

Append these types at the end of the file (before the x402 wire types section):

```ts
// --- Evaluation Types ---

export type EvaluatePreset = 'default_safety' | 'agent_to_agent' | 'defi_counterparty'

export interface EvaluateOptions {
  preset: EvaluatePreset
  context?: string
  sensitivity?: 'low' | 'normal' | 'high'
  objective?: string
}

export interface EvaluationEvidence {
  score: number
  score_confidence: 'low' | 'medium' | 'high'
  feedbackCount: number
  positiveRatio: number
  openIncidents: number
  lastActivityDays: number
  ageDays: number
}

export interface Evaluation {
  trust_band: 'high' | 'medium' | 'low' | 'insufficient_signal'
  status: 'active' | 'stale' | 'dormant' | 'anomalous'
  signal_strength: 'strong' | 'moderate' | 'weak' | 'none'
  risk_level: 'minimal' | 'moderate' | 'elevated' | 'critical'
  decision_confidence: 'low' | 'medium' | 'high'
  recommended_action: 'allow' | 'review' | 'limit'
  flags: string[]
  rationale: string
  evidence: EvaluationEvidence
  preset: string
  evaluatedAt: string
  chainId: number
  agentId: number
}

export interface EvaluateResponse {
  evaluation: Evaluation
}
```

- [ ] **Step 2: Add evaluate() method to TrustClient**

Add this method to the `TrustClient` class in `trust-sdk/packages/trust-client-core/src/client.ts`, after the `search()` method:

```ts
  /** Evaluate agent trust with contextual preset (supports x402) */
  async evaluate(
    chainId: number,
    agentId: number,
    options: EvaluateOptions,
  ): Promise<EvaluateResponse> {
    return this.requestPost(`/trust/evaluate`, {
      chainId,
      agentId,
      preset: options.preset,
      ...(options.context ? { context: options.context } : {}),
      ...(options.sensitivity ? { sensitivity: options.sensitivity } : {}),
      ...(options.objective ? { objective: options.objective } : {}),
    })
  }
```

Also add a `requestPost` private method to the class (after the `request` method):

```ts
  private async requestPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${API_PREFIX}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (isApiKeyConfig(this.config)) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    const response = await this.fetchWithConfig(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // x402 retry for POST
    if (response.status === 402 && isX402Config(this.config)) {
      const paymentRequired = decodePaymentRequired(response)
      if (!paymentRequired.accepts.length) {
        throw new PaymentRequiredError('No accepted payment methods', paymentRequired)
      }

      const requirement = paymentRequired.accepts[0]
      const paymentHeader = await buildPaymentHeader(
        this.config,
        requirement,
        paymentRequired.resource,
      )

      const retryResponse = await this.fetchWithConfig(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PAYMENT': paymentHeader },
        body: JSON.stringify(body),
      })

      return this.handleResponse<T>(retryResponse)
    }

    return this.handleResponse<T>(response)
  }
```

Update `fetchWithConfig` to accept an extended init object:

```ts
  private async fetchWithConfig(
    url: string,
    init: { method?: string; headers: Record<string, string>; body?: string },
  ): Promise<Response> {
    const { signal, cleanup } = this.createRequestSignal()
    try {
      const requestInit: RequestInit = {
        method: init.method ?? 'GET',
        headers: init.headers,
      }
      if (init.body) requestInit.body = init.body
      if (signal) requestInit.signal = signal
      return await this.fetchImpl(url, requestInit)
    } finally {
      cleanup()
    }
  }
```

Add `EvaluateOptions` and `EvaluateResponse` to the imports from `./types` at the top of the file.

- [ ] **Step 3: Update index.ts exports**

Add to `trust-sdk/packages/trust-client-core/src/index.ts`:

```ts
export type {
  EvaluateOptions,
  EvaluatePreset,
  EvaluateResponse,
  Evaluation,
  EvaluationEvidence,
} from './types'
```

Also re-export from `trust-sdk/packages/trust-sdk/src/index.ts`:

```ts
export type {
  EvaluateOptions,
  EvaluatePreset,
  EvaluateResponse,
  Evaluation,
  EvaluationEvidence,
} from '@denlabs/trust-client-core'
```

- [ ] **Step 4: Write the test**

```ts
// trust-sdk/packages/trust-client-core/src/__tests__/evaluate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrustClient } from '../client'

const BASE_URL = 'https://test.example.com'

function createClient(apiKey = 'test_key') {
  const mockFetch = vi.fn()
  const client = new TrustClient({ apiKey, fetch: mockFetch }, BASE_URL)
  return { client, mockFetch }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const MOCK_EVALUATION = {
  evaluation: {
    trust_band: 'high',
    status: 'active',
    signal_strength: 'strong',
    risk_level: 'minimal',
    decision_confidence: 'high',
    recommended_action: 'allow',
    flags: [],
    rationale: 'Agent scores 78/100.',
    evidence: {
      score: 78,
      score_confidence: 'high',
      feedbackCount: 42,
      positiveRatio: 0.88,
      openIncidents: 0,
      lastActivityDays: 3,
      ageDays: 120,
    },
    preset: 'default_safety',
    evaluatedAt: '2026-03-29T18:30:00Z',
    chainId: 42220,
    agentId: 5,
  },
}

describe('TrustClient.evaluate', () => {
  it('sends POST to /api/v1/trust/evaluate', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_EVALUATION))

    const result = await client.evaluate(42220, 5, { preset: 'default_safety' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/v1/trust/evaluate`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      chainId: 42220,
      agentId: 5,
      preset: 'default_safety',
    })
    expect(result.evaluation.trust_band).toBe('high')
  })

  it('includes optional fields in body', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_EVALUATION))

    await client.evaluate(42220, 5, {
      preset: 'defi_counterparty',
      context: 'lending pool',
      sensitivity: 'high',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.preset).toBe('defi_counterparty')
    expect(body.context).toBe('lending pool')
    expect(body.sensitivity).toBe('high')
  })

  it('includes Authorization header', async () => {
    const { client, mockFetch } = createClient('my_key')
    mockFetch.mockResolvedValue(jsonResponse(MOCK_EVALUATION))

    await client.evaluate(42220, 5, { preset: 'default_safety' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer my_key')
  })

  it('throws on 404', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Agent not found' }, 404))

    await expect(
      client.evaluate(42220, 999, { preset: 'default_safety' }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk && pnpm test`
Expected: All tests pass (existing + new evaluate tests)

- [ ] **Step 6: Build SDK**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk && pnpm build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk
git add packages/trust-client-core/src/types.ts packages/trust-client-core/src/client.ts packages/trust-client-core/src/index.ts packages/trust-client-core/src/__tests__/evaluate.test.ts packages/trust-sdk/src/index.ts
git commit -m "feat: add evaluate() method to TrustClient + DenScope SDK"
```

---

## Task 9: MCP trust_evaluate Tool

**Files:**
- Modify: `trust-sdk/packages/mcp-server/src/index.ts`

- [ ] **Step 1: Add trust_evaluate tool definition**

In the `tools` array of the `ListToolsRequestSchema` handler, add after `trust_get_events`:

```ts
    {
      name: 'trust_evaluate',
      description: 'Evaluate the trustworthiness of an ERC-8004 agent using a contextual preset. Returns a structured judgment with trust band, risk level, recommended action, and human-readable rationale. Use this when you need to decide whether to interact with, delegate to, or transact with an agent.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          oracle: { type: 'string', description: 'Trust oracle: "denscope" (Celo, SKALE Base) or "ayni" (Avalanche)', enum: ['denscope', 'ayni'] },
          chain: { type: 'string', description: 'Chain name or ID (e.g. "celo", "skale-base", 42220)' },
          agentId: { type: 'number', description: 'Agent ID (numeric)' },
          preset: { type: 'string', description: 'Evaluation preset: "default_safety" (general), "agent_to_agent" (inter-agent), "defi_counterparty" (financial)', enum: ['default_safety', 'agent_to_agent', 'defi_counterparty'] },
          context: { type: 'string', description: 'Optional context hint (e.g. "lending pool interaction")' },
          apiKey: { type: 'string', description: 'API key (ds_xxx). Required.' },
        },
        required: ['oracle', 'chain', 'agentId', 'preset'],
      },
    },
```

- [ ] **Step 2: Add trust_evaluate handler**

In the `switch (name)` block of the `CallToolRequestSchema` handler, add before the `default` case:

```ts
      case 'trust_evaluate': {
        const chainId = resolveChainId(oracle, args?.chain as string)
        const agentId = args?.agentId as number
        const preset = (args?.preset as string) ?? 'default_safety'
        const context = args?.context as string | undefined
        const { evaluation } = await client.evaluate(chainId, agentId, {
          preset: preset as 'default_safety' | 'agent_to_agent' | 'defi_counterparty',
          context,
        })

        const actionEmoji = evaluation.recommended_action === 'allow' ? '✅'
          : evaluation.recommended_action === 'review' ? '⚠️' : '🚫'

        return {
          content: [{
            type: 'text',
            text: [
              `Trust Evaluation for Agent #${agentId} on ${oracle.name} (chain ${chainId}):`,
              ``,
              `  Preset: ${evaluation.preset}`,
              `  Trust Band: ${evaluation.trust_band}`,
              `  Status: ${evaluation.status}`,
              `  Signal Strength: ${evaluation.signal_strength}`,
              `  Risk Level: ${evaluation.risk_level}`,
              `  Confidence: ${evaluation.decision_confidence}`,
              `  ${actionEmoji} Action: ${evaluation.recommended_action}`,
              ``,
              `  Rationale: ${evaluation.rationale}`,
              ``,
              `  Evidence:`,
              `    Score: ${evaluation.evidence.score}/100 (${evaluation.evidence.score_confidence} confidence)`,
              `    Feedback: ${evaluation.evidence.feedbackCount} (${Math.round(evaluation.evidence.positiveRatio * 100)}% positive)`,
              `    Open Incidents: ${evaluation.evidence.openIncidents}`,
              `    Last Activity: ${evaluation.evidence.lastActivityDays}d ago`,
              `    Age: ${evaluation.evidence.ageDays}d`,
              evaluation.flags.length > 0 ? `\n  Flags: ${evaluation.flags.join(', ')}` : '',
            ].filter(Boolean).join('\n'),
          }],
        }
      }
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk
git add packages/mcp-server/src/index.ts
git commit -m "feat: add trust_evaluate MCP tool for AI assistants"
```

---

## Task 10: Full Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all DenScope tests**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test`
Expected: All tests pass (existing + ~30 new evaluation tests)

- [ ] **Step 2: Run DenScope build**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Run trust-sdk tests**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk && pnpm test`
Expected: All tests pass (existing + 4 new evaluate tests)

- [ ] **Step 4: Run trust-sdk build**

Run: `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk && pnpm build`
Expected: Build succeeds

- [ ] **Step 5: Verify test count summary**

Print final counts:
```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm test 2>&1 | tail -5
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/trust-sdk && pnpm test 2>&1 | tail -5
```

Report: total test count for both repos, all passing.
