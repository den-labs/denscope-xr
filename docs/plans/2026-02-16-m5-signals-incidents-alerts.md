# M5: Signals, Incidents & Alerts — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give agent owners a reason to return daily — detect on-chain signals server-side, surface incidents in a timeline, and dispatch webhook alerts when something happens.

**Architecture:** Extend the existing `erc8004-poller` Edge Function with signal detection. After ingesting events, check if new events match any of 5 detection rules for claimed agents. Insert incidents into a new `incidents` table (Supabase Realtime-enabled). Alert rules with webhook URLs dispatch payloads to external services. Console UI replaces M5 placeholders with IncidentTimeline + AlertsPanel.

**Tech Stack:** Supabase (new tables: `incidents`, `alert_rules`, `webhook_logs`), Edge Function (Deno), Next.js API routes, zustand stores, Supabase Realtime subscriptions

**Ref:** Vision doc at `docs/plans/2026-02-15-denscope-vision.md` (M5 section, lines 155-164)

**Key context:**
- `agents` table already tracks `feedback_count`, `positive_count`, `negative_count`, `first_seen`, `last_seen`
- `owner_profiles` table (M4) links `wallet_address` → `chain_id, agent_id`
- `scope_events` has all on-chain events with `kind`, `data` (JSONB), `event_timestamp`
- Edge Function `erc8004-poller` runs every 30s via pg_cron (Deno, ~228 lines)
- Console page has M5 placeholders ready at `src/app/console/page.tsx:32-46`
- Existing client-side discovery rules: `detectFirstBlood`, `detectRisingStar` in `src/lib/discovery/rules.ts`
- `DiscoverySignal` type has severity: `'info' | 'warning' | 'critical'`

**Signal rules (5 for timeline, 3 for alerts):**

| Signal | Trigger | Severity | Alert? |
|--------|---------|----------|--------|
| `reputation_drop` | Negative feedback ratio >50% in last 5 events | warning/critical | Yes (>20% in 24h) |
| `sybil_cluster` | >3 feedbacks from different addresses in <1 hour | critical | Yes |
| `feedback_spike` | >5 feedbacks in 1 hour | info | No |
| `first_interaction` | Agent goes from 0 to 1 feedback | info | No |
| `validation_complete` | `validation_res` event for agent | info | No |

**Additional alert-only rule:**
| `going_cold` | No feedback in 7 days for active agent | warning | Yes |

---

## Task 1: Database Migration — `incidents`, `alert_rules`, `webhook_logs`

**Files:**
- Create: `supabase/migrations/20260216020000_m5_signals.sql`

**Step 1: Write the migration**

```sql
-- M5: Signals, Incidents & Alerts

-- Incidents: detected signals for agents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  signal_kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  why_it_matters TEXT,
  source_tx_hash TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id, signal_kind, source_tx_hash)
);

CREATE INDEX idx_incidents_agent ON incidents (chain_id, agent_id, triggered_at DESC);
CREATE INDEX idx_incidents_open ON incidents (chain_id, agent_id)
  WHERE resolved_at IS NULL;

-- Alert rules: 3 predefined per agent, toggled on/off
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('reputation_drop', 'sybil_detected', 'going_cold')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id, rule_type)
);

CREATE INDEX idx_alert_rules_agent ON alert_rules (chain_id, agent_id) WHERE enabled = true;

-- Webhook logs: audit trail
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id),
  webhook_url TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_status INTEGER,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_incident ON webhook_logs (incident_id);

-- RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Public read for incidents (explorer can show signals)
CREATE POLICY "Public read incidents" ON incidents FOR SELECT USING (true);
CREATE POLICY "Service write incidents" ON incidents FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Service update incidents" ON incidents FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role');

-- Alert rules: public read (owner checks rules from client), service_role write
CREATE POLICY "Public read alert_rules" ON alert_rules FOR SELECT USING (true);
CREATE POLICY "Service write alert_rules" ON alert_rules FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Service update alert_rules" ON alert_rules FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Service delete alert_rules" ON alert_rules FOR DELETE
  USING ((SELECT auth.role()) = 'service_role');

-- Webhook logs: public read, service_role write
CREATE POLICY "Public read webhook_logs" ON webhook_logs FOR SELECT USING (true);
CREATE POLICY "Service write webhook_logs" ON webhook_logs FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');
```

**Step 2: Apply migration**

Run: `cd denscope && supabase db push`
Expected: Migration applied, 3 new tables created.

**Step 3: Enable Realtime on incidents**

Run in Supabase SQL editor or add to migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260216020000_m5_signals.sql
git commit -m "feat(db): add incidents, alert_rules, webhook_logs for M5"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/incidents.ts`
- Create: `src/types/alerts.ts`
- Test: `src/types/__tests__/incidents.test.ts`

**Step 1: Write failing test**

```typescript
// src/types/__tests__/incidents.test.ts
import { describe, it, expect } from 'vitest'
import type { Incident, IncidentSignalKind } from '@/types/incidents'
import type { AlertRule, AlertRuleType } from '@/types/alerts'

describe('Incident type', () => {
  it('has all required fields', () => {
    const incident: Incident = {
      id: 'uuid',
      chainId: 42220,
      agentId: 5,
      signalKind: 'reputation_drop',
      severity: 'warning',
      title: 'Reputation Drop',
      description: 'Test',
      whyItMatters: 'Test reason',
      triggeredAt: '2026-02-16T00:00:00Z',
      metadata: {},
    }
    expect(incident.signalKind).toBe('reputation_drop')
  })

  it('covers all signal kinds', () => {
    const kinds: IncidentSignalKind[] = [
      'reputation_drop', 'sybil_cluster', 'feedback_spike',
      'first_interaction', 'validation_complete', 'going_cold',
    ]
    expect(kinds).toHaveLength(6)
  })
})

describe('AlertRule type', () => {
  it('covers all 3 predefined rule types', () => {
    const types: AlertRuleType[] = ['reputation_drop', 'sybil_detected', 'going_cold']
    expect(types).toHaveLength(3)
  })

  it('has required fields', () => {
    const rule: AlertRule = {
      id: 'uuid',
      ownerAddress: '0x123',
      chainId: 42220,
      agentId: 5,
      ruleType: 'reputation_drop',
      enabled: true,
      webhookUrl: null,
      createdAt: '2026-02-16T00:00:00Z',
      updatedAt: '2026-02-16T00:00:00Z',
    }
    expect(rule.ruleType).toBe('reputation_drop')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/types/__tests__/incidents.test.ts`
Expected: FAIL — modules not found.

**Step 3: Write type definitions**

```typescript
// src/types/incidents.ts
export type IncidentSignalKind =
  | 'reputation_drop'
  | 'sybil_cluster'
  | 'feedback_spike'
  | 'first_interaction'
  | 'validation_complete'
  | 'going_cold'

export type IncidentSeverity = 'info' | 'warning' | 'critical'

export type Incident = {
  id: string
  chainId: number
  agentId: number
  signalKind: IncidentSignalKind
  severity: IncidentSeverity
  title: string
  description: string
  whyItMatters: string | null
  sourceTxHash?: string
  triggeredAt: string
  resolvedAt?: string | null
  metadata: Record<string, unknown>
}

/** Map DB row (snake_case) → Incident (camelCase) */
export function toIncident(row: Record<string, unknown>): Incident {
  return {
    id: row.id as string,
    chainId: row.chain_id as number,
    agentId: row.agent_id as number,
    signalKind: row.signal_kind as IncidentSignalKind,
    severity: row.severity as IncidentSeverity,
    title: row.title as string,
    description: row.description as string,
    whyItMatters: (row.why_it_matters as string) ?? null,
    sourceTxHash: row.source_tx_hash as string | undefined,
    triggeredAt: row.triggered_at as string,
    resolvedAt: row.resolved_at as string | null | undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}
```

```typescript
// src/types/alerts.ts
export type AlertRuleType = 'reputation_drop' | 'sybil_detected' | 'going_cold'

export type AlertRule = {
  id: string
  ownerAddress: string
  chainId: number
  agentId: number
  ruleType: AlertRuleType
  enabled: boolean
  webhookUrl: string | null
  createdAt: string
  updatedAt: string
}

/** Map DB row (snake_case) → AlertRule (camelCase) */
export function toAlertRule(row: Record<string, unknown>): AlertRule {
  return {
    id: row.id as string,
    ownerAddress: row.owner_address as string,
    chainId: row.chain_id as number,
    agentId: row.agent_id as number,
    ruleType: row.rule_type as AlertRuleType,
    enabled: row.enabled as boolean,
    webhookUrl: (row.webhook_url as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export type WebhookPayload = {
  incident: {
    id: string
    signalKind: string
    severity: string
    title: string
    description: string
    whyItMatters: string | null
  }
  agent: { chainId: number; agentId: number }
  timestamp: string
  consoleUrl: string
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/types/__tests__/incidents.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/incidents.ts src/types/alerts.ts src/types/__tests__/incidents.test.ts
git commit -m "feat: add Incident and AlertRule type definitions for M5"
```

---

## Task 3: Incidents Data Layer

**Files:**
- Create: `src/lib/supabase/incidents.ts`
- Test: `src/lib/supabase/__tests__/incidents.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/supabase/__tests__/incidents.test.ts
import { describe, it, expect } from 'vitest'
import { buildIncidentRow } from '@/lib/supabase/incidents'

describe('incidents helpers', () => {
  it('builds an incident row from params', () => {
    const row = buildIncidentRow({
      chainId: 42220,
      agentId: 5,
      signalKind: 'reputation_drop',
      severity: 'warning',
      title: 'Reputation Drop',
      description: 'Score dropped 30% in 24h',
      whyItMatters: 'Review recent interactions',
    })
    expect(row).toEqual({
      chain_id: 42220,
      agent_id: 5,
      signal_kind: 'reputation_drop',
      severity: 'warning',
      title: 'Reputation Drop',
      description: 'Score dropped 30% in 24h',
      why_it_matters: 'Review recent interactions',
    })
  })

  it('includes optional source_tx_hash', () => {
    const row = buildIncidentRow({
      chainId: 42220,
      agentId: 5,
      signalKind: 'first_interaction',
      severity: 'info',
      title: 'First Feedback',
      description: 'Agent received first feedback',
      sourceTxHash: '0xabc',
    })
    expect(row.source_tx_hash).toBe('0xabc')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/supabase/__tests__/incidents.test.ts`
Expected: FAIL — module not found.

**Step 3: Write incidents data layer**

```typescript
// src/lib/supabase/incidents.ts
import { supabase } from './client'
import type { Incident, IncidentSignalKind, IncidentSeverity } from '@/types/incidents'
import { toIncident } from '@/types/incidents'

type BuildIncidentParams = {
  chainId: number
  agentId: number
  signalKind: IncidentSignalKind
  severity: IncidentSeverity
  title: string
  description: string
  whyItMatters?: string
  sourceTxHash?: string
  metadata?: Record<string, unknown>
}

export function buildIncidentRow(params: BuildIncidentParams) {
  return {
    chain_id: params.chainId,
    agent_id: params.agentId,
    signal_kind: params.signalKind,
    severity: params.severity,
    title: params.title,
    description: params.description,
    why_it_matters: params.whyItMatters ?? null,
    source_tx_hash: params.sourceTxHash ?? null,
    metadata: params.metadata ?? {},
  }
}

export async function fetchIncidents(
  chainId: number,
  agentId: number,
  limit = 20
): Promise<Incident[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('incidents')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('triggered_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(toIncident)
}

export async function fetchIncidentsForOwner(
  walletAddress: string,
  limit = 50
): Promise<Incident[]> {
  if (!supabase) return []
  // Join via owner_profiles to get incidents for all claimed agents
  const { data: profiles } = await supabase
    .from('owner_profiles')
    .select('chain_id, agent_id')
    .eq('wallet_address', walletAddress.toLowerCase())
  if (!profiles || profiles.length === 0) return []

  const filters = profiles.map(
    (p) => `and(chain_id.eq.${p.chain_id},agent_id.eq.${p.agent_id})`
  )
  const { data } = await supabase
    .from('incidents')
    .select('*')
    .or(filters.join(','))
    .order('triggered_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(toIncident)
}

export async function fetchOpenIncidentCount(
  walletAddress: string
): Promise<number> {
  if (!supabase) return 0
  const { data: profiles } = await supabase
    .from('owner_profiles')
    .select('chain_id, agent_id')
    .eq('wallet_address', walletAddress.toLowerCase())
  if (!profiles || profiles.length === 0) return 0

  const filters = profiles.map(
    (p) => `and(chain_id.eq.${p.chain_id},agent_id.eq.${p.agent_id})`
  )
  const { count } = await supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .or(filters.join(','))
    .is('resolved_at', null)
  return count ?? 0
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/supabase/__tests__/incidents.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/supabase/incidents.ts src/lib/supabase/__tests__/incidents.test.ts
git commit -m "feat: add incidents data layer (build, fetch, count)"
```

---

## Task 4: Alert Rules Data Layer

**Files:**
- Create: `src/lib/supabase/alerts.ts`
- Test: `src/lib/supabase/__tests__/alerts.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/supabase/__tests__/alerts.test.ts
import { describe, it, expect } from 'vitest'
import { buildDefaultRules } from '@/lib/supabase/alerts'

describe('alerts helpers', () => {
  it('generates 3 default alert rules for an agent', () => {
    const rules = buildDefaultRules({
      ownerAddress: '0xabc',
      chainId: 42220,
      agentId: 5,
    })
    expect(rules).toHaveLength(3)
    expect(rules.map((r) => r.rule_type).sort()).toEqual([
      'going_cold',
      'reputation_drop',
      'sybil_detected',
    ])
    rules.forEach((r) => {
      expect(r.owner_address).toBe('0xabc')
      expect(r.enabled).toBe(true)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/supabase/__tests__/alerts.test.ts`
Expected: FAIL — module not found.

**Step 3: Write alerts data layer**

```typescript
// src/lib/supabase/alerts.ts
import { supabase } from './client'
import type { AlertRule, AlertRuleType } from '@/types/alerts'
import { toAlertRule } from '@/types/alerts'

const DEFAULT_RULE_TYPES: AlertRuleType[] = [
  'reputation_drop',
  'sybil_detected',
  'going_cold',
]

type BuildRulesParams = {
  ownerAddress: string
  chainId: number
  agentId: number
}

export function buildDefaultRules(params: BuildRulesParams) {
  return DEFAULT_RULE_TYPES.map((ruleType) => ({
    owner_address: params.ownerAddress,
    chain_id: params.chainId,
    agent_id: params.agentId,
    rule_type: ruleType,
    enabled: true,
    webhook_url: null,
  }))
}

export async function fetchAlertRules(
  chainId: number,
  agentId: number
): Promise<AlertRule[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('rule_type')
  return (data ?? []).map(toAlertRule)
}

export async function fetchAlertRulesForOwner(
  walletAddress: string
): Promise<AlertRule[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('owner_address', walletAddress.toLowerCase())
    .order('chain_id')
    .order('agent_id')
    .order('rule_type')
  return (data ?? []).map(toAlertRule)
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/supabase/__tests__/alerts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/supabase/alerts.ts src/lib/supabase/__tests__/alerts.test.ts
git commit -m "feat: add alert rules data layer (defaults, fetch)"
```

---

## Task 5: Signal Detection Functions

**Files:**
- Create: `src/lib/signals/detect.ts`
- Test: `src/lib/signals/__tests__/detect.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/signals/__tests__/detect.test.ts
import { describe, it, expect } from 'vitest'
import {
  detectFirstInteraction,
  detectValidationComplete,
  detectFeedbackSpike,
  detectReputationDrop,
  detectSybilCluster,
} from '@/lib/signals/detect'

describe('detectFirstInteraction', () => {
  it('fires when feedback_count goes from 0 to 1', () => {
    const result = detectFirstInteraction(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { feedbackCount: 0 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('first_interaction')
    expect(result!.severity).toBe('info')
  })

  it('does not fire when feedback_count > 0', () => {
    const result = detectFirstInteraction(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { feedbackCount: 3 }
    )
    expect(result).toBeNull()
  })

  it('does not fire for non-feedback events', () => {
    const result = detectFirstInteraction(
      { kind: 'register', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { feedbackCount: 0 }
    )
    expect(result).toBeNull()
  })
})

describe('detectValidationComplete', () => {
  it('fires on validation_res event', () => {
    const result = detectValidationComplete(
      { kind: 'validation_res', chainId: 42220, agentId: 5, txHash: '0xabc' }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('validation_complete')
  })

  it('does not fire for other events', () => {
    const result = detectValidationComplete(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' }
    )
    expect(result).toBeNull()
  })
})

describe('detectFeedbackSpike', () => {
  it('fires when recent feedback count exceeds threshold', () => {
    const result = detectFeedbackSpike(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { recentFeedbackCount: 6, windowHours: 1 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('feedback_spike')
  })

  it('does not fire below threshold', () => {
    const result = detectFeedbackSpike(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { recentFeedbackCount: 2, windowHours: 1 }
    )
    expect(result).toBeNull()
  })
})

describe('detectReputationDrop', () => {
  it('fires when negative ratio exceeds 50%', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 2, negativeCount: 4, feedbackCount: 6 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('reputation_drop')
    expect(result!.severity).toBe('warning')
  })

  it('returns critical when negative ratio > 80%', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 1, negativeCount: 9, feedbackCount: 10 }
    )
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('critical')
  })

  it('does not fire when ratio is healthy', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 8, negativeCount: 2, feedbackCount: 10 }
    )
    expect(result).toBeNull()
  })

  it('needs at least 3 feedbacks to fire', () => {
    const result = detectReputationDrop(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { positiveCount: 0, negativeCount: 2, feedbackCount: 2 }
    )
    expect(result).toBeNull()
  })
})

describe('detectSybilCluster', () => {
  it('fires when unique addresses exceed threshold in window', () => {
    const result = detectSybilCluster(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { uniqueAddressesInWindow: 4, windowHours: 1 }
    )
    expect(result).not.toBeNull()
    expect(result!.signalKind).toBe('sybil_cluster')
    expect(result!.severity).toBe('critical')
  })

  it('does not fire below threshold', () => {
    const result = detectSybilCluster(
      { kind: 'feedback', chainId: 42220, agentId: 5, txHash: '0xabc' },
      { uniqueAddressesInWindow: 2, windowHours: 1 }
    )
    expect(result).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/signals/__tests__/detect.test.ts`
Expected: FAIL — module not found.

**Step 3: Write signal detection functions**

```typescript
// src/lib/signals/detect.ts

type EventInput = {
  kind: string
  chainId: number
  agentId: number
  txHash: string
}

type SignalResult = {
  chainId: number
  agentId: number
  signalKind: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  whyItMatters: string
  sourceTxHash: string
  metadata: Record<string, unknown>
}

// --- Rule 1: First Interaction ---

type FirstInteractionContext = {
  feedbackCount: number
}

export function detectFirstInteraction(
  event: EventInput,
  context: FirstInteractionContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.feedbackCount > 0) return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'first_interaction',
    severity: 'info',
    title: 'First Feedback',
    description: `Agent #${event.agentId} received its first-ever feedback`,
    whyItMatters: 'Your agent is now visible to clients on the network.',
    sourceTxHash: event.txHash,
    metadata: {},
  }
}

// --- Rule 2: Validation Complete ---

export function detectValidationComplete(
  event: EventInput
): SignalResult | null {
  if (event.kind !== 'validation_res') return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'validation_complete',
    severity: 'info',
    title: 'Validation Complete',
    description: `A validator responded about Agent #${event.agentId}`,
    whyItMatters: 'Validator feedback affects your agent\'s trust score.',
    sourceTxHash: event.txHash,
    metadata: {},
  }
}

// --- Rule 3: Feedback Spike ---

const FEEDBACK_SPIKE_THRESHOLD = 5

type FeedbackSpikeContext = {
  recentFeedbackCount: number
  windowHours: number
}

export function detectFeedbackSpike(
  event: EventInput,
  context: FeedbackSpikeContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.recentFeedbackCount < FEEDBACK_SPIKE_THRESHOLD) return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'feedback_spike',
    severity: 'info',
    title: 'Feedback Spike',
    description: `Agent #${event.agentId} received ${context.recentFeedbackCount} feedbacks in ${context.windowHours}h`,
    whyItMatters: 'Unusual activity may indicate growing interest or coordinated behavior.',
    sourceTxHash: event.txHash,
    metadata: {
      count: context.recentFeedbackCount,
      window_hours: context.windowHours,
    },
  }
}

// --- Rule 4: Reputation Drop ---

const REPUTATION_DROP_MIN_FEEDBACKS = 3
const REPUTATION_DROP_WARNING = 0.5
const REPUTATION_DROP_CRITICAL = 0.8

type ReputationDropContext = {
  positiveCount: number
  negativeCount: number
  feedbackCount: number
}

export function detectReputationDrop(
  event: EventInput,
  context: ReputationDropContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.feedbackCount < REPUTATION_DROP_MIN_FEEDBACKS) return null
  const negativeRatio = context.negativeCount / context.feedbackCount
  if (negativeRatio < REPUTATION_DROP_WARNING) return null
  const severity = negativeRatio >= REPUTATION_DROP_CRITICAL ? 'critical' : 'warning'
  const percent = Math.round(negativeRatio * 100)
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'reputation_drop',
    severity,
    title: 'Reputation Drop',
    description: `Agent #${event.agentId} has ${percent}% negative feedback (${context.negativeCount}/${context.feedbackCount})`,
    whyItMatters: 'A high negative feedback ratio may indicate trust issues. Review recent interactions.',
    sourceTxHash: event.txHash,
    metadata: {
      positive: context.positiveCount,
      negative: context.negativeCount,
      total: context.feedbackCount,
      negative_percent: percent,
    },
  }
}

// --- Rule 5: Sybil Cluster ---

const SYBIL_CLUSTER_THRESHOLD = 4

type SybilClusterContext = {
  uniqueAddressesInWindow: number
  windowHours: number
}

export function detectSybilCluster(
  event: EventInput,
  context: SybilClusterContext
): SignalResult | null {
  if (event.kind !== 'feedback') return null
  if (context.uniqueAddressesInWindow < SYBIL_CLUSTER_THRESHOLD) return null
  return {
    chainId: event.chainId,
    agentId: event.agentId,
    signalKind: 'sybil_cluster',
    severity: 'critical',
    title: 'Sybil Pattern Detected',
    description: `${context.uniqueAddressesInWindow} different addresses submitted feedback for Agent #${event.agentId} in ${context.windowHours}h`,
    whyItMatters: 'Coordinated feedback from multiple new accounts may indicate a sybil attack.',
    sourceTxHash: event.txHash,
    metadata: {
      unique_addresses: context.uniqueAddressesInWindow,
      window_hours: context.windowHours,
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/signals/__tests__/detect.test.ts`
Expected: PASS (12 tests)

**Step 5: Commit**

```bash
git add src/lib/signals/detect.ts src/lib/signals/__tests__/detect.test.ts
git commit -m "feat: add 5 signal detection rules with unit tests"
```

---

## Task 6: Incidents API Route (Resolve)

**Files:**
- Create: `src/app/api/incidents/resolve/route.ts`

**Step 1: Write the resolve endpoint**

```typescript
// src/app/api/incidents/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { incidentId } = await req.json()

    if (!incidentId) {
      return NextResponse.json(
        { error: 'Missing required field: incidentId' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('incidents')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', incidentId)
      .is('resolved_at', null)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Incident not found or already resolved' },
        { status: 404 }
      )
    }

    return NextResponse.json({ resolved: true, incident: data })
  } catch (err) {
    console.error('Resolve incident error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds, `/api/incidents/resolve` visible in routes.

**Step 3: Commit**

```bash
git add src/app/api/incidents/resolve/route.ts
git commit -m "feat: add POST /api/incidents/resolve endpoint"
```

---

## Task 7: Alert Rules API Routes

**Files:**
- Create: `src/app/api/alerts/rules/route.ts`
- Create: `src/app/api/alerts/webhook-test/route.ts`

**Step 1: Write alert rules CRUD endpoint**

```typescript
// src/app/api/alerts/rules/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { verifySiweMessage } from '@/lib/auth/verify'
import { SiweMessage } from 'siwe'
import { buildDefaultRules } from '@/lib/supabase/alerts'

// GET: fetch alert rules for an agent
export async function GET(req: NextRequest) {
  const chainId = req.nextUrl.searchParams.get('chainId')
  const agentId = req.nextUrl.searchParams.get('agentId')

  if (!chainId || !agentId) {
    return NextResponse.json(
      { error: 'Missing chainId or agentId' },
      { status: 400 }
    )
  }

  const { data } = await supabaseAdmin
    .from('alert_rules')
    .select('*')
    .eq('chain_id', Number(chainId))
    .eq('agent_id', Number(agentId))
    .order('rule_type')

  return NextResponse.json({ rules: data ?? [] })
}

// POST: initialize default rules for an agent (called after claim)
export async function POST(req: NextRequest) {
  try {
    const { ownerAddress, chainId, agentId } = await req.json()

    if (!ownerAddress || !chainId || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const rows = buildDefaultRules({
      ownerAddress: ownerAddress.toLowerCase(),
      chainId,
      agentId,
    })

    const { data, error } = await supabaseAdmin
      .from('alert_rules')
      .upsert(rows, { onConflict: 'chain_id,agent_id,rule_type' })
      .select()

    if (error) {
      console.error('Alert rules init error:', error)
      return NextResponse.json(
        { error: 'Failed to create alert rules' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rules: data })
  } catch (err) {
    console.error('Alert rules error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: toggle rule enabled/disabled or set webhook URL
export async function PATCH(req: NextRequest) {
  try {
    const { ruleId, enabled, webhookUrl } = await req.json()

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Missing ruleId' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof enabled === 'boolean') updates.enabled = enabled
    if (typeof webhookUrl === 'string') updates.webhook_url = webhookUrl || null

    const { data, error } = await supabaseAdmin
      .from('alert_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ rule: data })
  } catch (err) {
    console.error('Alert rules patch error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 2: Write webhook test endpoint**

```typescript
// src/app/api/alerts/webhook-test/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { webhookUrl } = await req.json()

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing webhookUrl' },
        { status: 400 }
      )
    }

    const testPayload = {
      incident: {
        id: 'test-00000000',
        signalKind: 'reputation_drop',
        severity: 'warning',
        title: 'Test Alert — DenScope',
        description: 'This is a test alert from DenScope.',
        whyItMatters: 'You configured webhook alerts for your agent.',
      },
      agent: { chainId: 42220, agentId: 0 },
      timestamp: new Date().toISOString(),
      consoleUrl: 'https://denscope.vercel.app/console',
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })

    return NextResponse.json({
      success: res.ok,
      status: res.status,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook send failed' },
      { status: 500 }
    )
  }
}
```

**Step 3: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds, new API routes visible.

**Step 4: Commit**

```bash
git add src/app/api/alerts/rules/route.ts src/app/api/alerts/webhook-test/route.ts
git commit -m "feat: add alert rules CRUD and webhook test endpoints"
```

---

## Task 8: Zustand Stores (Incidents + Alerts)

**Files:**
- Create: `src/stores/incidents.ts`
- Create: `src/stores/alerts.ts`
- Test: `src/stores/__tests__/incidents.test.ts`

**Step 1: Write failing test**

```typescript
// src/stores/__tests__/incidents.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useIncidentStore } from '@/stores/incidents'
import type { Incident } from '@/types/incidents'

const mockIncident: Incident = {
  id: 'test-1',
  chainId: 42220,
  agentId: 5,
  signalKind: 'reputation_drop',
  severity: 'warning',
  title: 'Test',
  description: 'Test incident',
  whyItMatters: 'Test',
  triggeredAt: '2026-02-16T00:00:00Z',
  metadata: {},
}

describe('useIncidentStore', () => {
  beforeEach(() => {
    useIncidentStore.getState().clear()
  })

  it('starts empty', () => {
    expect(useIncidentStore.getState().incidents).toEqual([])
  })

  it('sets incidents', () => {
    useIncidentStore.getState().setIncidents([mockIncident])
    expect(useIncidentStore.getState().incidents).toHaveLength(1)
  })

  it('pushes a new incident to the front', () => {
    useIncidentStore.getState().setIncidents([mockIncident])
    const newIncident = { ...mockIncident, id: 'test-2', title: 'New' }
    useIncidentStore.getState().push(newIncident)
    expect(useIncidentStore.getState().incidents[0].id).toBe('test-2')
  })

  it('marks an incident as resolved', () => {
    useIncidentStore.getState().setIncidents([mockIncident])
    useIncidentStore.getState().resolve('test-1')
    const resolved = useIncidentStore.getState().incidents[0]
    expect(resolved.resolvedAt).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/stores/__tests__/incidents.test.ts`
Expected: FAIL — module not found.

**Step 3: Write stores**

```typescript
// src/stores/incidents.ts
import { create } from 'zustand'
import type { Incident } from '@/types/incidents'

type IncidentStoreState = {
  incidents: Incident[]
  setIncidents: (incidents: Incident[]) => void
  push: (incident: Incident) => void
  resolve: (incidentId: string) => void
  clear: () => void
}

export const useIncidentStore = create<IncidentStoreState>()((set) => ({
  incidents: [],

  setIncidents: (incidents) => set({ incidents }),

  push: (incident) =>
    set((state) => ({
      incidents: [incident, ...state.incidents],
    })),

  resolve: (incidentId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId
          ? { ...i, resolvedAt: new Date().toISOString() }
          : i
      ),
    })),

  clear: () => set({ incidents: [] }),
}))
```

```typescript
// src/stores/alerts.ts
import { create } from 'zustand'
import type { AlertRule } from '@/types/alerts'

type AlertStoreState = {
  rules: AlertRule[]
  setRules: (rules: AlertRule[]) => void
  updateRule: (ruleId: string, updates: Partial<AlertRule>) => void
  clear: () => void
}

export const useAlertStore = create<AlertStoreState>()((set) => ({
  rules: [],

  setRules: (rules) => set({ rules }),

  updateRule: (ruleId, updates) =>
    set((state) => ({
      rules: state.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r
      ),
    })),

  clear: () => set({ rules: [] }),
}))
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/stores/__tests__/incidents.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/stores/incidents.ts src/stores/alerts.ts src/stores/__tests__/incidents.test.ts
git commit -m "feat: add incident and alert zustand stores"
```

---

## Task 9: IncidentTimeline Component

**Files:**
- Create: `src/components/console/IncidentTimeline.tsx`

**Step 1: Write the component**

```typescript
// src/components/console/IncidentTimeline.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { fetchIncidentsForOwner } from '@/lib/supabase/incidents'
import { useIncidentStore } from '@/stores/incidents'
import { supabase } from '@/lib/supabase/client'
import { toIncident } from '@/types/incidents'
import type { Incident } from '@/types/incidents'

const SEVERITY_STYLES: Record<string, string> = {
  info: 'status-pill-accent',
  warning: 'status-pill-warning',
  critical: 'status-pill-critical',
}

function IncidentCard({ incident, onResolve }: { incident: Incident; onResolve: (id: string) => void }) {
  const [resolving, setResolving] = useState(false)

  async function handleResolve() {
    setResolving(true)
    const res = await fetch('/api/incidents/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: incident.id }),
    })
    if (res.ok) {
      onResolve(incident.id)
    }
    setResolving(false)
  }

  return (
    <div className="bg-surface border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`status-pill ${SEVERITY_STYLES[incident.severity] ?? 'status-pill-neutral'}`}>
            {incident.severity.toUpperCase()}
          </span>
          <span className="font-mono text-xs text-text-primary font-bold">
            {incident.title}
          </span>
        </div>
        <span className="text-[10px] text-text-muted font-mono">
          {new Date(incident.triggeredAt).toLocaleString()}
        </span>
      </div>
      <p className="text-xs text-text-secondary font-mono">
        {incident.description}
      </p>
      {incident.whyItMatters && (
        <p className="text-xs text-text-muted italic">
          {incident.whyItMatters}
        </p>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-text-muted font-mono">
          Agent #{incident.agentId} &middot; Chain {incident.chainId}
        </span>
        {!incident.resolvedAt ? (
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="text-[10px] font-mono text-accent hover:underline disabled:opacity-50"
          >
            {resolving ? 'Resolving...' : 'Mark Resolved'}
          </button>
        ) : (
          <span className="text-[10px] font-mono text-success">Resolved</span>
        )}
      </div>
    </div>
  )
}

export function IncidentTimeline() {
  const { address } = useAccount()
  const { incidents, setIncidents, push, resolve } = useIncidentStore()
  const [loading, setLoading] = useState(true)

  // Fetch incidents on mount
  useEffect(() => {
    if (!address) return
    fetchIncidentsForOwner(address).then((data) => {
      setIncidents(data)
      setLoading(false)
    })
  }, [address, setIncidents])

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!supabase || !address) return
    const channel = supabase
      .channel('incidents-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          push(toIncident(payload.new))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [address, push])

  if (loading) {
    return <p className="text-xs text-text-muted font-mono">Loading signals...</p>
  }

  if (incidents.length === 0) {
    return (
      <div className="bg-surface border border-border p-8 text-center">
        <p className="text-sm text-text-secondary">No signals detected yet.</p>
        <p className="mt-2 text-xs text-text-muted">
          Signals appear when your agents receive feedback, reputation changes, or validation events.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {incidents.map((incident) => (
        <IncidentCard
          key={incident.id}
          incident={incident}
          onResolve={resolve}
        />
      ))}
    </div>
  )
}
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/console/IncidentTimeline.tsx
git commit -m "feat: add IncidentTimeline component with realtime subscription"
```

---

## Task 10: AlertsPanel Component

**Files:**
- Create: `src/components/console/AlertsPanel.tsx`

**Step 1: Write the component**

```typescript
// src/components/console/AlertsPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useAlertStore } from '@/stores/alerts'
import type { AlertRule } from '@/types/alerts'

const RULE_LABELS: Record<string, { label: string; description: string }> = {
  reputation_drop: {
    label: 'Reputation Drop',
    description: 'Alert when negative feedback exceeds 50%',
  },
  sybil_detected: {
    label: 'Sybil Pattern',
    description: 'Alert when coordinated feedback detected',
  },
  going_cold: {
    label: 'Going Cold',
    description: 'Alert when no feedback in 7 days',
  },
}

function RuleToggle({
  rule,
  onToggle,
}: {
  rule: AlertRule
  onToggle: (ruleId: string, enabled: boolean) => void
}) {
  const label = RULE_LABELS[rule.ruleType] ?? { label: rule.ruleType, description: '' }
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-xs font-mono text-text-primary">{label.label}</p>
        <p className="text-[10px] text-text-muted">{label.description}</p>
      </div>
      <button
        onClick={() => onToggle(rule.id, !rule.enabled)}
        className={`w-10 h-5 rounded-full transition-colors ${
          rule.enabled ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white transition-transform ${
            rule.enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export function AlertsPanel() {
  const { address } = useAccount()
  const { rules, setRules, updateRule } = useAlertStore()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch alert rules
  useEffect(() => {
    if (!address) return
    fetch(`/api/alerts/rules?chainId=42220&agentId=0`)
      .then((r) => r.json())
      .then(({ rules: data }) => {
        // Note: rules might not exist yet, that's OK
        if (data && data.length > 0) {
          setRules(data.map((r: Record<string, unknown>) => ({
            id: r.id,
            ownerAddress: r.owner_address,
            chainId: r.chain_id,
            agentId: r.agent_id,
            ruleType: r.rule_type,
            enabled: r.enabled,
            webhookUrl: r.webhook_url,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })))
          const url = data.find((r: Record<string, unknown>) => r.webhook_url)?.webhook_url
          if (url) setWebhookUrl(url as string)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [address, setRules])

  async function handleToggle(ruleId: string, enabled: boolean) {
    updateRule(ruleId, { enabled })
    await fetch('/api/alerts/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, enabled }),
    })
  }

  async function handleSaveWebhook() {
    setSaving(true)
    for (const rule of rules) {
      await fetch('/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: rule.id, webhookUrl }),
      })
    }
    setSaving(false)
  }

  async function handleTestWebhook() {
    if (!webhookUrl) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/alerts/webhook-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      })
      const data = await res.json()
      setTestResult(data.success ? 'Sent successfully' : `Failed (${data.status})`)
    } catch {
      setTestResult('Send failed')
    }
    setTesting(false)
  }

  if (loading) {
    return <p className="text-xs text-text-muted font-mono">Loading alerts...</p>
  }

  if (rules.length === 0) {
    return (
      <div className="bg-surface border border-border p-5">
        <p className="text-xs text-text-muted font-mono">
          Claim an agent to configure alerts.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border p-5 space-y-4">
      <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono">
        Alert Rules
      </h2>

      <div className="divide-y divide-border">
        {rules.map((rule) => (
          <RuleToggle key={rule.id} rule={rule} onToggle={handleToggle} />
        ))}
      </div>

      <div className="pt-4 border-t border-border space-y-3">
        <label className="text-xs text-text-muted font-mono block">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/..."
          className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveWebhook}
            disabled={saving}
            className="border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-mono text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleTestWebhook}
            disabled={testing || !webhookUrl}
            className="border border-border bg-surface px-3 py-1 text-xs font-mono text-text-secondary hover:border-border-bright transition-colors disabled:opacity-50"
          >
            {testing ? 'Sending...' : 'Test'}
          </button>
          {testResult && (
            <span className="text-[10px] font-mono text-text-muted">{testResult}</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/console/AlertsPanel.tsx
git commit -m "feat: add AlertsPanel with rule toggles and webhook config"
```

---

## Task 11: Update Console Page — Replace M5 Placeholders

**Files:**
- Modify: `src/app/console/page.tsx:32-46`

**Step 1: Replace placeholders with real components**

In `src/app/console/page.tsx`:

1. Add imports at top:
```typescript
import { IncidentTimeline } from '@/components/console/IncidentTimeline'
import { AlertsPanel } from '@/components/console/AlertsPanel'
```

2. Replace lines 32-46 (the M5 placeholder div):
```tsx
          {/* Placeholder sections for M5 */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-2">
                Signals
              </h2>
              <p className="text-xs text-text-muted font-mono">Coming in M5</p>
            </div>
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-2">
                Alerts
              </h2>
              <p className="text-xs text-text-muted font-mono">Coming in M5</p>
            </div>
          </div>
```

With:
```tsx
          {/* Signals Timeline */}
          <div className="mt-10">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
              Signals
            </h2>
            <IncidentTimeline />
          </div>

          {/* Alerts Configuration */}
          <div className="mt-10">
            <AlertsPanel />
          </div>
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/console/page.tsx
git commit -m "feat: replace M5 placeholders with IncidentTimeline and AlertsPanel"
```

---

## Task 12: Notification Badge in Header

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Create: `src/components/console/IncidentBadge.tsx`

**Step 1: Create IncidentBadge component**

```typescript
// src/components/console/IncidentBadge.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { fetchOpenIncidentCount } from '@/lib/supabase/incidents'

export function IncidentBadge() {
  const { address, isConnected } = useAccount()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isConnected || !address) return
    fetchOpenIncidentCount(address).then(setCount)
  }, [isConnected, address])

  if (count === 0) return null

  return (
    <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-critical text-white rounded-full">
      {count > 9 ? '9+' : count}
    </span>
  )
}
```

**Step 2: Add badge next to Console nav link in Header**

In `src/components/layout/Header.tsx`, the navItems array currently has:
```typescript
{ href: '/console', label: 'Console', disabled: false },
```

Add import at top:
```typescript
import { IncidentBadge } from '@/components/console/IncidentBadge'
```

In the nav rendering loop, after the label text for Console, add the badge. Find the `<Link>` rendering and modify the Console link:

Replace the nav link rendering (the existing code renders `{item.label}` inside the Link). After `{item.label}`, add conditionally:
```tsx
{item.href === '/console' && <IncidentBadge />}
```

Specifically, update the Link content from:
```tsx
{item.label}
{isActive && (
```

To:
```tsx
{item.label}
{item.href === '/console' && (
  <span className="ml-1"><IncidentBadge /></span>
)}
{isActive && (
```

**Step 3: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/console/IncidentBadge.tsx src/components/layout/Header.tsx
git commit -m "feat: add incident notification badge to Console nav link"
```

---

## Task 13: Extend Edge Function with Signal Detection

**Files:**
- Modify: `supabase/functions/erc8004-poller/index.ts`

**Step 1: Add signal detection after event ingestion**

After line 185 (`for (const e of events) await upsertAgent(db, e)`), add signal detection logic. Since the Edge Function is Deno, we inline the detection functions (can't import from `src/`).

Add these functions before the `pollChain` function:

```typescript
// --- Signal Detection (M5) ---

type SignalResult = {
  chain_id: number
  agent_id: number
  signal_kind: string
  severity: string
  title: string
  description: string
  why_it_matters: string
  source_tx_hash: string | null
  metadata: Record<string, unknown>
}

async function detectSignals(
  db: DB,
  event: ParsedEvent
): Promise<SignalResult[]> {
  const signals: SignalResult[] = []
  const agentKey = `${event.chain_id}:${event.agent_id}`

  // Only detect signals for claimed agents
  const { data: owner } = await db
    .from('owner_profiles')
    .select('id')
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .maybeSingle()
  if (!owner) return signals

  // Get agent state
  const { data: agent } = await db
    .from('agents')
    .select('feedback_count, positive_count, negative_count')
    .eq('id', agentKey)
    .single()

  // Rule 1: First Interaction
  if (event.kind === 'feedback' && agent && agent.feedback_count === 1) {
    signals.push({
      chain_id: event.chain_id,
      agent_id: event.agent_id,
      signal_kind: 'first_interaction',
      severity: 'info',
      title: 'First Feedback',
      description: `Agent #${event.agent_id} received its first-ever feedback`,
      why_it_matters: 'Your agent is now visible to clients on the network.',
      source_tx_hash: event.tx_hash,
      metadata: {},
    })
  }

  // Rule 2: Validation Complete
  if (event.kind === 'validation_res') {
    signals.push({
      chain_id: event.chain_id,
      agent_id: event.agent_id,
      signal_kind: 'validation_complete',
      severity: 'info',
      title: 'Validation Complete',
      description: `A validator responded about Agent #${event.agent_id}`,
      why_it_matters: "Validator feedback affects your agent's trust score.",
      source_tx_hash: event.tx_hash,
      metadata: {},
    })
  }

  // Rule 3: Reputation Drop (negative ratio > 50%)
  if (event.kind === 'feedback' && agent && agent.feedback_count >= 3) {
    const negRatio = agent.negative_count / agent.feedback_count
    if (negRatio >= 0.5) {
      const severity = negRatio >= 0.8 ? 'critical' : 'warning'
      signals.push({
        chain_id: event.chain_id,
        agent_id: event.agent_id,
        signal_kind: 'reputation_drop',
        severity,
        title: 'Reputation Drop',
        description: `Agent #${event.agent_id} has ${Math.round(negRatio * 100)}% negative feedback`,
        why_it_matters: 'A high negative feedback ratio may indicate trust issues.',
        source_tx_hash: event.tx_hash,
        metadata: { positive: agent.positive_count, negative: agent.negative_count, total: agent.feedback_count },
      })
    }
  }

  // Rule 4: Feedback Spike (>5 feedbacks in last hour)
  if (event.kind === 'feedback') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('scope_events')
      .select('id', { count: 'exact', head: true })
      .eq('chain_id', event.chain_id)
      .eq('agent_id', event.agent_id)
      .eq('kind', 'feedback')
      .gte('created_at', oneHourAgo)
    if (count && count >= 5) {
      signals.push({
        chain_id: event.chain_id,
        agent_id: event.agent_id,
        signal_kind: 'feedback_spike',
        severity: 'info',
        title: 'Feedback Spike',
        description: `Agent #${event.agent_id} received ${count} feedbacks in the last hour`,
        why_it_matters: 'Unusual activity may indicate growing interest or coordinated behavior.',
        source_tx_hash: event.tx_hash,
        metadata: { count, window_hours: 1 },
      })
    }
  }

  // Rule 5: Sybil Cluster (>3 unique addresses in 1 hour)
  if (event.kind === 'feedback') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentFeedbacks } = await db
      .from('scope_events')
      .select('data')
      .eq('chain_id', event.chain_id)
      .eq('agent_id', event.agent_id)
      .eq('kind', 'feedback')
      .gte('created_at', oneHourAgo)
    if (recentFeedbacks) {
      const addresses = new Set(recentFeedbacks.map((e: { data: { clientAddress?: string } }) => e.data.clientAddress).filter(Boolean))
      if (addresses.size >= 4) {
        signals.push({
          chain_id: event.chain_id,
          agent_id: event.agent_id,
          signal_kind: 'sybil_cluster',
          severity: 'critical',
          title: 'Sybil Pattern Detected',
          description: `${addresses.size} different addresses submitted feedback for Agent #${event.agent_id} in 1h`,
          why_it_matters: 'Coordinated feedback from multiple new accounts may indicate a sybil attack.',
          source_tx_hash: event.tx_hash,
          metadata: { unique_addresses: addresses.size, window_hours: 1 },
        })
      }
    }
  }

  return signals
}

async function insertIncidents(db: DB, signals: SignalResult[]) {
  if (signals.length === 0) return
  const { error } = await db
    .from('incidents')
    .upsert(signals, { onConflict: 'chain_id,agent_id,signal_kind,source_tx_hash', ignoreDuplicates: true })
  if (error) console.error('Incident insert error:', error.message)
}

async function dispatchWebhooks(db: DB, signals: SignalResult[]) {
  for (const signal of signals) {
    // Only dispatch for alertable signal types
    const alertKind = signal.signal_kind === 'reputation_drop' ? 'reputation_drop'
      : signal.signal_kind === 'sybil_cluster' ? 'sybil_detected'
      : null
    if (!alertKind) continue

    const { data: rules } = await db
      .from('alert_rules')
      .select('id, webhook_url')
      .eq('chain_id', signal.chain_id)
      .eq('agent_id', signal.agent_id)
      .eq('rule_type', alertKind)
      .eq('enabled', true)
      .not('webhook_url', 'is', null)

    if (!rules) continue

    for (const rule of rules) {
      if (!rule.webhook_url) continue
      const payload = {
        incident: {
          signalKind: signal.signal_kind,
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          whyItMatters: signal.why_it_matters,
        },
        agent: { chainId: signal.chain_id, agentId: signal.agent_id },
        timestamp: new Date().toISOString(),
        consoleUrl: `https://denscope.vercel.app/console`,
      }

      try {
        const res = await fetch(rule.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        await db.from('webhook_logs').insert({
          incident_id: null, // We don't have the incident UUID here
          webhook_url: rule.webhook_url,
          request_payload: payload,
          response_status: res.status,
        })
      } catch (err) {
        await db.from('webhook_logs').insert({
          incident_id: null,
          webhook_url: rule.webhook_url,
          request_payload: payload,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
}
```

**Step 2: Hook into pollChain**

After the event processing loop (after `for (const e of events) await upsertAgent(db, e)` on line 185), add:

```typescript
    // M5: Signal detection + webhook dispatch
    for (const e of events) {
      const signals = await detectSignals(db, e)
      await insertIncidents(db, signals)
      await dispatchWebhooks(db, signals)
    }
```

**Step 3: Update webhook_logs table** — remove NOT NULL on incident_id

The `webhook_logs.incident_id` was defined as `NOT NULL REFERENCES incidents(id)`, but in the Edge Function we insert webhooks before we have the incident UUID. Update the migration to make it nullable:

In `supabase/migrations/20260216020000_m5_signals.sql`, change:
```sql
  incident_id UUID NOT NULL REFERENCES incidents(id),
```
To:
```sql
  incident_id UUID REFERENCES incidents(id),
```

**Step 4: Redeploy Edge Function**

Run: `supabase functions deploy erc8004-poller --no-verify-jwt`
Run: `supabase db push` (to apply migration change)

**Step 5: Commit**

```bash
git add supabase/functions/erc8004-poller/index.ts supabase/migrations/20260216020000_m5_signals.sql
git commit -m "feat: add signal detection and webhook dispatch to Edge Function"
```

---

## Task 14: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update documentation**

Update these sections in `CLAUDE.md`:

1. **Routes table** — add new routes:
```
| `/api/incidents/resolve` | API | Mark incident as resolved |
| `/api/alerts/rules` | API | Alert rules CRUD (GET/POST/PATCH) |
| `/api/alerts/webhook-test` | API | Test webhook delivery |
```

2. **Supabase tables** — add:
```
`scope_events`, `agents`, `indexer_cursors`, `deploy_blocks`, `owner_profiles`, `incidents`, `alert_rules`, `webhook_logs`
```

3. **Architecture** — add:
```
- `src/lib/signals/` — Signal detection rules (reputation_drop, sybil_cluster, feedback_spike, first_interaction, validation_complete)
```

4. **Stores** — update to include `incidents, alerts`

5. **Testing** — update test count

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with M5 routes, tables, signals"
```

---

## Task 15: Full Test Suite + Build Verification

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass (55 existing + new tests).

**Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds, all new routes visible.

**Step 3: Verify new routes in build output**

Expected routes:
```
├ ƒ /api/alerts/rules
├ ƒ /api/alerts/webhook-test
├ ƒ /api/incidents/resolve
```

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build/test issues from M5 integration"
```
