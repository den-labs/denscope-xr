# Roadmap Addendum: SKALE Evaluation Lane

**Date:** 2026-03-25
**Status:** Proposed

## Statement

SKALE is a bounded, partner-led evaluation lane inside DenScope. It is not a roadmap change, not a multichain pivot, and not a new product.

## Interaction with Phase 0

Phase 0 (M-VAL) remains the strategic gate:

```
Phase 0 (M-VAL)          SKALE Evaluation
─────────────────         ─────────────────
#136 Analytics    [done]
#137 Baseline     [done]
#138 Scripts      [done]
#139 Conversations [active]  ← SKALE does not block this
#140 Go/No-Go     [blocked]  ← SKALE does not affect this decision

                              Partner scope confirmation
                              ↓
                              SKALE v0 implementation
                              (interstitial, not blocking)
                              ↓
                              Evaluation period (30 days)
                              ↓
                              SKALE go/no-go
```

**Scheduling rule:** If a developer has time blocked for Phase 0 work, that time is not available for SKALE. SKALE is interstitial — it fills gaps, it does not create them.

## Interaction with Later Gates

| Gate | SKALE Impact |
|------|-------------|
| Phase 0 Go/No-Go (#140) | None. SKALE success/failure does not factor into the Celo-focused Phase 0 decision. |
| Phase 1 (M-FOUND) | If SKALE v0 succeeds, it provides supplementary evidence of product-market fit (partner validation, external usage). It does not replace the Phase 1 gating criteria. |
| Phase 2 (M-DEVTRACT) | If SKALE v0 succeeds and Phase 1 is approved, SKALE could become a first-class supported chain. This requires a separate decision. |
| Multichain expansion | ADR-001 gates multichain on ">5 external requests". One SKALE partner counts as 1, not as a green light. |

## Decision Points

### Decision 1: Scope Confirmation (before implementation)
**Trigger:** Partner provides network/environment, contract addresses, test agents
**Options:**
- **Proceed** — all technical unknowns resolved, implementation is feasible
- **Defer** — unknowns remain, partner commits to resolving them with a timeline
- **Decline** — deployment reality makes v0 infeasible

### Decision 2: Evaluation Go/No-Go (30 days after v0 delivery)
**Trigger:** Evaluation period ends
**Criteria:** Composite success signal (see skale-v0-scope.md)
**Options:**
- **Expand** — success signal met, create Phase 1 SKALE issues
- **Maintain** — partial signal, keep code live, wait for more data
- **Archive** — signal not met, archive track, revisit on new inbound

## Milestone

TBD after partner scope confirmation. The milestone will be created only when Decision 1 resolves to "Proceed." Until then, SKALE work is tracked as documentation and planning only.

## Guardrails

These rules prevent SKALE from causing roadmap drift:

1. **Phase 0 priority is absolute.** No SKALE work may delay, defer, or replace Phase 0 tasks.
2. **One network only.** No multi-SKALE expansion in v0. One partner-approved environment.
3. **No new UI.** Reuse agent dossier, certificate pages, and existing API routes.
4. **No feature parity.** SKALE v0 is trust visibility + certificate + SDK read. Nothing else.
5. **Time-boxed evaluation.** 30 days from v0 delivery to composite success signal or archive.
6. **No implementation issues before scope confirmation.** The epic exists as a draft. Issues are created only after Decision 1 resolves to "Proceed."
7. **Issue litmus test applies.** Any proposed SKALE work must pass the ADR-001 5-criteria litmus test (demand signal, activation, trust API, drift, integration proximity).
8. **Archive is the default.** If partner follow-through or real-agent testing does not materialize, the track is archived. Continuing requires active justification, not inertia.
