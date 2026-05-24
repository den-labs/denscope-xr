# Red Team Review — Pass 2 (Rev 2)

- **Date:** 2026-05-23
- **Reviewer:** Adversarial principal-level review (self), second pass
- **Spec under review:** `docs/superpowers/specs/2026-05-23-trust-snapshot-coordination-layer.md` (Rev 2)
- **Stance:** All fixes from Pass 1 were applied. Assume new ones leaked in. Find them.

---

## Executive Summary

Rev 2 closes every finding from Pass 1, but introduces **2 new P0 defects** and **6 new P1 issues** — most of them in the seams between fixed sections. The Verdict if/else has an ordering bug that hides critical safety signals. The Health badge gained a tri-state but its rules leave a **30d–90d gap that's still undefined behavior**. Several string templates now reference variables the spec doesn't enumerate (dimension labels, incident watchout copy, openIncidents ordering).

None are show-stoppers. All are fixable in a tight third pass — perhaps 30 minutes of editing. After that, the spec is implementation-ready.

Key principle exposed by this pass: **every time we add a code path, we add a spec gap**. The new tri-states, new ordering rules, and new templates need the same rigor as the original derivation rules. They got 80%.

---

## P0 — New defects introduced in Rev 2

### N1. Verdict if/else: `insufficient-data` masks open critical incidents

**Where:** §4.2 — the if/else chain.

**Problem:** Current order:

```ts
if (input.score === null) return 'insufficient-data'   // ← step 1
if (input.openCriticalIncidents >= 1) return 'caution' // ← step 2
```

If an agent has no trust score yet (common: brand-new agent, first poll pending) **but** a critical incident is already open (e.g., a sybil cluster fired during indexing), the verdict returns `insufficient-data` — silently swallowing the safety signal.

**Why it slipped in:** Pass 1 fixed the table by reordering steps in a single sentence. The conflict between "no data" and "critical signal" wasn't surfaced.

**Fix:**
```ts
// Critical signal overrides any data-completeness verdict
if (input.openCriticalIncidents >= 1) return 'caution'
if (input.score === null) return 'insufficient-data'
// ... rest unchanged
```

This makes safety strictly dominant — the right priority for a trust product.

### N2. Health badge has an undefined range (30d–90d, ≥5 events)

**Where:** §4.6 Health badge tri-state.

**Problem:** Rules enumerate:
- `≤7d` → `connected`
- `8d–30d` → `detected`
- `>90d` AND `≥5 events` → `missing`
- `<5 events` → `unknown`

**Gap:** `31d–90d` with `≥5 events`. No rule. Undefined.

**Why it slipped in:** Pass 1 added the tri-state to fix the false-negative problem (P1-4) but only enumerated edge bands. The middle band was never written.

**Fix:** Add explicit rule:
- `31d–90d` AND `≥5 events` → `detected` (still recent enough on calendar; activity is present)

Or merge: `lastSeen ≤ 30d → detected unless ≤7d → connected; 31d–90d → detected; >90d → missing`.

Either works. Just write it.

---

## P1 — New gaps in Rev 2 templates and ordering

### N3. `metadata.description.length > 0` will crash if `metadata === null`

**Where:** §4.6 Docs badge rule.

**Problem:** When the Agent URI doesn't resolve (offline gateway, malformed URI, IPFS timeout), `fetchAgentMetadataServer()` returns `null`. The rule reads `null.description.length` → TypeError.

**Fix:** Specify null-safe form explicitly:
```ts
docs: (metadata?.description?.length ?? 0) > 0 ? 'connected' : 'missing'
```

And add a row to §4.6: `metadata === null → all metadata-dependent badges = 'missing'`.

### N4. `openIncidents` array ordering not specified

**Where:** §4.1 (type) + §4.7 (`openIncidents[0].id`).

**Problem:** §4.7 uses `openIncidents[0].id` in the P1 improvement template, but §4.1 doesn't define what `[0]` means. Without an explicit sort, the order is whatever Supabase returns — non-deterministic across queries.

**Fix:** Add to §4.1: "openIncidents is sorted by severity `critical > warning > info`, then by `openedAt` descending." Document this as a contract of `fetchTrustSnapshotInputs`.

### N5. `{dimensionLabel}` not enumerated

**Where:** §4.3.1 primaryWatchout rule, step 3.

**Problem:** Template is `"Low {dimensionLabel} score ({value}/100)"`. Spec doesn't say what `dimensionLabel` resolves to. `identity` → "Identity"? "Identity Completeness"? "identity"?

**Fix:** Add explicit map to §4.3.1:

| key | label |
|---|---|
| identity | `"Identity completeness"` |
| reliability | `"Service reliability"` |
| reputation | `"Reputation quality"` |
| coordination | `"Coordination readiness"` |
| safety | `"Safety / integrity"` |

### N6. Incident-watchout copy never defined

**Where:** §4.8 — "incidents take precedence" in Watchouts ordering.

**Problem:** §4.8 says open incidents become Watchout entries, but the string template is missing. The wireframe shows `"⚠ No OASF schema declared"` style — what does an incident render as? `"⚠ Open critical incident: sybil_cluster"`? Different from the radar-low pattern.

**Fix:** Specify in §4.8:
- Watchout entry from incident: `"Open {severity} incident: {kind}"`
- Watchout entry from low dimension: `"Low {dimensionLabel} ({value}/100)"`

### N7. Two semantically different "unknown" states share visual treatment

**Where:** §4.6.

**Problem:** Health can be `unknown` (insufficient activity to assess). OASF/Source/Auth are `unknown` (no convention exists). The wireframe legend renders both as `?`. Tooltip differentiates but the eye-glance doesn't. A new-but-fine agent looks identical to a "we don't have a standard for this" badge.

**Fix:** Two visual treatments:
- Health-`unknown` → grey badge with copy "Not enough activity to assess" (factual, agent-specific)
- Convention-pending → grey **dashed border** badge with copy "Convention pending" (categorical, schema-level)

Different icons or stroke style. The visual must reflect the semantic difference.

### N8. Mobile sticky CTA is meaningless for `insufficient-data`

**Where:** §5.2 wireframe.

**Problem:** Sticky shows the CTA. For `insufficient-data` the CTA is `"Check back after first interactions"` with href `#evidence`. That's informational, not actionable. Putting it in a high-real-estate sticky bar misuses scarce mobile space.

**Fix:** Sticky CTA renders **only** when verdict ∈ {`ready`, `warming-up`, `caution`}. For `insufficient-data`, the sticky shows `score + verdict pill` only — no CTA row. Document this rule in §5.2.

---

## P2 — Smaller issues, defensible to leave for now

### N9. `connectedProtocols` computation timing not specified in build orchestration

**Where:** §4.3 summary uses `{connectedProtocols}` (= count of A2A/MCP/x402 connected). §8 lists `build.ts` as the orchestrator.

**Problem:** No spec of orchestration order. Summary needs badges to be computed first. If `build.ts` runs them in declaration order it works; if not, broken.

**Fix:** §4 add a tiny "orchestration order" subsection: badges → radar dims → verdict → primaryWatchout → summary → improvements.

### N10. `affectsDimension` still a single key

**Where:** §4.1 `ImprovementSuggestion`.

**Problem:** Pass 1 flagged this; Rev 2 didn't address. "Claim agent" affects Identity AND unlocks owner-only actions across dimensions. Single-key mapping over-simplifies.

**Fix (cheap):** Change to `affectsDimensions: Array<keyof radar>` (plural). UI still highlights the first one.

### N11. Wireframe in §5.1 still shows "exactly 3" Strengths/Watchouts

**Where:** §5.1 ascii art.

**Problem:** §4.8 says 1-3 with empty-state hiding. The wireframe shows a balanced 3/2 layout. Risk: a dev assumes "render 3 always" from the wireframe.

**Fix:** Update wireframe to caption `[ 1–3 items; container hidden if 0 ]`.

### N12. Phase A.0.4 (dossier schema verification) is vague

**Where:** §8 Phase A.0.4.

**Problem:** "Verify dossier query shapes match spec assumptions" doesn't enumerate what to verify. A dev could run a 30-second check and call it done, missing actual mismatches.

**Fix:** Enumerate:
- `dossier.firstSeen: string | null`
- `dossier.lastSeen: string | null`
- `dossier.uriUpdateCount: number`
- `dossier.feedbackCount: number`
- `dossier.avgFeedbackValue: number | null`
- `dossier.totalEvents: number`
- `dossier.uniqueInteractors: number`
- `dossier.openSybilCount: number`
- `dossier.resolvedSybilCount: number`
- `incidents` query returns `{ id, severity, kind, status, openedAt }[]` filtered by `status='open'`

Then "verify" means: each field exists in `src/lib/dossier/fetch.ts` output with the listed type.

### N13. Improvement Suggestions expanded by default for non-claimed may push matrix below fold

**Where:** §4.7 fix for M-3.

**Problem:** On mobile, expanding improvements before Coordination Matrix pushes the matrix far down. The matrix is the **differentiator** vs 8004scan. Burying it for the sake of suggestions is a regression.

**Fix:** Render order on mobile: Hero → Radar → Strengths/Watchouts → **Coordination Matrix** → Improvements (expanded if non-claimed). The IA already shows this order; just confirm the "expanded by default" doesn't move it above the matrix.

### N14. Performance: spec mentions `Promise.all` but doesn't show it

**Where:** §8 B1 — `fetchTrustSnapshotInputs()`.

**Problem:** Says "aggregates queries in parallel" but doesn't show the function shape. A dev might write sequential awaits.

**Fix:** Add pseudocode example:
```ts
const [score, dossier, metadata, incidents, owner, uri] = await Promise.all([
  fetchTrustScore(chainId, agentId),
  fetchDossierData(chainId, agentId),
  fetchMetadataWithFallback(uri),
  fetchOpenIncidents(chainId, agentId),
  readAgentOwner(chainId, agentId),
  readAgentURI(chainId, agentId),
])
```

### N15. No performance budget on CI

**Where:** §10 QA "LCP < 2.5s in `/agent/celo/1870`".

**Problem:** Target without measurement plan. Manually checked once → drifts.

**Fix (cheap):** Add to acceptance: "Lighthouse CI snapshot for `/agent/celo/1870` in Vercel preview, LCP under 2.5s on mobile profile." Or accept as soft target and document the measurement command.

---

## Resolved findings from Pass 1 — verification

| Pass 1 finding | Resolved in Rev 2? | Notes |
|---|---|---|
| P0-1 invented fields | ✅ Yes | 5 derivable + 3 PENDING. Clean. |
| P0-2 coordination weights | ✅ Yes | Sums to 100 with 5 components. |
| P0-3 verdict gap | ⚠️ Mostly | Gap closed, but new ordering bug (N1) |
| P0-4 summary template | ⚠️ Mostly | Fallback added, but `dimensionLabel` undefined (N5) |
| P0-5 mailto | ✅ Yes | Removed cleanly. |
| P1-1 strengths/watchouts | ⚠️ Mostly | Ordering defined, but incident copy missing (N6) |
| P1-2 incidents in type | ⚠️ Mostly | Field added, ordering not specified (N4) |
| P1-3 safety bonus | ✅ Yes | Removed. |
| P1-4 health tri-state | ⚠️ Mostly | Tri-state added, but band gap (N2) |
| P1-5 canonicality | ✅ Yes | Copy added to wireframe + §4.9. |
| P1-6 sticky CTA | ⚠️ Mostly | CTA replaced Share, but useless for insufficient-data (N8) |
| P1-7 test count | ✅ Yes | Replaced with coverage cases. |
| P2-1 DS regression | ✅ Yes | Phase A.0.1 added. |
| P2-2 ADR-001 gate | ✅ Yes | Phase A.0.2 added. |
| P2-3 cert snapshot | ✅ Yes | Phase A.0.3 added. |
| M-1 cert v2 scope | ✅ Yes | Clarified — existing flow in MVP. |

**6 of 16 are "mostly" — the gaps surfaced by this pass.**

---

## Recommendations (priority-ordered)

1. **Block Phase A.0 start until N1 and N2 are fixed.** Both are P0. N1 is an actual safety hole; N2 is undefined-behavior in a customer-visible state machine.

2. **Tight pass to address N3–N8 (all P1).** Most are 1–2 line additions to existing sections. Total edit budget: ~20 minutes.

3. **Defer N9–N15 (all P2) to backlog.** Track each as a follow-up issue. None block MVP correctness.

4. **Add an "orchestration order" subsection (N9 fix) before §8.** It's a small but important contract.

5. **Do not re-red-team after Rev 3.** Diminishing returns. The pattern of "every fix creates a smaller fix" can loop. Set a stopping rule: if Rev 3 has only P2 findings, ship.

6. **Capture this lesson in `feedback_*.md`:** when a spec adds a state machine or template, enumerate ALL transitions/interpolations explicitly before review. Pass 1 missed this because it focused on "what's invented" rather than "what's underspecified."

---

## Risks the second pass surfaced

| Risk | Severity | Mitigation in Rev 3 |
|---|---|---|
| Verdict masks critical incidents (N1) | high | Reorder if/else: incidents first |
| Health band gap (N2) | high | Add 31–90d → detected rule |
| Null metadata crashes badge rules (N3) | medium | Explicit null-safe form |
| Non-deterministic incident reference (N4) | medium | Sort openIncidents explicitly |
| Visual conflation of "unknown" types (N7) | medium | Distinct styling for Health-unknown vs Convention-PENDING |
| Sticky CTA noise on insufficient-data (N8) | low-medium | Skip CTA row in that verdict only |
| Affecting-dimensions over-simplified (N10) | low | Make plural |
| Performance budget unmeasured (N15) | low | Lighthouse CI snapshot |

---

**End of Pass 2.** Recommend Rev 3 applying N1–N8 (P0 + P1 only), then **ship to Phase A.0 pre-flight without further review**.
