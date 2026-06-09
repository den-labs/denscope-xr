# Trust Snapshot / Coordination Layer — Product Spec

- **Date:** 2026-05-23
- **Revision:** Rev 3 — second red-team fixes applied (see [Pass 1](./2026-05-23-trust-snapshot-redteam.md), [Pass 2](./2026-05-23-trust-snapshot-redteam-rev2.md))
- **Owner:** wolfcito
- **Status:** Draft (awaiting approval after red-team revision)
- **Surface:** `/agent/[chain]/[id]` (rework) + existing certificate flow (no v2 visual template in MVP)
- **Aligned with:** ADR-001 (trust infra, not explorer), Q2 trust-infrastructure roadmap, denscope-status.md
- **Benchmark:** https://8004scan.io/agents/celo/1870 (Toppa)

## Rev 3 Changelog (latest)

- **N1 (P0):** verdict if/else reordered — critical incidents now override `insufficient-data` to prevent masking safety signals.
- **N2 (P0):** Health band 31d–90d explicitly mapped to `detected`.
- **N3 (P1):** all metadata-dependent badge rules made null-safe (`metadata?.x ?? fallback`).
- **N4 (P1):** `openIncidents` ordering contract documented (severity desc, then openedAt desc).
- **N5 (P1):** `dimensionLabel` map enumerated for all 5 keys.
- **N6 (P1):** Watchout entry templates defined for both incident- and dimension-origin entries.
- **N7 (P1):** Distinct visual treatment for Health-`unknown` vs Convention-`PENDING` (solid muted vs dashed muted).
- **N8 (P1):** Sticky mobile CTA renders only for verdict ∈ {ready, warming-up, caution}.
- **N9 (P2 — kept):** Orchestration order subsection added (§4.10).
- N10–N15: deferred to backlog per Pass 2 recommendation.

## Rev 2 Changelog

- P0-1: removed all invented metadata field detection (OASF/Source/Auth/Docs heuristic). Matrix now ships **5 derivable + 3 PENDING** badges.
- P0-2: Coordination dimension weights redistributed across 5 derivable badges, sum = 100.
- P0-3: verdict derivation rewritten as explicit if/else chain covering all confidence × score combinations.
- P0-4: `primaryWatchout` ordering rule defined + fallback summary template added.
- P0-5: removed `mailto:owner` (field does not exist in `owner_profiles`).
- P1-1..P1-7: applied across §4–§9.
- P2-1..P2-3: added Phase A.0 pre-flight (DS regression + ADR-001 gate + certificate snapshot policy).
- M-1: Trust Certificate v2 scope clarified — existing `AgentCertificateActions` stays in MVP, new visual template explicitly v2.

---

## 1. Executive Summary

DenScope no compite con 8004scan en **explorar** registros ERC-8004. Compite en **interpretar** la confianza de un agente y convertirla en una decisión accionable para founders, partners, builders y agentes autónomos.

Esta entrega rediseña la página de agente en torno a un único artefacto: **Trust Snapshot**, una vista de un vistazo que responde seis preguntas en menos de 5 segundos:

1. ¿Qué tan confiable parece este agente? — *score + verdict + confidence*
2. ¿Por qué deberíamos creerlo? — *one-line summary derivado de reglas explícitas*
3. ¿Qué debo hacer con él? — *recommended action*
4. ¿En qué dimensiones es fuerte/débil? — *radar de 5 dimensiones*
5. ¿Con qué protocolos puede coordinar? — *Coordination Readiness matrix*
6. ¿Qué evidencia respalda todo esto? — *expandible, sin tablas crudas*

Todo se deriva de datos ya indexados (`trust_scores`, `scope_events`, `agents`, `incidents`, `owner_profiles`) más metadata del Agent URI. No se inventa ningún signal. Las dimensiones sin fuente verificable hoy quedan marcadas explícitamente como **v2 / future phase**.

El resultado es shareable, mobile-first, e instrumentable: cada vista emite eventos a `internal/metrics` para validar la tesis del pivot (ADR-001) sin construir más explorer.

---

## 2. Product Thesis

**8004scan es el `etherscan` de ERC-8004.** Excelente para inspeccionar, pero te deja con la pregunta abierta: *¿y ahora qué hago con este agente?*

**DenScope es la capa de coordinación.** Toma los mismos datos y los traduce en:

- Un **verdict** ("Ready to coordinate" / "Needs warm-up" / "Avoid for now")
- Una **recomendación de acción** ("Pair on small task" / "Request KYC" / "Wait 14 days")
- Una **lectura visual** (radar) que un humano no técnico interpreta sin docs
- Un **certificado verificable** que un partner puede pegar en Notion/Slack

> *"The coordination layer for autonomous agents."*

### Diferenciación frente a 8004scan

| Eje | 8004scan | DenScope (este spec) |
|---|---|---|
| Datos crudos | ✅ Tablas, eventos | ❌ Ocultos detrás del verdict |
| Score breakdown numérico | ✅ | ✅ pero secundario al verdict |
| Warnings | ✅ Lista | ✅ Como **Watchouts** narrativos |
| Coordination readiness | ❌ | ✅ Matrix de 8 badges |
| Improvement suggestions | ❌ | ✅ Lista accionable por owner |
| Shareable certificate | ❌ | ✅ Trust Certificate v2 con hash |
| Recommended action | ❌ | ✅ Línea de copy por verdict |
| Radar visual | ❌ | ✅ 5 dimensiones |

### Anti-thesis (qué NO hacemos)

- ❌ Replicar el feedback table (lo enlazamos a 8004scan via `Explorer` link)
- ❌ Inventar signals que no tenemos datos para derivar
- ❌ Mostrar números sin interpretación
- ❌ Construir más páginas (rework de la existente, no nueva ruta)
- ❌ Implementar dimensiones del radar sin regla determinista

---

## 3. Information Architecture

### Layout jerárquico (top-down, mobile-first)

```
/agent/[chain]/[id]
├── [1] Trust Snapshot Hero (full-bleed, sticky en mobile)
│     ├─ Agent identity strip (name, chain, agent#, claimed pill)
│     ├─ Big score (5xl) + verdict + confidence
│     ├─ One-line summary (auto-generated, derived)
│     └─ Recommended action (CTA pill)
│
├── [2] Trust Radar (5 dimensions, SVG)
│     └─ Tap dimension → expands to rules + evidence
│
├── [3] Strengths · Watchouts (two columns desktop, stacked mobile)
│     ├─ Strengths: top 3 dimensiones >= 70
│     └─ Watchouts: dimensiones < 40 o incidents abiertos
│
├── [4] Coordination Readiness Matrix
│     └─ 8 badges grid: A2A · MCP · x402 · OASF · Docs · Health · Source · Auth
│
├── [5] Improvement Suggestions (solo si owner claimed o público con CTA "claim to see all")
│     └─ Lista priorizada P1/P2/P3 con copy ejecutable
│
├── [6] Evidence Drawer (collapsed by default)
│     ├─ Identity Card (Agent ID, Owner, URI, Storage)
│     ├─ Connected Protocols (existing)
│     ├─ Event timeline (existing)
│     └─ Link "View raw on 8004scan ↗"
│
└── [7] Footer actions
      ├─ Mint Trust Certificate v2 (existing flow, new template)
      ├─ Embed snippet (existing)
      └─ Share (copy link, X, Farcaster)
```

### Navegación contextual

- **Sticky header** en mobile con `score + verdict + share` para que el CTA nunca desaparezca.
- **Anchors** (`#radar`, `#coordination`, `#evidence`) para deep-linking desde el certificate.

---

## 4. Data Model & Derivation Rules

### 4.1 Tipo central

```ts
// src/lib/trust-snapshot/types.ts
export type Verdict = 'ready' | 'warming-up' | 'caution' | 'insufficient-data'
export type Confidence = 'low' | 'medium' | 'high'

export interface TrustSnapshotData {
  // Core
  score: number              // 0-100 (from trust_scores.score)
  verdict: Verdict           // derived (table 4.2)
  confidence: Confidence     // from trust_scores.confidence
  summary: string            // one-line, template-driven (table 4.3)
  recommendedAction: {
    label: string            // CTA copy
    intent: 'primary' | 'neutral' | 'caution'
    href?: string            // optional deep link
  }

  // Radar (5 dimensions, each 0-100)
  radar: {
    identity: DimensionResult
    reliability: DimensionResult
    reputation: DimensionResult
    coordination: DimensionResult
    safety: DimensionResult
  }

  strengths: string[]        // max 3, derived from radar >= 70
  watchouts: string[]        // max 3, derived from radar < 40 OR open incidents

  // Coordination matrix (8 badges)
  coordination: {
    a2a: BadgeState
    mcp: BadgeState
    x402: BadgeState
    oasf: BadgeState
    docs: BadgeState
    health: BadgeState
    source: BadgeState
    auth: BadgeState
  }

  improvements: ImprovementSuggestion[]  // priority-ordered

  // Raw incident references (P1-2: needed by improvements template)
  // Contract (N4 fix): sorted by severity desc (critical > warning > info),
  // then by openedAt desc. `fetchTrustSnapshotInputs` MUST guarantee this order.
  openIncidents: Array<{
    id: string
    severity: 'critical' | 'warning' | 'info'
    kind: string
    openedAt: string
  }>
}

export interface DimensionResult {
  value: number              // 0-100
  rule: string               // human-readable rule applied
  evidence: string[]         // pointers (e.g. 'trust_scores.positive_ratio=0.85')
  status: 'derived' | 'partial' | 'unavailable'  // unavailable = future phase
}

export type BadgeState =
  | { state: 'connected'; evidence: string }
  | { state: 'detected'; evidence: string }
  | { state: 'missing' }
  | { state: 'unknown'; reason: string }  // not yet derivable

export interface ImprovementSuggestion {
  priority: 'P1' | 'P2' | 'P3'
  title: string
  body: string
  affectsDimension: keyof TrustSnapshotData['radar']
  action?: { label: string; href: string }
}
```

### 4.2 Verdict derivation (deterministic if/else)

Evaluated **in order** — first match wins. No implicit fallthrough. Covers every (score × confidence × incidents) combination.

```ts
function deriveVerdict(input: {
  score: number | null
  confidence: 'low' | 'medium' | 'high'
  openCriticalIncidents: number
}): Verdict {
  // 1. Safety signal dominates — critical incidents override even "no data" (N1 fix)
  if (input.openCriticalIncidents >= 1) return 'caution'

  // 2. No score at all
  if (input.score === null) return 'insufficient-data'

  // 3. Score-driven verdict with confidence as tiebreaker only at the top
  if (input.score >= 75) {
    return input.confidence === 'high' ? 'ready' : 'warming-up'
  }
  if (input.score >= 50) {
    // P0-3 gap fixed: low confidence at this band → warming-up, not caution
    return 'warming-up'
  }
  return 'caution'
}
```

Resulting matrix (for reference):

| Score | Confidence | Crit. incidents | Verdict |
|---|---|---|---|
| any | any | `>= 1` | `caution` (overrides even null score) |
| `null` | any | 0 | `insufficient-data` |
| `>= 75` | `high` | 0 | `ready` |
| `>= 75` | `medium` | 0 | `warming-up` |
| `>= 75` | `low` | 0 | `warming-up` |
| `50–74` | any | 0 | `warming-up` |
| `< 50` | any | 0 | `caution` |

### 4.3 One-line summary templates (deterministas)

Plantillas seleccionadas por `verdict`, interpoladas con datos reales. Sin generación libre.

- **ready**: `"Active for {ageDays}d with {positiveCount}/{feedbackCount} positive feedback and {connectedProtocols} protocols connected."`
- **warming-up**: `"Newer agent ({ageDays}d) with {feedbackCount} feedback{plural}. Track record building."`
- **caution (primary)**: `"{primaryWatchout}. Recommend additional review before coordination."`
- **caution (fallback, no specific watchout)**: `"Trust score {score}/100. Review evidence before coordination."`
- **insufficient-data**: `"Agent registered {ageDays}d ago. No feedback yet — too early to score."`

`{connectedProtocols}` is the count of A2A + MCP + x402 badges in `state: 'connected'` (0–3).

#### 4.3.1 `primaryWatchout` ordering rule

Evaluated in order — first match wins. Used by the `caution` summary template.

1. Open critical incident → `"Open critical incident ({kind})"`
2. Open warning incident → `"Open warning incident ({kind})"`
3. Lowest radar dimension with `value < 40` → `"Low {dimensionLabel} score ({value}/100)"`
4. Confidence is `low` AND feedback count < 3 → `"Insufficient feedback to validate score"`
5. None of the above → `null` (template falls back to the "no specific watchout" form)

**`dimensionLabel` map** (N5 fix) — used by step 3 above and by Watchouts entries:

| key | label |
|---|---|
| `identity` | `"Identity completeness"` |
| `reliability` | `"Service reliability"` |
| `reputation` | `"Reputation quality"` |
| `coordination` | `"Coordination readiness"` |
| `safety` | `"Safety / integrity"` |

Tie-breaker when multiple dimensions share the same `value < 40`: canonical order `identity > reliability > reputation > coordination > safety`.

### 4.4 Recommended action map

| Verdict | Label | Intent | Href |
|---|---|---|---|
| `ready` | `"Pair on coordinated task"` | primary | `#coordination` (scrolls to matrix) |
| `warming-up` | `"Start with small interaction"` | neutral | `#coordination` |
| `caution` | `"Request additional verification"` | caution | `#evidence` |
| `insufficient-data` | `"Check back after first interactions"` | neutral | `#evidence` |

> **P0-5 fix:** removed `mailto:owner` — `owner_profiles` has no email column. Owner contact is **not yet derivable**. A v2 phase may introduce optional contact metadata via claim flow.

### 4.5 Radar dimensions — reglas de cálculo

Todas las reglas son **deterministas**, derivadas de datos ya indexados. Cualquier sub-componente sin fuente queda marcado `status: 'partial' | 'unavailable'`.

#### 4.5.1 Identity Completeness (0-100)

| Component | Weight | Derived from | Status |
|---|---|---|---|
| Has on-chain URI | 20 | `readAgentURI() !== null` | derived |
| URI resolves | 15 | `fetchAgentMetadataServer()` ok | derived |
| Has name + description | 15 | `metadata.name && metadata.description` | derived |
| Has image | 10 | `metadata.image !== undefined` | derived |
| Has owner resolved | 10 | `readAgentOwner() !== null` | derived |
| Claimed | 15 | `owner_profiles` row exists | derived |
| Declares services | 15 | `metadata.services.length > 0` | derived |

`value = Σ(active components × weight)` clamped 0-100.

#### 4.5.2 Service Reliability (0-100)

| Component | Weight | Derived from | Status |
|---|---|---|---|
| Agent age normalized | 25 | `min(ageDays / 90, 1.0) × 25` | derived |
| URI stability | 25 | `1 - min(uri_update_count / 5, 1.0)` × 25 | derived |
| Event recency | 25 | last 30d events > 0 → 25; else linear decay | derived |
| Validation events | 25 | count of `validation_complete` signals / target=3 | derived |

#### 4.5.3 Reputation Quality (0-100)

Map directo del Trust Score v1 con foco en feedback:

| Component | Weight | Derived from |
|---|---|---|
| Positive ratio | 60 | `trust_scores.positive_ratio × 60` |
| Feedback volume | 25 | `min(feedback_count / 10, 1.0) × 25` |
| Confidence bump | 15 | `confidence === 'high' ? 15 : medium ? 10 : 0` |

#### 4.5.4 Coordination Readiness (0-100)

Suma ponderada de los **5 badges derivables** (ver §4.6). OASF, Source y Auth quedan **fuera** de la fórmula v1 hasta que exista convención (P0-1, P0-2). Total = 100.

| Component | Weight | Source |
|---|---|---|
| A2A connected | 25 | `metadata.services.some(s => s.type.toUpperCase() === 'A2A')` |
| MCP connected | 25 | same with `'MCP'` |
| x402 connected | 20 | same with `'X402'` |
| Docs present | 10 | `metadata.description.length > 0` (presence only — no heuristic length) |
| Health active | 20 | `lastSeen` within 7d |

`value = Σ(active components × weight)` clamped 0-100. Dimension can reach 100 with v1 data.

#### 4.5.5 Safety / Integrity (0-100)

Comienza en 100, restas penalties. **No bonuses** — storage choice is orthogonal to safety (P1-3 fix); surfaced as a neutral fact in Evidence drawer instead.

| Penalty | Trigger | Subtract |
|---|---|---|
| Open critical incident | `incidents.severity='critical' && status='open'` | 40 each (cap 80) |
| Open warning incident | `severity='warning' && status='open'` | 15 each (cap 45) |
| Sybil signal ever | any `sybil_cluster` event | 20 |
| Recent reputation drop | `reputation_drop` in last 30d | 25 |

`value = max(100 - Σ penalties, 0)`.

### 4.6 Coordination Readiness Matrix — 5 derivable + 3 PENDING

P0-1 fix: **no invented field names**. Only badges with a clear, existing data source ship in v1. The three with no convention render as `PENDING` placeholders and do not contribute to the Coordination dimension score.

#### v1 derivable (5)

All metadata-dependent rules are **null-safe** (N3 fix): when `metadata === null` (URI did not resolve), all four metadata-dependent badges (A2A, MCP, x402, Docs) render as `missing`. Health depends on event data, not metadata.

| Badge | Derivation rule (null-safe) | States |
|---|---|---|
| **A2A** | `metadata?.services?.some(s => s.type.toUpperCase() === 'A2A') ?? false` | connected / missing |
| **MCP** | same with `'MCP'` | connected / missing |
| **x402** | same with `'X402'` | connected / missing |
| **Docs** | `(metadata?.description?.length ?? 0) > 0` (presence only) | connected / missing |
| **Health** | see tri-state below | connected / detected / missing / unknown |

#### Health badge — tri-state (P1-4 + N2 fix)

Evaluated in order — first match wins. `lastSeen` is the timestamp of the most recent event.

| Condition | State | Copy |
|---|---|---|
| `totalEvents < 5` | `unknown` | `"Not enough activity to assess"` |
| `lastSeen` within `7d` | `connected` | `"Active"` |
| `lastSeen` within `30d` (not within `7d`) | `detected` | `"Recent activity"` |
| `lastSeen` within `31d–90d` (N2 fix) | `detected` | `"Recent activity"` |
| `lastSeen > 90d` | `missing` | `"Stale"` |
| `lastSeen === null` AND `totalEvents >= 5` | `missing` | `"Stale"` |

#### Visual treatment for "unknown" — two flavors (N7 fix)

The matrix has two semantically distinct "unknown-ish" states. They must render differently:

| State | Visual | Tooltip | Meaning |
|---|---|---|---|
| Health `unknown` | **Solid muted** badge with `?` icon | `"Not enough activity to assess"` | Agent-specific — fixable as the agent accumulates events |
| Convention `PENDING` (OASF/Source/Auth) | **Dashed-border muted** badge with `?` icon | `"Convention pending — not yet derivable"` | Schema-level — fixable only when DenLabs publishes a convention |

A glance must convey the difference. Tooltip provides the precise reason on hover/focus.

#### v2 PENDING (3) — no detection rule until convention exists

| Badge | Why PENDING | v2 trigger |
|---|---|---|
| **OASF** | No standardized OASF field in agent metadata today | OASF schema rev published + ≥1 agent adopts |
| **Source** | No OSS-link convention agreed | DenLabs proposes `agent-metadata-v1.md` convention + 2+ agents adopt |
| **Auth** | No auth-declaration convention agreed | same |

PENDING badges always render with muted styling + tooltip `"Convention pending — not yet derivable. See agent-metadata-v1 proposal."` They count as **0** in the Coordination dimension formula (§4.5.4). **No inventamos.**

### 4.7 Improvement suggestions — generación

Determinista, plantilla por dimensión. Incident IDs vienen de `openIncidents` (§4.1, P1-2 fix).

- Si `identity.value < 70` y falta name → `P1: "Add a human-readable name in your Agent URI metadata"`
- Si `identity.value < 70` y no claimed → `P1: "Claim this agent via /console to unlock owner features"`
- Si `coordination.a2a.state === 'missing'` → `P2: "Declare A2A service in metadata.services to enable agent-to-agent coordination"`
- Si `openIncidents` contiene `severity === 'critical' && status === 'open'` → `P1: "Resolve open incident #{openIncidents[0].id} via Owner Console"` (uses real ID from type)
- Si `reputation.feedbackCount < 5` → `P3: "Encourage early adopters to leave validation feedback"`

Máximo 5 sugerencias visibles. Las restantes detrás de "Show all".

For **non-claimed** agents (public view), the section renders **expanded by default** (M-3 fix) so the differentiating value of DenScope is immediately visible. For claimed agents viewed by the owner, the section can be collapsed (they already know).

### 4.8 Strengths / Watchouts ordering and empty states (P1-1 fix)

**Strengths** (1-3 items shown):
- Source: dimensions with `value >= 70`, sorted **descending** by value.
- Tiebreaker: canonical dimension order — `identity > reliability > reputation > coordination > safety`.
- Empty state: if 0 dimensions qualify, **hide the container** (no placeholder row).

**Watchouts** (1-3 items shown):
- Source: dimensions with `value < 40` OR each open incident, sorted **ascending** by value (lowest first), incidents take precedence.
- Tiebreaker: same canonical dimension order.
- Empty state: if 0 watchouts exist, **hide the container**.

**Watchout entry copy templates** (N6 fix):

| Origin | Template |
|---|---|
| Open critical incident | `"Open critical incident: {kind}"` |
| Open warning incident | `"Open warning incident: {kind}"` |
| Low radar dimension | `"Low {dimensionLabel} ({value}/100)"` (uses §4.3.1 label map) |

**Strengths entry copy templates** (matching format):

| Origin | Template |
|---|---|
| High radar dimension (≥ 70) | `"Strong {dimensionLabel} ({value}/100)"` |

### 4.9 Hero score canonicality rule (P1-5 fix)

The **hero score is the single canonical trust number**. Radar dimensions are interpretive; they are never aggregated into a new total or compared head-to-head. The radar panel includes visible copy:

> *"Dimensions interpret the score above — they do not replace it."*

This prevents the "two competing scores" UX failure and keeps Trust Score v1 as the authoritative artifact.

### 4.10 Build orchestration order (N9 fix)

`buildTrustSnapshot(inputs)` must execute derivation in this exact order — each step depends on outputs of the previous ones:

1. **Coordination badges** (§4.6) — pure function of `metadata + events + lastSeen`.
2. **Radar dimensions** (§4.5.1–4.5.5) — Coordination dim depends on badges.
3. **Verdict** (§4.2) — depends on `score + confidence + openCriticalIncidents`.
4. **primaryWatchout** (§4.3.1) — depends on radar + incidents + confidence.
5. **Summary** (§4.3) — depends on verdict + primaryWatchout + badge counts (`connectedProtocols`).
6. **Strengths / Watchouts** (§4.8) — depend on radar values + incidents.
7. **Improvements** (§4.7) — depend on radar + openIncidents + claim state.

The orchestrator is a single pure function. No I/O inside. All inputs come from `fetchTrustSnapshotInputs()` (§8 B1).

### 4.11 Sticky mobile CTA visibility (N8 fix)

The mobile sticky header renders the CTA row **only** when verdict ∈ {`ready`, `warming-up`, `caution`}. For `insufficient-data`, the sticky shows `score + verdict pill` only — no CTA row, because `"Check back after first interactions"` is informational and wastes scarce mobile real estate.

---

## 5. Wireframe (textual)

### 5.1 Desktop (≥ 768px) — full layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER (existing nav)                                                │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│ HERO  ─────────────────────────────────────────────  [Share][Mint]  │
│                                                                      │
│   Toppa (Agent #1870)   [Celo] [ACTIVE] [CLAIMED]                   │
│   ───────────────────                                                │
│                                                                      │
│   ╔══════════╗   ┌──────────── VERDICT ────────────┐                │
│   ║          ║   │ ⬢ READY TO COORDINATE           │                │
│   ║   87     ║   │   confidence: HIGH               │                │
│   ║   /100   ║   │                                  │                │
│   ╚══════════╝   │ "Active 142d with 18/21         │                │
│                  │  positive feedback and 3         │                │
│                  │  protocols connected."           │                │
│                  │                                  │                │
│                  │ ▶ Pair on coordinated task      │                │
│                  └──────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
┌────────────────── TRUST RADAR ────────────────────────────────────────┐
│                                                                       │
│                    Identity (92)                                       │
│                         •                                              │
│                       / | \                                            │
│       Safety (78) •──/──+──\──• Reliability (84)                       │
│                     /   |   \                                          │
│                    /    |    \                                         │
│   Coordination (71)•────+────• Reputation (89)                         │
│                                                                       │
│   [tap dimension to expand rule + evidence]                            │
└───────────────────────────────────────────────────────────────────────┘
┌──────────── STRENGTHS ──────────┐  ┌─────────── WATCHOUTS ───────────┐
│ ✓ Strong positive feedback ratio │  │ ⚠ No OASF schema declared      │
│ ✓ Mature on-chain history (142d) │  │ ⚠ Authentication not exposed   │
│ ✓ 3 coordination protocols       │  │                                 │
└──────────────────────────────────┘  └─────────────────────────────────┘
┌─────────────── COORDINATION READINESS ───────────────────────────────┐
│                                                                       │
│  [A2A ✓]  [MCP ✓]  [x402 ✓]  [Docs ✓]                                 │
│  [Health ✓]  [OASF ?]  [Source ?]  [Auth ?]                           │
│                                                                       │
│  Legend: ✓ connected  • detected  — missing  ? convention pending     │
│  "Dimensions interpret the score above — they do not replace it."     │
└───────────────────────────────────────────────────────────────────────┘
┌─────────────── IMPROVEMENT SUGGESTIONS ───────────────────────────────┐
│  P1  Add OASF schema declaration to metadata                          │
│      → unblocks Coordination dimension +20                            │
│  P2  Expose authentication method                                     │
│  P3  Add repository link in metadata.source                           │
│      [Show all suggestions]                                           │
└───────────────────────────────────────────────────────────────────────┘
┌─────────────── EVIDENCE (collapsed) ▾ ────────────────────────────────┐
│  [Identity Card] [Connected Protocols] [Timeline] [View on 8004scan ↗]│
└───────────────────────────────────────────────────────────────────────┘
```

### 5.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ STICKY HEADER                 │
│ Toppa · Agent #1870           │
│ ⬢ 87/100  READY               │
│ [▶ Pair on coordinated task]  │  ← P1-6: CTA, no Share duplication
├──────────────────────────────┤
│ HERO                          │
│ Toppa (Agent #1870)           │
│ [Celo] [ACTIVE] [CLAIMED]     │
│                               │
│ ┌──────────┐                  │
│ │   87     │                  │
│ │  /100    │                  │
│ └──────────┘                  │
│ READY TO COORDINATE           │
│ confidence: HIGH              │
│                               │
│ "Active 142d with 18/21       │
│ positive feedback and 3       │
│ protocols connected."         │
│                               │
│ ▶ Pair on coordinated task   │
├──────────────────────────────┤
│ RADAR (SVG, full-width)       │
├──────────────────────────────┤
│ STRENGTHS                     │
│ ✓ ...                         │
├──────────────────────────────┤
│ WATCHOUTS                     │
│ ⚠ ...                         │
├──────────────────────────────┤
│ COORDINATION (2-col grid)     │
│ [A2A ✓]   [MCP ✓]             │
│ [x402 ✓]  [Docs ✓]            │
│ [Health ✓][OASF ?]            │
│ [Source ?][Auth ?]            │
├──────────────────────────────┤
│ IMPROVEMENTS (collapsed)      │
│ ▾ 3 suggestions               │
├──────────────────────────────┤
│ EVIDENCE (collapsed)          │
│ ▾ Identity, Protocols, Events │
├──────────────────────────────┤
│ FOOTER ACTIONS                │
│ [Mint Certificate]            │
│ [Embed] [Share]               │
└──────────────────────────────┘
```

---

## 6. Copy UX (English, accionable)

### Verdict labels
- `ready` → **"Ready to coordinate"**
- `warming-up` → **"Warming up — track record building"**
- `caution` → **"Proceed with caution"**
- `insufficient-data` → **"Too early to assess"**

### Confidence
- `high` → **"High confidence"** (≥10 feedbacks)
- `medium` → **"Medium confidence"** (3-9)
- `low` → **"Low confidence"** (0-2)

### CTAs
- Primary: **"Pair on coordinated task"**
- Neutral: **"Start with small interaction"** · **"Check back later"**
- Caution: **"Request additional verification"**

### Section headers (compact, technical)
- `TRUST RADAR` · `COORDINATION READINESS` · `STRENGTHS` · `WATCHOUTS` · `IMPROVE` · `EVIDENCE`

### Badge states
- `connected` → green pill `CONNECTED`
- `detected` → accent pill `DETECTED`
- `missing` → neutral pill `—`
- `unknown` → muted pill `PENDING` with tooltip

### Empty / null states
- Sin score: `"This agent hasn't received its first poll yet."`
- Sin metadata: `"Agent URI did not resolve. Identity score reflects limited data."`
- Sin feedback: `"No validation feedback yet."`

---

## 7. MVP vs v2

### 7.1 MVP (this spec, ~5 días)

| Item | Status |
|---|---|
| Hero rework (score · verdict · summary · CTA) | ✅ build |
| Trust Radar SVG (5 dimensiones) | ✅ build |
| Strengths · Watchouts (ordered + empty states per §4.8) | ✅ build |
| Coordination Readiness Matrix (5 derivable + 3 PENDING — §4.6) | ✅ build |
| Improvement Suggestions (template-driven, P1-P3, expanded for non-claimed) | ✅ build |
| Evidence drawer (reuso de componentes existentes) | ✅ build |
| Mobile sticky header with CTA (no Share — §5.2) | ✅ build |
| **Trust Certificate (existing flow)** — `AgentCertificateActions` re-used as-is | ✅ ship | 
| Instrumentation events (radar interactions, CTA clicks) | ✅ build |
| Tests unitarios de derivación (coverage cases — §9, not arbitrary count) | ✅ build |

**M-1 clarification (Trust Certificate):** The existing certificate flow (`AgentCertificateActions` + `findLatestSnapshot` + OG generation) is preserved untouched in MVP. The user-facing "Trust Certificate v2" requirement is satisfied by exposing the same flow with the new hero copy (verdict + summary) feeding the OG render. A **new visual template** for certificate cards is explicitly **out of MVP** and moves to v2.

### 7.2 v2 (gated by ADR-001 demand metrics)

| Item | Gating condition |
|---|---|
| Trust Certificate v2 visual template (basalt frost, share-friendly) | Trust Cert mints > baseline |
| OASF badge automation | OASF schema rev published + adoption seen |
| Auth badge convention | DenLabs proposes spec + 2+ agents adopt |
| Source badge convention | same |
| Service Reliability deep dive (probing endpoints) | API call volume justifies infra cost |
| Comparative view (vs peer agents) | explicit user request (NOT auto-built — ADR-001 anti-leaderboard) |
| Off-chain probing for Health (uptime monitor) | >5 owners request it |

### 7.3 Explicitly out of scope

- ❌ Replicar tabla de feedback (link a 8004scan)
- ❌ Agent comparison / leaderboard (ADR-001)
- ❌ New navigation entry (rework, not new page)
- ❌ Multichain expansion (ADR-001 gating)

---

## 8. Implementation Plan (tareas concretas)

### Phase A.0 — Pre-flight (BLOCKING — no code until these clear) — Day 0

These are gating checks. If any fails, Phase A does not start until resolved.

- **A.0.1 — DS v1.1 regression check (P2-1):** Read `denscope_design_system_status.md` and `globals.css`. Confirm DS v1.1 visual regression is resolved. If not, fix DS first or pin Phase C to wait.
- **A.0.2 — ADR-001 Phase 0 gate (P2-2):** Read latest `docs/roadmap/decisions/*.md`. Confirm current Phase permits agent-page rework. Cite specific decision in PR description.
- **A.0.3 — Certificate snapshot integrity policy (P2-3):** Decide and document: do existing certificate snapshots get invalidated, or does the certificate render route version itself so old hashes render the old layout? Decision goes in PR description and `docs/decisions/`.
- **A.0.4 — Confirm `dossier.uriUpdateCount`, `dossier.feedbackCount`, `incidents` query shapes** match the spec assumptions. Read `src/lib/dossier/fetch.ts` and `src/lib/supabase/incidents.ts` to verify.
  - **Verified 2026-05-23:** All dossier fields match. One patch: `avgFeedbackValue: number` (not `number | null`) — defaults to `0`.
  - **Phase B addendum:** need new helper `fetchOpenIncidents(chainId, agentId): Promise<OpenIncident[]>` filtered by `resolved_at IS NULL`, returning `{id, severity, kind, openedAt}` sorted by severity desc, openedAt desc (N4 contract). Existing `fetchIncidents` returns all (resolved + open) and is unsuitable.

### Phase A — Schemas + pure logic (TDD, no UI) — Day 1

1. **A1.** `src/lib/trust-snapshot/types.ts` — definir todos los types de §4.1 con Zod schemas
2. **A2.** `src/lib/trust-snapshot/verdict.ts` — `deriveVerdict(trustScore, openIncidents)` puro + tests
3. **A3.** `src/lib/trust-snapshot/summary.ts` — `buildSummary(verdict, data)` puro + tests
4. **A4.** `src/lib/trust-snapshot/radar/` — un archivo por dimensión:
   - `identity.ts` + tests
   - `reliability.ts` + tests
   - `reputation.ts` + tests
   - `coordination.ts` + tests
   - `safety.ts` + tests
5. **A5.** `src/lib/trust-snapshot/coordination-badges.ts` — `deriveBadges(metadata, events)` + tests
6. **A6.** `src/lib/trust-snapshot/improvements.ts` — `suggestImprovements(snapshot)` priorizado + tests
7. **A7.** `src/lib/trust-snapshot/build.ts` — orquestador `buildTrustSnapshot(inputs): TrustSnapshotData` + tests integrales

**Verificación:** `pnpm test src/lib/trust-snapshot/` → ≥30 tests verdes.

### Phase B — Server data fetching — Day 2

8. **B1.** Extender `src/lib/dossier/fetch.ts` con `fetchTrustSnapshotInputs()` (score + dossier + metadata + incidents en un solo round-trip)
9. **B2.** Helper `getTrustSnapshot(chainId, agentId)` que combine `fetchTrustSnapshotInputs` + `buildTrustSnapshot`
10. **B3.** Tests de integración con fixtures (mock Supabase responses)

### Phase C — UI components — Days 3-4

11. **C1.** `src/components/agent/trust-snapshot/HeroBlock.tsx` (score + verdict + summary + CTA) — client component, props serializables
12. **C2.** `src/components/agent/trust-snapshot/TrustRadar.tsx` — SVG nativo, sin librería (pentágono regular + polígono de datos), accesible (`role="img"` + `aria-label`)
13. **C3.** `src/components/agent/trust-snapshot/StrengthsWatchouts.tsx`
14. **C4.** `src/components/agent/trust-snapshot/CoordinationMatrix.tsx`
15. **C5.** `src/components/agent/trust-snapshot/ImprovementList.tsx` (collapsed by default)
16. **C6.** `src/components/agent/trust-snapshot/EvidenceDrawer.tsx` (wrap de existing Identity Card + Protocols + Timeline)
17. **C7.** `src/components/agent/trust-snapshot/MobileStickyHeader.tsx`

### Phase D — Page integration — Day 4

18. **D1.** Reescribir `src/app/agent/[chain]/[id]/page.tsx`:
    - Llamar `getTrustSnapshot()` server-side
    - Renderizar nuevo layout en orden §3
    - Preservar `AgentClaimSection`, `AgentCertificateActions`, `EmbedSnippet`
19. **D2.** Migrar `<TrustSnapshot />` antiguo → renombrar a `<LegacyTrustSnapshot />` y eliminar uso (no romper imports)
20. **D3.** Verificar SSR — radar SVG debe ser server-renderable (sin `window`)

### Phase E — Instrumentation + tests E2E — Day 5

21. **E1.** Emitir eventos a `internal/metrics`:
    - `snapshot_view` (chain, agentId, verdict)
    - `radar_dimension_click` (dimension)
    - `cta_click` (intent)
    - `evidence_expand`
22. **E2.** Playwright e2e: `e2e/trust-snapshot.spec.ts` — render, verdict pill visible, radar SVG presente, mobile sticky funciona
23. **E3.** Visual regression con `pnpm ui:shots` para hero + radar

### Phase F — Documentation + ship — Day 5

24. **F1.** Actualizar `docs/denscope-status.md`
25. **F2.** Crear PR feature branch → squash merge automerge
26. **F3.** Deploy verificación: visitar Toppa en prod, capturar screenshot, comparar con benchmark

---

## 9. Acceptance Criteria

La entrega se acepta si y solo si:

- [ ] La página `/agent/celo/1870` (Toppa) renderiza el nuevo layout con verdict, summary, radar y matrix sin tabla cruda visible above-the-fold
- [ ] El **verdict** se deriva correctamente para los 4 estados (`ready`, `warming-up`, `caution`, `insufficient-data`) — cubierto por tests
- [ ] El **summary** usa las plantillas exactas de §4.3 con datos reales interpolados
- [ ] El **radar** renderiza 5 dimensiones, cada una con su `rule` legible al expandir
- [ ] Las 5 dimensiones tienen al menos un test que verifica `value` ∈ [0, 100]
- [ ] La **Coordination Matrix** muestra 8 badges total: 5 derivables (A2A, MCP, x402, Docs, Health) + 3 PENDING (OASF, Source, Auth) con tooltip explícito
- [ ] **Improvements** muestra máximo 5 sugerencias P1>P2>P3 ordenadas; expandidas por defecto en vista no-claimed
- [ ] **Mobile sticky header** aparece al hacer scroll y mantiene Score+Verdict+CTA (no Share)
- [ ] El layout es legible sin scroll horizontal en viewport 375px
- [ ] No hay datos inventados — los 3 PENDING jamás muestran "connected" en v1
- [ ] **P0-3 verdict coverage:** tests cubren los 7 casos del matrix (insufficient-data, caution-by-incident, ready, warming-up high/med/low confidence, caution-by-score)
- [ ] **P0-4 summary fallback:** test cubre `caution` sin watchout primario → usa template fallback
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pasan limpio
- [ ] **Test coverage cases (P1-7 — no count target):** Each radar dimension covers (zero-data, partial-data, edge values 0 and 100, Toppa fixture). Verdict covers each row. Summary covers each template + fallback. Tests added: organic count from cases, not from quota.
- [ ] ≥1 Playwright e2e cubre render + verdict pill + radar SVG + mobile sticky CTA
- [ ] Eventos de instrumentation se registran en `internal/metrics` al menos para `snapshot_view` y `cta_click`
- [ ] Existing `EmbedSnippet`, `AgentClaimSection`, `AgentCertificateActions`, `AgentEventTimeline` siguen funcionando sin regresión
- [ ] **Certificate snapshot policy (P2-3) documentado y aplicado:** decisión de invalidation vs versioning hecha en Phase A.0.3 está implementada
- [ ] Hero canonicality copy visible: *"Dimensions interpret the score above — they do not replace it."*
- [ ] PR squash-merged con branch eliminada (workflow rule)

---

## 10. QA Checklist (manual, pre-merge)

### Functional
- [ ] Visit `/agent/celo/1870` — verdict = `ready` o `warming-up`, no `caution` falso positivo
- [ ] Visit un agente sin feedback — verdict = `insufficient-data`, summary = "Agent registered Xd ago…"
- [ ] Visit un agente con incident crítico abierto — verdict se fuerza a `caution`, watchout aparece con kind del incidente
- [ ] **N1 check:** agente con `score=null` AND critical incident abierto → verdict = `caution` (NOT `insufficient-data`)
- [ ] Visit un agente con score 60 y confidence `low` — verdict = `warming-up` (NO `caution`, P0-3)
- [ ] Visit un agente score < 50 sin incidentes y sin watchouts → summary usa fallback `"Trust score X/100. Review evidence before coordination."` (P0-4)
- [ ] **N2 check:** agente con `lastSeen` entre 31d–90d AND `totalEvents ≥ 5` → Health badge = `detected` (no undefined)
- [ ] **N3 check:** agente con URI que no resuelve (`metadata === null`) → A2A/MCP/x402/Docs todos `missing`, sin crashes
- [ ] **N7 check:** Health-`unknown` y Convention-`PENDING` se distinguen visualmente (solid muted vs dashed-border muted)
- [ ] **N8 check:** mobile sticky en agente `insufficient-data` NO muestra CTA row; solo score + verdict pill
- [ ] Tap cada dimensión del radar → expande rule + evidence
- [ ] Tap CTA "Pair on coordinated task" → scroll a `#coordination` (no `mailto:`, P0-5)
- [ ] Coordination badges A2A/MCP/x402 reflejan `metadata.services` correctamente
- [ ] Badge Docs es `connected` si `metadata.description.length > 0` (presence-only)
- [ ] Health badge tri-state correctamente: connected (7d) / detected (30d) / missing (>90d w/ ≥5 events) / unknown (<5 events)
- [ ] Badges OASF / Source / Auth muestran `PENDING` con tooltip — nunca `connected` (P0-1)
- [ ] Improvement P1 lo más arriba; expandido por defecto en vista no-claimed; "Show all" expande resto
- [ ] Strengths/Watchouts ocultan su container cuando hay 0 items (P1-1)
- [ ] Evidence drawer colapsado por defecto; expande Identity + Protocols + Timeline

### Visual
- [ ] Desktop 1440px — hero ocupa full width, radar centrado, matrix grid 4-col
- [ ] Tablet 768px — matrix grid 4-col, radar ≥ 320px
- [ ] Mobile 375px — sticky header aparece al hacer scroll past hero
- [ ] Mobile — matrix grid 2-col, todos los badges legibles
- [ ] Dark mode — score color contrasta con background (verde >75, amber 50-74, red <50)
- [ ] Light mode — mismo contraste verificado
- [ ] SVG radar sin overflow en 320px (smallest supported)

### Accessibility
- [ ] Radar tiene `role="img"` + `aria-label` con valores legibles
- [ ] Badges tienen `aria-label` explícito (no solo color)
- [ ] CTA primario es `<button>` o `<a>` con focus-ring visible
- [ ] Tooltips de badges `unknown` son accesibles por teclado (focus, no solo hover)
- [ ] Color no es único portador de información (verdict tiene label + ícono)

### Performance
- [ ] LCP < 2.5s en `/agent/celo/1870`
- [ ] Server-rendered: ningún componente cliente en above-the-fold excepto sticky header
- [ ] Radar SVG inline (no fetch extra)
- [ ] Sin layout shift en hero (`score` reservado con `min-h`)

### Data integrity
- [ ] Una dimensión con `status: 'unavailable'` jamás muestra valor numérico fake
- [ ] Improvement suggestions corresponden a watchouts reales (cruce manual con 3 agentes)
- [ ] Badge `connected` solo cuando el dato existe (revisar metadata raw del agente vs UI)
- [ ] Verdict + summary coinciden con score y feedback reales (cruce con 8004scan)

### Regression
- [ ] `EmbedSnippet` sigue funcionando
- [ ] `AgentClaimSection` modal abre y firma SIWE
- [ ] `AgentCertificateActions` mint flow completo (sin tocar)
- [ ] `AgentEventTimeline` muestra eventos
- [ ] OG card generation `/api/og/agent/celo/1870` no rompe
- [ ] **Certificate snapshot integrity (P2-3):** decisión de invalidation/versioning aplicada — verificar un certificado pre-rework: o bien (a) está marcado como legacy, o (b) renderiza el layout anterior correctamente vía versioning
- [ ] DS v1.1 globals.css no muestra regresión visual post-merge (P2-1)

---

## 11. Risks & Mitigations

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Radar SVG complejo y propenso a bugs visuales en mobile | media | medio | SVG plano sin librería, tests visuales con `pnpm ui:shots`, fallback `<table>` accesible |
| Badges `unknown` (OASF, Auth) confunden al usuario y restan trust | media | medio | Copy explícito "Convention pending", tooltip educativo, FAQ link a docs/conventions |
| Reglas deterministas generan summaries pobres ("robotic") en edge cases | alta | bajo | Aceptable en MVP; iterar con feedback real. NO generación libre (ADR-001 rigor) |
| Dimensiones del radar inflan el score percibido vs Trust Score v1 | media | alto | Mantener Trust Score v1 como número rey en hero; radar es interpretación, no nuevo score |
| Improvements suggestions empujan a owners a optimizar para el score (Goodhart) | media | medio | Sugerencias tied a estándares (OASF, A2A), no a manipulación del score formula |
| Rework rompe SEO de OG cards existentes | baja | medio | Mantener `generateMetadata` y endpoints OG sin tocar |
| Performance regression por SSR adicional (4 queries combinadas) | media | medio | `fetchTrustSnapshotInputs` agrega queries en paralelo; revalidate=60 |
| ADR-001 explorer drift — alguien pide "tabla cruda" en la UI | alta | alto | Política explícita: tablas crudas viven en 8004scan, link `View on 8004scan ↗` siempre presente |
| Mock data en preview deployments diferente a prod confunde QA | media | bajo | Usar Toppa (`/agent/celo/1870`) como golden fixture en todos los envs |

---

## 12. Final Recommendation (priority-ordered)

0. **Día 0 — Phase A.0 pre-flight no-negociable.** Las 4 checks (DS regression, ADR-001 gate, certificate policy, dossier schema validation) deben pasar antes de tocar código. Si una falla, se resuelve primero o se difiere la fase afectada.

1. **Día 1 — Hacer Phase A completa antes de tocar UI.** TDD sobre las reglas de derivación es el único guard contra "inventar signals". Si una regla no se puede testear con un fixture determinista, no entra al MVP.

2. **Día 2 — Fetcher integrado.** Asegurar que `fetchTrustSnapshotInputs` ejecuta queries en paralelo (`Promise.all`). El SSR es el principal riesgo de performance.

3. **Día 3 — Hero + Radar first.** Estos dos componentes son el 80% del valor percibido. Si quedan bien, el resto es polish.

4. **Día 4 — Matrix + Improvements.** Son lo más diferencial frente a 8004scan; merecen tiempo de QA visual.

5. **Día 5 — Instrumentation no-negociable.** Sin eventos en `internal/metrics`, no podemos validar la tesis (ADR-001 D6). Si se corta scope, se corta polish, no instrumentation.

6. **Post-merge — Capturar baseline.** Screenshot de Toppa antes/después, métricas de view duration, % usuarios que hacen click en CTA. Estos números deciden si v2 (OASF/Auth conventions) merece inversión.

7. **NO hacer ahora:**
   - Comparative view ni leaderboard (ADR-001)
   - Refactor de Trust Score v1 formula (gated)
   - Nueva ruta `/trust/...` — esto es un rework de `/agent/[chain]/[id]`, no una página nueva

---

## Appendix A — Files to create / modify

### New files (16)
- `src/lib/trust-snapshot/types.ts`
- `src/lib/trust-snapshot/verdict.ts` + `__tests__/verdict.test.ts`
- `src/lib/trust-snapshot/summary.ts` + `__tests__/summary.test.ts`
- `src/lib/trust-snapshot/radar/identity.ts` + test
- `src/lib/trust-snapshot/radar/reliability.ts` + test
- `src/lib/trust-snapshot/radar/reputation.ts` + test
- `src/lib/trust-snapshot/radar/coordination.ts` + test
- `src/lib/trust-snapshot/radar/safety.ts` + test
- `src/lib/trust-snapshot/coordination-badges.ts` + test
- `src/lib/trust-snapshot/improvements.ts` + test
- `src/lib/trust-snapshot/build.ts` + test
- `src/components/agent/trust-snapshot/HeroBlock.tsx`
- `src/components/agent/trust-snapshot/TrustRadar.tsx`
- `src/components/agent/trust-snapshot/StrengthsWatchouts.tsx`
- `src/components/agent/trust-snapshot/CoordinationMatrix.tsx`
- `src/components/agent/trust-snapshot/ImprovementList.tsx`
- `src/components/agent/trust-snapshot/EvidenceDrawer.tsx`
- `src/components/agent/trust-snapshot/MobileStickyHeader.tsx`
- `e2e/trust-snapshot.spec.ts`

### Modified files (4)
- `src/app/agent/[chain]/[id]/page.tsx` (full rework)
- `src/lib/dossier/fetch.ts` (extend with `fetchTrustSnapshotInputs`)
- `docs/denscope-status.md` (update status)
- `src/components/agent/TrustSnapshot.tsx` (rename to LegacyTrustSnapshot or remove if no remaining consumers)

---

**End of spec (Rev 3 — Pass 2 red-team applied) — proceeding to Phase A.0 pre-flight, then Phase A TDD.**
