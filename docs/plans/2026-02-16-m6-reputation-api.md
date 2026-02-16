# M6: Reputation API — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose agent trust scores as a public API so any dApp, protocol, or agent framework can query agent reputation in one HTTP call.

**Architecture:** Pre-compute trust scores in the Edge Function after event ingestion (scores materialize in a new `trust_scores` table). API routes under `/api/v1/` read pre-computed data. API keys stored in Supabase with per-key daily rate limiting. Console UI adds key management. Public docs page documents the formula + endpoints.

**Tech Stack:** Supabase (new tables: `trust_scores`, `api_keys`, `api_usage_log`), Next.js API routes, Edge Function extension, crypto (API key generation)

---

## Existing Codebase Context

**Database tables** (Supabase Postgres):
- `agents` — materialized agent state: `feedback_count`, `positive_count`, `negative_count`, `first_seen`, `last_seen`
- `scope_events` — raw on-chain events with `kind`, `data` (JSONB), `created_at`
- `incidents` — signal detections: `signal_kind`, `severity`, `resolved_at`
- `owner_profiles` — claimed agents: `wallet_address`, `chain_id`, `agent_id`
- `alert_rules`, `webhook_logs` — M5 webhook infra

**Edge Function** (`supabase/functions/erc8004-poller/index.ts`):
- Polls Forno RPCs every 1 min via pg_cron
- Ingests events → upserts `scope_events` + `agents` → detects signals → inserts incidents → dispatches webhooks
- ~443 lines (Deno runtime, uses ESM imports from `esm.sh`)

**Agent page** (`src/app/agent/[chain]/[id]/page.tsx`):
- Shows agent identity card + protocols + "Reputation" section (currently placeholder: "No feedback yet")
- SSR, fetches from chain via viem `readContract()` + Supabase REST API

**API patterns:**
- All routes use `NextRequest`/`NextResponse`
- Error format: `{ error: string }` with HTTP status
- Writes via `supabaseAdmin` (service_role), reads via anon key or admin
- Validation: check required fields upfront, return 400

**Test suite:** 79 tests, 19 files. Pattern: vitest, pure function tests, zustand store tests with `beforeEach` reset.

---

## Phase 1: Trust Score Engine

### Task 1: Database Migration — `trust_scores`, `api_keys`, `api_usage_log`

**Files:**
- Create: `supabase/migrations/20260216030000_m6_reputation_api.sql`

**Step 1: Write migration**

```sql
-- M6: Reputation API tables

-- Pre-computed trust scores (updated by Edge Function after each event)
CREATE TABLE trust_scores (
  id TEXT PRIMARY KEY,  -- 'chainId:agentId' (matches agents.id)
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,  -- 0-100
  positive_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,  -- 0.0000 to 1.0000
  activity_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  age_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  incident_penalty NUMERIC(5,4) NOT NULL DEFAULT 0,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  open_incidents INTEGER NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id)
);

CREATE INDEX idx_trust_scores_chain ON trust_scores (chain_id, agent_id);
CREATE INDEX idx_trust_scores_score ON trust_scores (score DESC);

-- API keys for external consumers
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  key_prefix TEXT NOT NULL,  -- first 8 chars for display (ds_xxxxxxxx...)
  key_hash TEXT UNIQUE NOT NULL,  -- SHA-256 of full key
  label TEXT NOT NULL DEFAULT 'default',
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  daily_limit INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_owner ON api_keys (owner_address);

-- API usage log (one row per day per key for rate counting)
CREATE TABLE api_usage_log (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (api_key_id, usage_date)
);

CREATE INDEX idx_api_usage_date ON api_usage_log (api_key_id, usage_date);

-- RLS policies
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trust_scores" ON trust_scores FOR SELECT USING (true);
CREATE POLICY "Service write trust_scores" ON trust_scores FOR INSERT WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);
CREATE POLICY "Service update trust_scores" ON trust_scores FOR UPDATE USING (
  (SELECT auth.role()) = 'service_role'
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read api_keys" ON api_keys FOR SELECT USING (true);
CREATE POLICY "Service write api_keys" ON api_keys FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manage api_usage_log" ON api_usage_log FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260216030000_m6_reputation_api.sql
git commit -m "feat(db): add trust_scores, api_keys, api_usage_log for M6"
```

---

### Task 2: Trust Score Types + Computation Logic

**Files:**
- Create: `src/types/trust-score.ts`
- Create: `src/lib/reputation/compute.ts`
- Create: `src/lib/reputation/__tests__/compute.test.ts`

**Step 1: Write the type definitions**

```typescript
// src/types/trust-score.ts

export type TrustConfidence = 'low' | 'medium' | 'high'

export type TrustScore = {
  chainId: number
  agentId: number
  score: number  // 0-100
  positiveRatio: number
  activityScore: number
  ageScore: number
  incidentPenalty: number
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  openIncidents: number
  confidence: TrustConfidence
  updatedAt: string
}

export type TrustScoreInput = {
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  firstSeen: string | null
  lastSeen: string | null
  openCriticalIncidents: number
  openWarningIncidents: number
  hasSybilIncident: boolean
}

export function toTrustScore(row: Record<string, unknown>): TrustScore {
  return {
    chainId: row.chain_id as number,
    agentId: row.agent_id as number,
    score: row.score as number,
    positiveRatio: Number(row.positive_ratio),
    activityScore: Number(row.activity_score),
    ageScore: Number(row.age_score),
    incidentPenalty: Number(row.incident_penalty),
    feedbackCount: row.feedback_count as number,
    positiveCount: row.positive_count as number,
    negativeCount: row.negative_count as number,
    openIncidents: row.open_incidents as number,
    confidence: row.confidence as TrustConfidence,
    updatedAt: row.updated_at as string,
  }
}
```

**Step 2: Write failing tests for compute logic**

```typescript
// src/lib/reputation/__tests__/compute.test.ts
import { describe, it, expect } from 'vitest'
import { computeTrustScore } from '@/lib/reputation/compute'

describe('computeTrustScore', () => {
  it('returns score 0 with low confidence for no feedback', () => {
    const result = computeTrustScore({
      feedbackCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      firstSeen: null,
      lastSeen: null,
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(result.score).toBe(0)
    expect(result.confidence).toBe('low')
  })

  it('returns high score for all-positive agent', () => {
    const result = computeTrustScore({
      feedbackCount: 20,
      positiveCount: 20,
      negativeCount: 0,
      firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.confidence).toBe('high')
  })

  it('penalizes negative feedback', () => {
    const good = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 10,
      negativeCount: 0,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    const bad = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 3,
      negativeCount: 7,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(good.score).toBeGreaterThan(bad.score)
  })

  it('penalizes open critical incidents', () => {
    const clean = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 8,
      negativeCount: 2,
      firstSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    const flagged = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 8,
      negativeCount: 2,
      firstSeen: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 2,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(clean.score).toBeGreaterThan(flagged.score)
  })

  it('applies sybil penalty', () => {
    const normal = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 9,
      negativeCount: 1,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    const sybil = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 9,
      negativeCount: 1,
      firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: true,
    })
    expect(normal.score).toBeGreaterThan(sybil.score)
  })

  it('returns medium confidence for 3-9 feedbacks', () => {
    const result = computeTrustScore({
      feedbackCount: 5,
      positiveCount: 4,
      negativeCount: 1,
      firstSeen: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(result.confidence).toBe('medium')
  })

  it('returns high confidence for 10+ feedbacks', () => {
    const result = computeTrustScore({
      feedbackCount: 15,
      positiveCount: 12,
      negativeCount: 3,
      firstSeen: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(result.confidence).toBe('high')
  })

  it('clamps score between 0 and 100', () => {
    const result = computeTrustScore({
      feedbackCount: 5,
      positiveCount: 0,
      negativeCount: 5,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 5,
      openWarningIncidents: 5,
      hasSybilIncident: true,
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('rewards agent age up to 90 days', () => {
    const young = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 10,
      negativeCount: 0,
      firstSeen: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    const old = computeTrustScore({
      feedbackCount: 10,
      positiveCount: 10,
      negativeCount: 0,
      firstSeen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date().toISOString(),
      openCriticalIncidents: 0,
      openWarningIncidents: 0,
      hasSybilIncident: false,
    })
    expect(old.score).toBeGreaterThan(young.score)
  })
})
```

**Step 3: Run tests to verify they fail**

Run: `pnpm test src/lib/reputation/__tests__/compute.test.ts`
Expected: FAIL — module not found

**Step 4: Write trust score computation**

```typescript
// src/lib/reputation/compute.ts
import type { TrustConfidence, TrustScoreInput } from '@/types/trust-score'

/**
 * Trust Score v1 Formula (transparent, documented)
 *
 * Components (0.0 - 1.0 each):
 *   positive_ratio (weight 0.40) — positive_count / feedback_count
 *   age_score      (weight 0.20) — days since first_seen / 90, capped at 1.0
 *   activity_score (weight 0.20) — feedback_count / (days_active * 2), capped at 1.0
 *   incident_pen.  (weight 0.10) — deducted: 0.15 per critical, 0.05 per warning
 *   sybil_penalty  (weight 0.10) — 1.0 if sybil detected, else 0.0
 *
 * score = (
 *   0.40 * positive_ratio
 * + 0.20 * age_score
 * + 0.20 * activity_score
 * - 0.10 * incident_penalty  (capped at 1.0)
 * - 0.10 * sybil_penalty
 * ) * 100
 *
 * Clamped to [0, 100], rounded to integer.
 *
 * Confidence levels:
 *   low    — 0 feedbacks
 *   medium — 1-9 feedbacks
 *   high   — 10+ feedbacks
 */

const WEIGHTS = {
  positiveRatio: 0.40,
  age: 0.20,
  activity: 0.20,
  incident: 0.10,
  sybil: 0.10,
} as const

const AGE_CAP_DAYS = 90
const ACTIVITY_DIVISOR = 2 // feedbacks per day to reach 1.0
const CRITICAL_PENALTY = 0.15
const WARNING_PENALTY = 0.05

export type ComputedScore = {
  score: number
  positiveRatio: number
  activityScore: number
  ageScore: number
  incidentPenalty: number
  confidence: TrustConfidence
}

export function computeTrustScore(input: TrustScoreInput): ComputedScore {
  const {
    feedbackCount,
    positiveCount,
    firstSeen,
    lastSeen,
    openCriticalIncidents,
    openWarningIncidents,
    hasSybilIncident,
  } = input

  // No data → zero score
  if (feedbackCount === 0) {
    return {
      score: 0,
      positiveRatio: 0,
      activityScore: 0,
      ageScore: 0,
      incidentPenalty: 0,
      confidence: 'low',
    }
  }

  // Component 1: Positive feedback ratio (0.0 - 1.0)
  const positiveRatio = positiveCount / feedbackCount

  // Component 2: Agent age score (0.0 - 1.0)
  let ageScore = 0
  if (firstSeen) {
    const ageDays = (Date.now() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000)
    ageScore = Math.min(ageDays / AGE_CAP_DAYS, 1.0)
  }

  // Component 3: Activity score (0.0 - 1.0)
  let activityScore = 0
  if (firstSeen && lastSeen) {
    const activeDays = Math.max(
      (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000),
      1
    )
    activityScore = Math.min(feedbackCount / (activeDays * ACTIVITY_DIVISOR), 1.0)
  }

  // Component 4: Incident penalty (0.0 - 1.0)
  const rawIncidentPenalty =
    openCriticalIncidents * CRITICAL_PENALTY +
    openWarningIncidents * WARNING_PENALTY
  const incidentPenalty = Math.min(rawIncidentPenalty, 1.0)

  // Component 5: Sybil penalty (0.0 or 1.0)
  const sybilPenalty = hasSybilIncident ? 1.0 : 0.0

  // Weighted sum
  const rawScore =
    WEIGHTS.positiveRatio * positiveRatio +
    WEIGHTS.age * ageScore +
    WEIGHTS.activity * activityScore -
    WEIGHTS.incident * incidentPenalty -
    WEIGHTS.sybil * sybilPenalty

  const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)))

  // Confidence
  let confidence: TrustConfidence = 'low'
  if (feedbackCount >= 10) confidence = 'high'
  else if (feedbackCount >= 3) confidence = 'medium'

  return {
    score,
    positiveRatio: Math.round(positiveRatio * 10000) / 10000,
    activityScore: Math.round(activityScore * 10000) / 10000,
    ageScore: Math.round(ageScore * 10000) / 10000,
    incidentPenalty: Math.round(incidentPenalty * 10000) / 10000,
    confidence,
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test src/lib/reputation/__tests__/compute.test.ts`
Expected: 9 tests PASS

**Step 6: Commit**

```bash
git add src/types/trust-score.ts src/lib/reputation/compute.ts src/lib/reputation/__tests__/compute.test.ts
git commit -m "feat: trust score v1 types + computation (9 tests)"
```

---

### Task 3: Trust Score Data Layer

**Files:**
- Create: `src/lib/supabase/trust-scores.ts`
- Create: `src/lib/supabase/__tests__/trust-scores.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/supabase/__tests__/trust-scores.test.ts
import { describe, it, expect } from 'vitest'
import { buildTrustScoreRow } from '@/lib/supabase/trust-scores'

describe('trust-scores helpers', () => {
  it('builds a trust_scores row from compute result', () => {
    const row = buildTrustScoreRow({
      chainId: 42220,
      agentId: 5,
      computed: {
        score: 78,
        positiveRatio: 0.85,
        activityScore: 0.6,
        ageScore: 0.33,
        incidentPenalty: 0,
        confidence: 'high',
      },
      feedbackCount: 20,
      positiveCount: 17,
      negativeCount: 3,
      openIncidents: 0,
    })
    expect(row).toEqual({
      id: '42220:5',
      chain_id: 42220,
      agent_id: 5,
      score: 78,
      positive_ratio: 0.85,
      activity_score: 0.6,
      age_score: 0.33,
      incident_penalty: 0,
      feedback_count: 20,
      positive_count: 17,
      negative_count: 3,
      open_incidents: 0,
      confidence: 'high',
      updated_at: expect.any(String),
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/supabase/__tests__/trust-scores.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/supabase/trust-scores.ts
import { supabase } from '@/lib/supabase/client'
import { toTrustScore } from '@/types/trust-score'
import type { TrustScore } from '@/types/trust-score'
import type { ComputedScore } from '@/lib/reputation/compute'

export type BuildTrustScoreRowParams = {
  chainId: number
  agentId: number
  computed: ComputedScore
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  openIncidents: number
}

export function buildTrustScoreRow(params: BuildTrustScoreRowParams) {
  const { chainId, agentId, computed, feedbackCount, positiveCount, negativeCount, openIncidents } = params
  return {
    id: `${chainId}:${agentId}`,
    chain_id: chainId,
    agent_id: agentId,
    score: computed.score,
    positive_ratio: computed.positiveRatio,
    activity_score: computed.activityScore,
    age_score: computed.ageScore,
    incident_penalty: computed.incidentPenalty,
    feedback_count: feedbackCount,
    positive_count: positiveCount,
    negative_count: negativeCount,
    open_incidents: openIncidents,
    confidence: computed.confidence,
    updated_at: new Date().toISOString(),
  }
}

export async function fetchTrustScore(
  chainId: number,
  agentId: number,
): Promise<TrustScore | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('trust_scores')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()
  return data ? toTrustScore(data) : null
}

export async function fetchTrustScoresByChain(
  chainId: number,
  limit = 50,
): Promise<TrustScore[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('trust_scores')
    .select('*')
    .eq('chain_id', chainId)
    .order('score', { ascending: false })
    .limit(limit)
  return (data ?? []).map(toTrustScore)
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/supabase/__tests__/trust-scores.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/supabase/trust-scores.ts src/lib/supabase/__tests__/trust-scores.test.ts
git commit -m "feat: trust score data layer with Supabase helpers"
```

---

### Task 4: Extend Edge Function with Trust Score Computation

**Files:**
- Modify: `supabase/functions/erc8004-poller/index.ts`

**Step 1: Add `computeTrustScoreInline` + `upsertTrustScore` to Edge Function**

Since the Edge Function is Deno and can't import from `src/`, inline the computation. Add after the existing `dispatchWebhooks` function (before `// --- Poll one chain ---`):

```typescript
// --- Trust Score Computation (M6) ---

function computeTrustScoreInline(
  feedbackCount: number,
  positiveCount: number,
  negativeCount: number,
  firstSeen: string | null,
  lastSeen: string | null,
  openCritical: number,
  openWarning: number,
  hasSybil: boolean,
): { score: number; positiveRatio: number; activityScore: number; ageScore: number; incidentPenalty: number; confidence: string } {
  if (feedbackCount === 0) {
    return { score: 0, positiveRatio: 0, activityScore: 0, ageScore: 0, incidentPenalty: 0, confidence: 'low' }
  }

  const positiveRatio = positiveCount / feedbackCount

  let ageScore = 0
  if (firstSeen) {
    const ageDays = (Date.now() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000)
    ageScore = Math.min(ageDays / 90, 1.0)
  }

  let activityScore = 0
  if (firstSeen && lastSeen) {
    const activeDays = Math.max(
      (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000),
      1
    )
    activityScore = Math.min(feedbackCount / (activeDays * 2), 1.0)
  }

  const incidentPenalty = Math.min(openCritical * 0.15 + openWarning * 0.05, 1.0)
  const sybilPenalty = hasSybil ? 1.0 : 0.0

  const rawScore =
    0.40 * positiveRatio +
    0.20 * ageScore +
    0.20 * activityScore -
    0.10 * incidentPenalty -
    0.10 * sybilPenalty

  const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)))
  const confidence = feedbackCount >= 10 ? 'high' : feedbackCount >= 3 ? 'medium' : 'low'

  return {
    score,
    positiveRatio: Math.round(positiveRatio * 10000) / 10000,
    activityScore: Math.round(activityScore * 10000) / 10000,
    ageScore: Math.round(ageScore * 10000) / 10000,
    incidentPenalty: Math.round(incidentPenalty * 10000) / 10000,
    confidence,
  }
}

async function updateTrustScore(db: DB, event: ParsedEvent) {
  const agentKey = `${event.chain_id}:${event.agent_id}`

  // Get agent state
  const { data: agent } = await db
    .from('agents')
    .select('feedback_count, positive_count, negative_count, first_seen, last_seen')
    .eq('id', agentKey)
    .single()
  if (!agent) return

  // Count open incidents
  const { count: openCritical } = await db
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .eq('severity', 'critical')
    .is('resolved_at', null)

  const { count: openWarning } = await db
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .eq('severity', 'warning')
    .is('resolved_at', null)

  // Check for sybil
  const { count: sybilCount } = await db
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .eq('signal_kind', 'sybil_cluster')
    .is('resolved_at', null)

  const computed = computeTrustScoreInline(
    agent.feedback_count,
    agent.positive_count,
    agent.negative_count,
    agent.first_seen,
    agent.last_seen,
    openCritical ?? 0,
    openWarning ?? 0,
    (sybilCount ?? 0) > 0,
  )

  const openIncidents = (openCritical ?? 0) + (openWarning ?? 0)

  await db.from('trust_scores').upsert({
    id: agentKey,
    chain_id: event.chain_id,
    agent_id: event.agent_id,
    score: computed.score,
    positive_ratio: computed.positiveRatio,
    activity_score: computed.activityScore,
    age_score: computed.ageScore,
    incident_penalty: computed.incidentPenalty,
    feedback_count: agent.feedback_count,
    positive_count: agent.positive_count,
    negative_count: agent.negative_count,
    open_incidents: openIncidents,
    confidence: computed.confidence,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'chain_id,agent_id' })
}
```

**Step 2: Hook into pollChain**

After the M5 signal detection loop, add trust score update:

```typescript
    // M6: Update trust score
    for (const e of events) {
      await updateTrustScore(db, e)
    }
```

**Step 3: Verify build passes**

Run: `pnpm test && pnpm build`
Expected: 88+ tests PASS, build clean (Edge Function is excluded from tsconfig)

**Step 4: Commit**

```bash
git add supabase/functions/erc8004-poller/index.ts
git commit -m "feat(poller): compute and upsert trust scores after event ingestion"
```

---

## Phase 2: API Key Management

### Task 5: API Key Generation + Validation Helpers

**Files:**
- Create: `src/lib/api-keys/generate.ts`
- Create: `src/lib/api-keys/__tests__/generate.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/api-keys/__tests__/generate.test.ts
import { describe, it, expect } from 'vitest'
import { generateApiKey, hashApiKey, validateKeyFormat } from '@/lib/api-keys/generate'

describe('generateApiKey', () => {
  it('generates a key with ds_ prefix', () => {
    const key = generateApiKey()
    expect(key).toMatch(/^ds_[a-f0-9]{48}$/)
  })

  it('generates unique keys', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a).not.toBe(b)
  })
})

describe('hashApiKey', () => {
  it('returns a SHA-256 hex hash', async () => {
    const hash = await hashApiKey('ds_abc123')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await hashApiKey('ds_test')
    const b = await hashApiKey('ds_test')
    expect(a).toBe(b)
  })
})

describe('validateKeyFormat', () => {
  it('accepts valid keys', () => {
    expect(validateKeyFormat('ds_abcdef1234567890abcdef1234567890abcdef1234567890')).toBe(true)
  })

  it('rejects keys without prefix', () => {
    expect(validateKeyFormat('abcdef1234567890')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateKeyFormat('')).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/api-keys/__tests__/generate.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/api-keys/generate.ts
import { randomBytes, createHash } from 'crypto'

const KEY_PREFIX = 'ds_'
const KEY_BYTES = 24  // 48 hex chars after prefix

export function generateApiKey(): string {
  const bytes = randomBytes(KEY_BYTES)
  return KEY_PREFIX + bytes.toString('hex')
}

export async function hashApiKey(key: string): Promise<string> {
  return createHash('sha256').update(key).digest('hex')
}

export function validateKeyFormat(key: string): boolean {
  return /^ds_[a-f0-9]{48}$/.test(key)
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 11)  // "ds_" + first 8 hex chars
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/api-keys/__tests__/generate.test.ts`
Expected: 5 tests PASS

**Step 5: Commit**

```bash
git add src/lib/api-keys/generate.ts src/lib/api-keys/__tests__/generate.test.ts
git commit -m "feat: API key generation + hashing + validation helpers"
```

---

### Task 6: API Key CRUD Route + Rate Limit Middleware

**Files:**
- Create: `src/app/api/v1/keys/route.ts`
- Create: `src/lib/api-keys/rate-limit.ts`
- Create: `src/lib/api-keys/__tests__/rate-limit.test.ts`

**Step 1: Write failing rate limit tests**

```typescript
// src/lib/api-keys/__tests__/rate-limit.test.ts
import { describe, it, expect } from 'vitest'
import { isRateLimited } from '@/lib/api-keys/rate-limit'

describe('isRateLimited', () => {
  it('returns not limited when count is below limit', () => {
    const result = isRateLimited({ requestCount: 50, dailyLimit: 100 })
    expect(result.limited).toBe(false)
    expect(result.remaining).toBe(50)
  })

  it('returns limited when count meets limit', () => {
    const result = isRateLimited({ requestCount: 100, dailyLimit: 100 })
    expect(result.limited).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('returns limited when count exceeds limit', () => {
    const result = isRateLimited({ requestCount: 150, dailyLimit: 100 })
    expect(result.limited).toBe(true)
    expect(result.remaining).toBe(0)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/api-keys/__tests__/rate-limit.test.ts`
Expected: FAIL

**Step 3: Write rate limit helper**

```typescript
// src/lib/api-keys/rate-limit.ts

export type RateLimitResult = {
  limited: boolean
  remaining: number
  limit: number
  resetAt: string  // ISO date of next UTC midnight
}

export function isRateLimited(params: {
  requestCount: number
  dailyLimit: number
}): RateLimitResult {
  const { requestCount, dailyLimit } = params
  const remaining = Math.max(0, dailyLimit - requestCount)

  // Next UTC midnight
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

  return {
    limited: requestCount >= dailyLimit,
    remaining,
    limit: dailyLimit,
    resetAt: tomorrow.toISOString(),
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/api-keys/__tests__/rate-limit.test.ts`
Expected: 3 tests PASS

**Step 5: Write API key CRUD route**

```typescript
// src/app/api/v1/keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/api-keys/generate'

// GET: list keys for an owner (shows prefix only, never full key)
export async function GET(req: NextRequest) {
  const ownerAddress = req.nextUrl.searchParams.get('ownerAddress')
  if (!ownerAddress) {
    return NextResponse.json({ error: 'Missing ownerAddress' }, { status: 400 })
  }

  const { data } = await supabaseAdmin
    .from('api_keys')
    .select('id, key_prefix, label, tier, daily_limit, enabled, last_used_at, created_at')
    .eq('owner_address', ownerAddress.toLowerCase())
    .order('created_at', { ascending: false })

  return NextResponse.json({ keys: data ?? [] })
}

// POST: generate a new API key
export async function POST(req: NextRequest) {
  try {
    const { ownerAddress, label } = await req.json()
    if (!ownerAddress) {
      return NextResponse.json({ error: 'Missing ownerAddress' }, { status: 400 })
    }

    // Limit to 5 keys per owner
    const { count } = await supabaseAdmin
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('owner_address', ownerAddress.toLowerCase())

    if (count && count >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 API keys per owner' },
        { status: 409 }
      )
    }

    const rawKey = generateApiKey()
    const keyHash = await hashApiKey(rawKey)
    const keyPrefix = getKeyPrefix(rawKey)

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        owner_address: ownerAddress.toLowerCase(),
        key_prefix: keyPrefix,
        key_hash: keyHash,
        label: label || 'default',
        tier: 'free',
        daily_limit: 100,
      })
      .select('id, key_prefix, label, tier, daily_limit, created_at')
      .single()

    if (error) {
      console.error('API key create error:', error)
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
    }

    // Return the full key ONLY on creation (never stored in plain text)
    return NextResponse.json({ key: rawKey, metadata: data })
  } catch (err) {
    console.error('API key error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: revoke an API key
export async function DELETE(req: NextRequest) {
  try {
    const { keyId, ownerAddress } = await req.json()
    if (!keyId || !ownerAddress) {
      return NextResponse.json({ error: 'Missing keyId or ownerAddress' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('owner_address', ownerAddress.toLowerCase())

    if (error) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('API key delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 6: Commit**

```bash
git add src/lib/api-keys/rate-limit.ts src/lib/api-keys/__tests__/rate-limit.test.ts src/app/api/v1/keys/route.ts
git commit -m "feat: API key CRUD route + rate limit helper"
```

---

### Task 7: API Auth Middleware

**Files:**
- Create: `src/lib/api-keys/authenticate.ts`
- Create: `src/lib/api-keys/__tests__/authenticate.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/api-keys/__tests__/authenticate.test.ts
import { describe, it, expect } from 'vitest'
import { extractApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

describe('extractApiKey', () => {
  it('extracts key from Authorization Bearer header', () => {
    const headers = new Headers({ Authorization: 'Bearer ds_abc123' })
    expect(extractApiKey(headers)).toBe('ds_abc123')
  })

  it('extracts key from X-API-Key header', () => {
    const headers = new Headers({ 'X-API-Key': 'ds_abc123' })
    expect(extractApiKey(headers)).toBe('ds_abc123')
  })

  it('prefers Authorization over X-API-Key', () => {
    const headers = new Headers({
      Authorization: 'Bearer ds_from_auth',
      'X-API-Key': 'ds_from_header',
    })
    expect(extractApiKey(headers)).toBe('ds_from_auth')
  })

  it('returns null if no key present', () => {
    expect(extractApiKey(new Headers())).toBeNull()
  })
})

describe('buildRateLimitHeaders', () => {
  it('includes standard rate limit headers', () => {
    const headers = buildRateLimitHeaders({
      limited: false,
      remaining: 90,
      limit: 100,
      resetAt: '2026-02-17T00:00:00.000Z',
    })
    expect(headers['X-RateLimit-Limit']).toBe('100')
    expect(headers['X-RateLimit-Remaining']).toBe('90')
    expect(headers['X-RateLimit-Reset']).toBe('2026-02-17T00:00:00.000Z')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/api-keys/__tests__/authenticate.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/api-keys/authenticate.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashApiKey, validateKeyFormat } from '@/lib/api-keys/generate'
import { isRateLimited, type RateLimitResult } from '@/lib/api-keys/rate-limit'

export function extractApiKey(headers: Headers): string | null {
  const authHeader = headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  return headers.get('X-API-Key')
}

export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': result.resetAt,
  }
}

export type AuthResult =
  | { ok: true; keyId: string; rateLimit: RateLimitResult }
  | { ok: false; error: NextResponse }

export async function authenticateApiKey(headers: Headers): Promise<AuthResult> {
  const rawKey = extractApiKey(headers)

  if (!rawKey) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Missing API key. Provide via Authorization: Bearer <key> or X-API-Key header.' },
        { status: 401 }
      ),
    }
  }

  if (!validateKeyFormat(rawKey)) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 401 }
      ),
    }
  }

  const keyHash = await hashApiKey(rawKey)

  const { data: keyRow } = await supabaseAdmin
    .from('api_keys')
    .select('id, daily_limit, enabled')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!keyRow) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    }
  }

  if (!keyRow.enabled) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'API key is disabled' }, { status: 403 }),
    }
  }

  // Upsert daily usage counter
  const today = new Date().toISOString().slice(0, 10)
  const { data: usage } = await supabaseAdmin
    .from('api_usage_log')
    .upsert(
      { api_key_id: keyRow.id, usage_date: today, request_count: 1 },
      { onConflict: 'api_key_id,usage_date' }
    )
    .select('request_count')
    .single()

  // If row already existed, increment
  if (usage && usage.request_count === 1) {
    // Fresh insert, count is 1 — check
  } else if (usage) {
    await supabaseAdmin
      .from('api_usage_log')
      .update({ request_count: usage.request_count + 1 })
      .eq('api_key_id', keyRow.id)
      .eq('usage_date', today)
  }

  const requestCount = usage?.request_count ?? 1
  const rateLimit = isRateLimited({ requestCount, dailyLimit: keyRow.daily_limit })

  if (rateLimit.limited) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Rate limit exceeded', ...rateLimit },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit),
        }
      ),
    }
  }

  // Update last_used_at
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)

  return { ok: true, keyId: keyRow.id, rateLimit }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/api-keys/__tests__/authenticate.test.ts`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add src/lib/api-keys/authenticate.ts src/lib/api-keys/__tests__/authenticate.test.ts
git commit -m "feat: API key authentication middleware with rate limiting"
```

---

## Phase 3: API v1 Endpoints

### Task 8: GET /api/v1/agent/[chain]/[id] — Agent Profile

**Files:**
- Create: `src/app/api/v1/agent/[chain]/[id]/route.ts`

**Step 1: Write route**

```typescript
// src/app/api/v1/agent/[chain]/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const agentKey = `${chainId}:${agentId}`
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', agentKey)
    .maybeSingle()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // Check claim status
  const { data: profile } = await supabaseAdmin
    .from('owner_profiles')
    .select('wallet_address, display_name, claimed_at')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()

  return NextResponse.json({
    agent: {
      chainId,
      agentId,
      owner: agent.owner,
      uri: agent.uri,
      metadata: agent.metadata,
      feedbackCount: agent.feedback_count,
      positiveCount: agent.positive_count,
      negativeCount: agent.negative_count,
      firstSeen: agent.first_seen,
      lastSeen: agent.last_seen,
      claimed: !!profile,
      claimedBy: profile?.wallet_address ?? null,
      displayName: profile?.display_name ?? null,
    },
  }, { headers: buildRateLimitHeaders(auth.rateLimit) })
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Route appears as `ƒ /api/v1/agent/[chain]/[id]`

**Step 3: Commit**

```bash
git add src/app/api/v1/agent/[chain]/[id]/route.ts
git commit -m "feat: GET /api/v1/agent/:chain/:id — agent profile endpoint"
```

---

### Task 9: GET /api/v1/agent/[chain]/[id]/score — Trust Score

**Files:**
- Create: `src/app/api/v1/agent/[chain]/[id]/score/route.ts`

**Step 1: Write route**

```typescript
// src/app/api/v1/agent/[chain]/[id]/score/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'
import { toTrustScore } from '@/types/trust-score'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const { data } = await supabaseAdmin
    .from('trust_scores')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()

  if (!data) {
    return NextResponse.json(
      { error: 'Trust score not available. Agent may have no events yet.' },
      { status: 404 }
    )
  }

  const score = toTrustScore(data)

  return NextResponse.json({
    score: {
      value: score.score,
      confidence: score.confidence,
      breakdown: {
        positiveRatio: { value: score.positiveRatio, weight: 0.40 },
        ageScore: { value: score.ageScore, weight: 0.20 },
        activityScore: { value: score.activityScore, weight: 0.20 },
        incidentPenalty: { value: score.incidentPenalty, weight: 0.10 },
      },
      stats: {
        feedbackCount: score.feedbackCount,
        positiveCount: score.positiveCount,
        negativeCount: score.negativeCount,
        openIncidents: score.openIncidents,
      },
      updatedAt: score.updatedAt,
    },
    formula: 'https://denscope.vercel.app/docs/api#trust-score-formula',
  }, { headers: buildRateLimitHeaders(auth.rateLimit) })
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Route appears as `ƒ /api/v1/agent/[chain]/[id]/score`

**Step 3: Commit**

```bash
git add src/app/api/v1/agent/[chain]/[id]/score/route.ts
git commit -m "feat: GET /api/v1/agent/:chain/:id/score — trust score endpoint"
```

---

### Task 10: GET /api/v1/agent/[chain]/[id]/signals — Active Signals

**Files:**
- Create: `src/app/api/v1/agent/[chain]/[id]/signals/route.ts`

**Step 1: Write route**

```typescript
// src/app/api/v1/agent/[chain]/[id]/signals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'open'

  let query = supabaseAdmin
    .from('incidents')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('triggered_at', { ascending: false })
    .limit(50)

  if (status === 'open') {
    query = query.is('resolved_at', null)
  } else if (status === 'resolved') {
    query = query.not('resolved_at', 'is', null)
  }
  // status === 'all' → no filter

  const { data } = await query

  const signals = (data ?? []).map((row) => ({
    id: row.id,
    signalKind: row.signal_kind,
    severity: row.severity,
    title: row.title,
    description: row.description,
    whyItMatters: row.why_it_matters,
    sourceTxHash: row.source_tx_hash,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
  }))

  return NextResponse.json(
    { signals, count: signals.length },
    { headers: buildRateLimitHeaders(auth.rateLimit) }
  )
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Route appears as `ƒ /api/v1/agent/[chain]/[id]/signals`

**Step 3: Commit**

```bash
git add src/app/api/v1/agent/[chain]/[id]/signals/route.ts
git commit -m "feat: GET /api/v1/agent/:chain/:id/signals — active signals endpoint"
```

---

### Task 11: GET /api/v1/agent/[chain]/[id]/events — Event History

**Files:**
- Create: `src/app/api/v1/agent/[chain]/[id]/events/route.ts`

**Step 1: Write route**

```typescript
// src/app/api/v1/agent/[chain]/[id]/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

type RouteParams = { params: Promise<{ chain: string; id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  if (!chainId || !agentId) {
    return NextResponse.json({ error: 'Invalid chain or agent ID' }, { status: 400 })
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100)
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0)
  const kind = req.nextUrl.searchParams.get('kind')

  let query = supabaseAdmin
    .from('scope_events')
    .select('*', { count: 'exact' })
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('block_number', { ascending: false })
    .range(offset, offset + limit - 1)

  if (kind) {
    query = query.eq('kind', kind)
  }

  const { data, count } = await query

  const events = (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    blockNumber: row.block_number,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    data: row.data,
    eventTimestamp: row.event_timestamp,
    createdAt: row.created_at,
  }))

  return NextResponse.json(
    {
      events,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        hasMore: offset + limit < (count ?? 0),
      },
    },
    { headers: buildRateLimitHeaders(auth.rateLimit) }
  )
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Route appears

**Step 3: Commit**

```bash
git add src/app/api/v1/agent/[chain]/[id]/events/route.ts
git commit -m "feat: GET /api/v1/agent/:chain/:id/events — paginated event history"
```

---

### Task 12: GET /api/v1/search — Agent Search

**Files:**
- Create: `src/app/api/v1/search/route.ts`

**Step 1: Write route**

```typescript
// src/app/api/v1/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { authenticateApiKey, buildRateLimitHeaders } from '@/lib/api-keys/authenticate'

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers)
  if (!auth.ok) return auth.error

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const chainId = req.nextUrl.searchParams.get('chainId')
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 50)

  let query = supabaseAdmin
    .from('agents')
    .select('id, chain_id, agent_id, owner, uri, metadata, feedback_count, positive_count, negative_count, first_seen, last_seen')
    .order('feedback_count', { ascending: false })
    .limit(limit)

  if (chainId) {
    query = query.eq('chain_id', Number(chainId))
  }

  // Search by agent_id (numeric) or owner address (text)
  if (q) {
    const numericId = Number(q)
    if (!isNaN(numericId) && numericId > 0) {
      query = query.eq('agent_id', numericId)
    } else if (q.startsWith('0x')) {
      query = query.ilike('owner', `${q}%`)
    }
  }

  const { data } = await query

  const agents = (data ?? []).map((row) => ({
    chainId: row.chain_id,
    agentId: row.agent_id,
    owner: row.owner,
    uri: row.uri,
    feedbackCount: row.feedback_count,
    positiveCount: row.positive_count,
    negativeCount: row.negative_count,
  }))

  return NextResponse.json(
    { agents, count: agents.length },
    { headers: buildRateLimitHeaders(auth.rateLimit) }
  )
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Route appears as `ƒ /api/v1/search`

**Step 3: Commit**

```bash
git add src/app/api/v1/search/route.ts
git commit -m "feat: GET /api/v1/search — agent search endpoint"
```

---

## Phase 4: Console UI + Agent Page

### Task 13: API Keys Panel in Console

**Files:**
- Create: `src/components/console/ApiKeysPanel.tsx`
- Modify: `src/app/console/page.tsx`

**Step 1: Write ApiKeysPanel component**

```typescript
// src/components/console/ApiKeysPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

type ApiKeyMeta = {
  id: string
  key_prefix: string
  label: string
  tier: string
  daily_limit: number
  enabled: boolean
  last_used_at: string | null
  created_at: string
}

export function ApiKeysPanel() {
  const { address } = useAccount()
  const [keys, setKeys] = useState<ApiKeyMeta[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!address) return
    fetch(`/api/v1/keys?ownerAddress=${address}`)
      .then((r) => r.json())
      .then((data) => setKeys(data.keys ?? []))
  }, [address])

  async function handleCreate() {
    if (!address) return
    setCreating(true)
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerAddress: address, label: label || 'default' }),
    })
    const data = await res.json()
    if (data.key) {
      setNewKey(data.key)
      setKeys((prev) => [data.metadata, ...prev])
      setLabel('')
    }
    setCreating(false)
  }

  async function handleRevoke(keyId: string) {
    if (!address) return
    await fetch('/api/v1/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId, ownerAddress: address }),
    })
    setKeys((prev) => prev.filter((k) => k.id !== keyId))
  }

  return (
    <div className="bg-surface border border-border p-6 space-y-4">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-text-primary">
        API Keys
      </h2>
      <p className="text-xs text-text-muted font-mono">
        Use API keys to query agent trust scores programmatically.
        Free tier: 100 requests/day.
      </p>

      {/* Create new key */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="bg-background border border-border px-3 py-1.5 text-xs font-mono text-text-primary flex-1"
        />
        <button
          onClick={handleCreate}
          disabled={creating || keys.length >= 5}
          className="bg-accent text-background px-4 py-1.5 text-xs font-mono font-bold hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Generate Key'}
        </button>
      </div>

      {/* Show newly created key (only once) */}
      {newKey && (
        <div className="bg-background border border-accent p-3 space-y-1">
          <p className="text-xs text-accent font-mono font-bold">
            Copy your API key now — it won&apos;t be shown again:
          </p>
          <code className="text-xs text-text-primary font-mono break-all block">
            {newKey}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(newKey); setNewKey(null) }}
            className="text-[10px] font-mono text-accent hover:underline"
          >
            Copy & Dismiss
          </button>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="text-xs text-text-muted font-mono">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between bg-background border border-border px-3 py-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-text-primary">{k.key_prefix}...</code>
                  <span className="text-[10px] text-text-muted font-mono">{k.label}</span>
                  <span className="status-pill status-pill-accent text-[10px]">{k.tier}</span>
                </div>
                <p className="text-[10px] text-text-muted font-mono">
                  {k.daily_limit} req/day &middot; Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                className="text-[10px] font-mono text-critical hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Add ApiKeysPanel to console page**

In `src/app/console/page.tsx`, import `ApiKeysPanel` and add it as a third section after AlertsPanel.

```typescript
import { ApiKeysPanel } from '@/components/console/ApiKeysPanel'
```

Add in the JSX after the alerts grid section:

```tsx
{/* API Keys */}
<section>
  <h2 className="font-display text-xl font-bold uppercase tracking-wider text-text-primary mb-4">
    API ACCESS
  </h2>
  <ApiKeysPanel />
</section>
```

**Step 3: Verify build**

Run: `pnpm build`
Expected: Build clean

**Step 4: Commit**

```bash
git add src/components/console/ApiKeysPanel.tsx src/app/console/page.tsx
git commit -m "feat(console): API keys panel with create, copy, revoke"
```

---

### Task 14: Trust Score Display on Agent Page

**Files:**
- Create: `src/components/agent/TrustScoreBadge.tsx`
- Modify: `src/app/agent/[chain]/[id]/page.tsx`

**Step 1: Write TrustScoreBadge**

```typescript
// src/components/agent/TrustScoreBadge.tsx
import type { TrustScore } from '@/types/trust-score'

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 50) return 'text-accent'
  if (score >= 25) return 'text-warning'
  return 'text-critical'
}

function confidencePill(confidence: string): string {
  switch (confidence) {
    case 'high': return 'status-pill-success'
    case 'medium': return 'status-pill-accent'
    default: return 'status-pill-neutral'
  }
}

export function TrustScoreBadge({ score }: { score: TrustScore }) {
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <span className={`font-display text-5xl font-bold ${scoreColor(score.score)}`}>
          {score.score}
        </span>
        <div className="pb-1 space-y-1">
          <span className="text-xs text-text-muted font-mono">/ 100</span>
          <span className={`status-pill ${confidencePill(score.confidence)} text-[10px] block`}>
            {score.confidence.toUpperCase()} CONFIDENCE
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-1.5">
        <BreakdownRow label="Positive Ratio" value={score.positiveRatio} weight={0.40} />
        <BreakdownRow label="Age" value={score.ageScore} weight={0.20} />
        <BreakdownRow label="Activity" value={score.activityScore} weight={0.20} />
        {score.incidentPenalty > 0 && (
          <BreakdownRow label="Incident Penalty" value={-score.incidentPenalty} weight={0.10} negative />
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-[10px] text-text-muted font-mono pt-1 border-t border-border">
        <span>{score.feedbackCount} feedbacks</span>
        <span>{score.positiveCount} positive</span>
        <span>{score.negativeCount} negative</span>
        {score.openIncidents > 0 && (
          <span className="text-warning">{score.openIncidents} open incidents</span>
        )}
      </div>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  weight,
  negative,
}: {
  label: string
  value: number
  weight: number
  negative?: boolean
}) {
  const barWidth = Math.abs(value) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-text-muted font-mono w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-background border border-border relative">
        <div
          className={`h-full ${negative ? 'bg-critical' : 'bg-accent'}`}
          style={{ width: `${Math.min(barWidth, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-secondary w-16 text-right">
        {negative ? '-' : ''}{(Math.abs(value) * weight * 100).toFixed(1)}pts
      </span>
    </div>
  )
}
```

**Step 2: Update agent page to fetch and display trust score**

In `src/app/agent/[chain]/[id]/page.tsx`, replace the placeholder "Reputation" card (lines 307-315) with a trust score fetch + render.

Add import at top:

```typescript
import { TrustScoreBadge } from '@/components/agent/TrustScoreBadge'
import { toTrustScore } from '@/types/trust-score'
```

Add trust score fetch alongside existing data fetches (after `claimStatusRes`):

```typescript
const trustScoreRes = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/trust_scores?chain_id=eq.${chainConfig.id}&agent_id=eq.${agentId}&select=*`,
  {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
    },
    next: { revalidate: 60 },
  }
).then(r => r.json()).catch(() => [])
const trustScore = Array.isArray(trustScoreRes) && trustScoreRes.length > 0
  ? toTrustScore(trustScoreRes[0])
  : null
```

Replace the Reputation div:

```tsx
{/* Reputation / Trust Score */}
<div className="bg-surface border border-border p-5">
  <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
    Trust Score
  </h2>
  {trustScore ? (
    <TrustScoreBadge score={trustScore} />
  ) : (
    <p className="text-xs text-text-muted font-mono">
      No trust score yet — waiting for on-chain activity.
    </p>
  )}
</div>
```

**Step 3: Verify build**

Run: `pnpm build`
Expected: Build clean

**Step 4: Commit**

```bash
git add src/components/agent/TrustScoreBadge.tsx src/app/agent/[chain]/[id]/page.tsx
git commit -m "feat(agent): display trust score with breakdown on agent page"
```

---

## Phase 5: Documentation + Finalization

### Task 15: Public API Docs Page

**Files:**
- Create: `src/app/docs/api/page.tsx`

**Step 1: Write API docs page**

```typescript
// src/app/docs/api/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation — DenScope',
  description: 'DenScope Reputation API — query trust scores for any ERC-8004 agent',
}

export default function ApiDocsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-grid mx-auto max-w-4xl px-6 py-10">
        <nav className="font-mono text-xs text-text-muted uppercase tracking-wider">
          System / DenScope / API
        </nav>

        <h1 className="font-display text-3xl font-bold uppercase tracking-wider mt-4 text-text-primary">
          REPUTATION API
        </h1>
        <p className="mt-2 text-sm text-text-secondary max-w-2xl">
          Query trust scores, signals, and event history for any ERC-8004 agent.
          One curl command to answer: &ldquo;Can I trust this agent?&rdquo;
        </p>

        {/* Quick Start */}
        <Section title="Quick Start">
          <CodeBlock>{`curl -H "Authorization: Bearer ds_YOUR_KEY" \\
  https://denscope.vercel.app/api/v1/agent/42220/5/score`}</CodeBlock>
          <p className="text-xs text-text-muted font-mono mt-2">
            Get your API key from the Console → API Keys section.
          </p>
        </Section>

        {/* Authentication */}
        <Section title="Authentication">
          <p className="text-sm text-text-secondary">
            All endpoints require an API key. Pass it via:
          </p>
          <ul className="list-disc list-inside text-sm text-text-secondary mt-2 space-y-1">
            <li><code className="text-xs font-mono">Authorization: Bearer ds_...</code> (recommended)</li>
            <li><code className="text-xs font-mono">X-API-Key: ds_...</code></li>
          </ul>
        </Section>

        {/* Rate Limits */}
        <Section title="Rate Limits">
          <Table headers={['Tier', 'Requests/day', 'Price']}>
            <Row cells={['Free', '100', '$0']} />
            <Row cells={['Pro', '10,000', 'Coming soon']} />
          </Table>
          <p className="text-xs text-text-muted font-mono mt-2">
            Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
          </p>
        </Section>

        {/* Endpoints */}
        <Section title="Endpoints">
          <Endpoint
            method="GET"
            path="/api/v1/agent/{'{chain}'}/{'{id}'}"
            desc="Agent profile with metadata, feedback counts, and claim status."
          />
          <Endpoint
            method="GET"
            path="/api/v1/agent/{'{chain}'}/{'{id}'}/score"
            desc="Trust score (0-100) with confidence level and component breakdown."
          />
          <Endpoint
            method="GET"
            path="/api/v1/agent/{'{chain}'}/{'{id}'}/signals"
            desc="Active incidents/signals. Query param: ?status=open|resolved|all"
          />
          <Endpoint
            method="GET"
            path="/api/v1/agent/{'{chain}'}/{'{id}'}/events"
            desc="Paginated event history. Query params: ?limit=50&offset=0&kind=feedback"
          />
          <Endpoint
            method="GET"
            path="/api/v1/search"
            desc="Search agents by ID or owner. Query params: ?q=5&chainId=42220&limit=20"
          />
        </Section>

        {/* Trust Score Formula */}
        <Section title="Trust Score Formula" id="trust-score-formula">
          <p className="text-sm text-text-secondary">
            The trust score is a transparent, deterministic number between 0 and 100.
            It updates after every on-chain event.
          </p>
          <CodeBlock>{`score = clamp(0, 100, round(
  0.40 × positive_ratio        // positive_count / feedback_count
+ 0.20 × age_score             // min(days_since_first_seen / 90, 1.0)
+ 0.20 × activity_score        // min(feedback_count / (active_days × 2), 1.0)
- 0.10 × incident_penalty      // min(critical×0.15 + warning×0.05, 1.0)
- 0.10 × sybil_penalty         // 1.0 if open sybil_cluster, else 0.0
) × 100)`}</CodeBlock>
          <div className="mt-4">
            <h4 className="text-xs text-text-muted uppercase font-mono mb-2">Confidence Levels</h4>
            <Table headers={['Level', 'Condition']}>
              <Row cells={['Low', '0 feedbacks']} />
              <Row cells={['Medium', '3-9 feedbacks']} />
              <Row cells={['High', '10+ feedbacks']} />
            </Table>
          </div>
        </Section>

        {/* Chains */}
        <Section title="Supported Chains">
          <Table headers={['Chain', 'Chain ID']}>
            <Row cells={['Celo Mainnet', '42220']} />
            <Row cells={['Celo Sepolia (testnet)', '11142220']} />
          </Table>
        </Section>

        {/* Errors */}
        <Section title="Error Responses">
          <Table headers={['Status', 'Meaning']}>
            <Row cells={['400', 'Invalid parameters']} />
            <Row cells={['401', 'Missing or invalid API key']} />
            <Row cells={['403', 'API key disabled']} />
            <Row cells={['404', 'Agent or score not found']} />
            <Row cells={['429', 'Rate limit exceeded']} />
            <Row cells={['500', 'Internal server error']} />
          </Table>
        </Section>
      </div>
    </div>
  )
}

// --- Helper components ---

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-text-primary border-b border-border pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-background border border-border p-4 mt-2 overflow-x-auto">
      <code className="text-xs font-mono text-text-primary whitespace-pre">{children}</code>
    </pre>
  )
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="bg-background border border-border p-4 mt-3">
      <div className="flex items-center gap-2">
        <span className="status-pill status-pill-accent text-[10px]">{method}</span>
        <code className="text-xs font-mono text-text-primary">{path}</code>
      </div>
      <p className="text-xs text-text-secondary font-mono mt-1">{desc}</p>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-xs font-mono mt-2">
      <thead>
        <tr className="border-b border-border">
          {headers.map((h) => (
            <th key={h} className="text-left text-text-muted uppercase py-2 pr-4">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Row({ cells }: { cells: string[] }) {
  return (
    <tr className="border-b border-border">
      {cells.map((c, i) => (
        <td key={i} className="text-text-secondary py-2 pr-4">{c}</td>
      ))}
    </tr>
  )
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: `/docs/api` appears as `○ (Static)`

**Step 3: Commit**

```bash
git add src/app/docs/api/page.tsx
git commit -m "feat: public API documentation page at /docs/api"
```

---

### Task 16: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md with M6 additions**

Add to Routes table:
```
| `/api/v1/agent/[chain]/[id]` | API | Agent profile (API key required) |
| `/api/v1/agent/[chain]/[id]/score` | API | Trust score + breakdown |
| `/api/v1/agent/[chain]/[id]/signals` | API | Active signals/incidents |
| `/api/v1/agent/[chain]/[id]/events` | API | Paginated event history |
| `/api/v1/search` | API | Agent search |
| `/api/v1/keys` | API | API key CRUD (console) |
| `/docs/api` | Static | Public API documentation |
```

Update Supabase tables list: add `trust_scores`, `api_keys`, `api_usage_log`

Update test count to final number.

Add section:
```markdown
## Reputation API (M6)

Trust score algorithm v1 — transparent formula, pre-computed by Edge Function:

| Component | Weight | Description |
|-----------|--------|-------------|
| Positive Ratio | 0.40 | positive_count / feedback_count |
| Age Score | 0.20 | days since first_seen / 90, capped at 1.0 |
| Activity Score | 0.20 | feedbacks per active day / 2, capped at 1.0 |
| Incident Penalty | -0.10 | 0.15 per critical + 0.05 per warning, capped at 1.0 |
| Sybil Penalty | -0.10 | 1.0 if open sybil_cluster incident |

Score: 0-100, clamped. Confidence: low (0 feedbacks), medium (3-9), high (10+).

API authentication via `Authorization: Bearer ds_...` or `X-API-Key` header.
Rate limits: free 100 req/day, pro 10K req/day.
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with M6 reputation API info"
```

---

### Task 17: Final Verification

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (88+ tests)

**Step 2: Run production build**

Run: `pnpm build`
Expected: Build clean, all routes present:
```
├ ƒ /api/v1/agent/[chain]/[id]
├ ƒ /api/v1/agent/[chain]/[id]/events
├ ƒ /api/v1/agent/[chain]/[id]/score
├ ƒ /api/v1/agent/[chain]/[id]/signals
├ ƒ /api/v1/keys
├ ƒ /api/v1/search
├ ○ /docs/api
```

**Step 3: Deploy Edge Function**

Run: `supabase functions deploy erc8004-poller --no-verify-jwt`
Expected: Deployed successfully

**Step 4: Apply migration**

Run: `supabase db push`
Expected: Migration applied

**Step 5: Verify git log**

Run: `git log --oneline feat/m6-reputation-api --not main`
Expected: ~12 commits covering all tasks

---

## Summary

| Task | Description | Tests Added |
|------|-------------|-------------|
| 1 | DB migration (trust_scores, api_keys, api_usage_log) | — |
| 2 | Trust score types + computation | 9 |
| 3 | Trust score data layer | 1 |
| 4 | Edge Function trust score computation | — |
| 5 | API key generation + validation | 5 |
| 6 | API key CRUD route + rate limit | 3 |
| 7 | API auth middleware | 4 |
| 8 | GET /api/v1/agent/:chain/:id | — |
| 9 | GET /api/v1/agent/:chain/:id/score | — |
| 10 | GET /api/v1/agent/:chain/:id/signals | — |
| 11 | GET /api/v1/agent/:chain/:id/events | — |
| 12 | GET /api/v1/search | — |
| 13 | ApiKeysPanel in console | — |
| 14 | TrustScoreBadge on agent page | — |
| 15 | Public API docs page | — |
| 16 | Update CLAUDE.md | — |
| 17 | Final verification + deploy | — |

**Total new tests: ~22** (on top of existing 79 = ~101 total)
