# Red Team Review — Trust Snapshot / Coordination Layer Spec

- **Date:** 2026-05-23
- **Reviewer:** Adversarial principal-level review (self)
- **Spec under review:** `docs/superpowers/specs/2026-05-23-trust-snapshot-coordination-layer.md`
- **Stance:** Find what's wrong, not what's right. Assume the spec lies.

---

## Executive Summary

The spec is structurally sound but contains **5 P0 issues that violate its own "no inventos" rule**, **7 P1 issues with internal contradictions or ambiguity**, and **3 misalignments with the user's original brief**. None require scrapping the spec — all are fixable in a single revision pass before Phase A begins.

Most dangerous failure mode: the spec advertises rigor ("toda conclusión debe mapear a datos reales o reglas explícitas") while quietly inventing field conventions (`metadata.oasf`, `metadata.repository`, `metadata.auth`, `metadata.docs`) that no ERC-8004 agent actually uses today. If shipped as-is, the Coordination Matrix will misreport reality and the spec becomes the very thing it claims to avoid.

---

## P0 — Must fix before any code

### P0-1. Invented metadata fields disguised as "derived"

**Where:** §4.6 Coordination Matrix — OASF, Source, Auth, Docs badges.

**Problem:** The spec defines detection rules using field names that are not part of any standard ERC-8004 metadata schema:
- `metadata.schema === 'OASF' || metadata.oasf === true`
- `metadata.repository || metadata.source || metadata.github`
- `metadata.auth || metadata.authentication`
- `metadata.documentation || metadata.docs`

No agent in the current `agents` table populates these. The spec acknowledges "Convention pending" but the **detection rules themselves are invented**, which contradicts §2's anti-thesis ("No inventar signals que no tenemos datos para derivar") and rule #2 in user requirements ("No inventar signals ni insights").

**Severity:** P0 — this is the spec's own prohibition violated by the spec.

**Fix:**
- Hard-code OASF, Source, Auth as `state: 'unknown'` in v1 with no detection rule.
- Docs: derive from `metadata.description.length > 0` only (presence, not heuristic length threshold).
- Move all four to a "Phase Future — Convention TBD" appendix.
- Reduce Coordination Matrix to **4 derivable badges (A2A, MCP, x402, Health)** in MVP. Show the other 4 as locked `PENDING` placeholders with explicit "v2" copy.

### P0-2. Coordination Readiness dimension weights don't sum to 100

**Where:** §4.5.4.

**Problem:** Listed weights are A2A=20 + MCP=20 + x402=15 + Docs=15 + Health=15 + Auth=15 = **100**, with OASF+Source explicitly = 0 in v1. But Auth is `unknown` per P0-1, so its 15-point weight cannot fire. Effective max for v1 = 85. Either:
- Coordination dimension never reaches 100 (breaks radar visualization), or
- We award Auth points without evidence (invents data).

**Severity:** P0 — silently caps a dimension's ceiling.

**Fix:** Redistribute weights across only **derivable v1 badges**:
- A2A=25, MCP=25, x402=20, Docs=10, Health=20 = 100.
- Remove OASF/Source/Auth from radar dimension formula entirely until convention exists.

### P0-3. Verdict derivation table has a gap

**Where:** §4.2.

**Problem:** Row 2 says `score >= 50 && < 75` requires `medium+` confidence. What happens if `score = 70` and `confidence = 'low'`? The table doesn't say. Falls through to no rule.

**Severity:** P0 — undefined behavior for a common case (early agents with score but few feedbacks).

**Fix:** Add explicit row:
- `score >= 50, confidence === 'low'` → `warming-up` (NOT `caution`, since score is decent — confidence speaks to evidence volume, not negative signal).
- Alternative: collapse confidence into verdict only as a tiebreaker for `ready` vs `warming-up`.

Rewrite as deterministic if/else chain in pseudocode in the spec, not a table with implicit fallthrough.

### P0-4. Summary template for `caution` references undefined data

**Where:** §4.3.

**Problem:** Template is `"{primaryWatchout}. Recommend additional review before coordination."` But `watchouts` are derived from radar values AND open incidents. Two failure modes:
1. Verdict is `caution` because score < 50 but no incidents and all radar values are >= 40 → `watchouts` empty → `primaryWatchout` is undefined → template breaks.
2. Multiple watchouts exist → which is "primary"? Spec doesn't define ordering.

**Severity:** P0 — runtime crash on common case.

**Fix:**
- Define `primaryWatchout` ordering: open critical incident > open warning incident > lowest radar dimension below 40 > "low overall confidence".
- Add fallback template: `"Score below threshold ({score}/100). Review evidence before coordination."` when no specific watchout.

### P0-5. Recommended action `mailto:owner` references nonexistent data

**Where:** §4.4 Recommended action map, `ready` row.

**Problem:** `optional mailto:owner if claimed`. `owner_profiles` table (per CLAUDE.md) does not contain email — only chain_id + agent_id + claimed wallet. Spec assumes a field that doesn't exist.

**Severity:** P0 — same "no inventos" violation as P0-1.

**Fix:** Remove `mailto:` href. Replace with `#evidence` anchor or no href. If claim flow could expose contact in future, mark explicitly as v2.

---

## P1 — Should fix before merge

### P1-1. Strengths/Watchouts ordering and empty-state undefined

**Where:** §3 (wireframe shows exactly 3 each) + §4.1 (`max 3`).

**Problem:**
- If only 1 dimension >= 70, wireframe shows empty placeholder rows? Hidden? Reflowed? Undefined.
- Watchout ordering — what comes first if 2 dimensions tie? Spec doesn't say.
- The wireframe implies they're balanced visually; reality is asymmetric.

**Fix:**
- Define: Strengths show 1-3 items; container hidden if 0. Same for Watchouts.
- Sort Strengths descending by `value`; Watchouts ascending by `value`. Ties broken by canonical dimension order: identity > reliability > reputation > coordination > safety.

### P1-2. Improvement suggestions reference incident IDs not in TrustSnapshotData

**Where:** §4.7, `"Resolve open incident #{id} via Owner Console"`.

**Problem:** `TrustSnapshotData` type (§4.1) does not carry raw incidents — only derived radar values + watchouts. The template needs incident IDs the type doesn't expose.

**Fix:** Either:
- Extend type to include `openIncidents: { id, severity, kind }[]` (recommended; adds <1KB)
- Or remove incident ID from template: `"Resolve open incidents via Owner Console"` (loses specificity)

### P1-3. Safety dimension bonus is conceptually wrong

**Where:** §4.5.5 — `+5 bonus if storageType === 'On-chain'`.

**Problem:** On-chain inline JSON is a *storage choice*, not a safety property. It does reduce one attack surface (URI host compromise) but it also forbids updates without on-chain tx (could be a *negative* in some contexts). Putting it in the Safety dimension conflates two orthogonal axes.

**Fix:** Remove bonus from Safety. If storage choice matters, surface it as a neutral fact in Evidence drawer with a tooltip explaining trade-offs. Don't bake it into a quality score.

### P1-4. Health badge is a false-negative trap

**Where:** §4.6 Health rule: `lastSeen within 30d`.

**Problem:** Agents with valid identity but zero traffic will fail Health even if they're operationally fine (they just haven't been used). This penalizes new or niche agents identically to abandoned ones.

**Fix:** Distinguish:
- `connected` if `lastSeen within 7d` (active)
- `detected` if `lastSeen within 30d` (recent)
- `missing` only if `lastSeen > 90d` (stale)
- For agents with `events < 5 total`, render `unknown` with copy "Not enough activity to assess health"

### P1-5. Trust Score v1 vs radar: which is the "real" number?

**Where:** §11 Risks (acknowledged) but no resolution.

**Problem:** Hero shows score (e.g., 87). Radar can show coordination=71 but reputation=89. User sees mixed signals. The spec promises "lectura de 1 vistazo" but provides two competing summaries.

**Fix:** Lock the rule explicitly: the hero score is the **single canonical trust number**. Radar dimensions are **interpretive**, never re-aggregated into a different total. Add visible copy on radar: *"Dimensions interpret the score above — they do not replace it."*

### P1-6. Mobile sticky header redundancy

**Where:** §5.2 + §3.

**Problem:** Sticky header has Share button. Footer also has Share. On mobile, that's two buttons for the same action 600px apart. The hero CTA ("Pair on coordinated task") is the *intended* primary action and isn't in the sticky.

**Fix:** Sticky header keeps `score + verdict` only. Replace Share in sticky with **the recommended action CTA** so it stays accessible while scrolling. Move Share into a single canonical location (Footer + native browser share).

### P1-7. Phase A test count is performative

**Where:** §9 Acceptance Criteria: "≥30 nuevos tests".

**Problem:** Number is arbitrary. Some derivation functions (e.g., `deriveVerdict`) need ~6 tests; others need ~3. Mandating 30 invites filler tests. The spec should mandate **coverage of cases**, not count.

**Fix:** Replace with: "Each radar dimension has tests for: zero-data, partial-data, edge values 0 and 100, and 1 representative real fixture (Toppa)." Verdict + summary have a test per row/template. Approximately 30 tests fall out of that naturally without being a target.

---

## P2 — Nice to fix

### P2-1. Design system regression is a hidden blocker

Memory indicates `denscope_design_system_status.md` flags **DS v1.1 VISUAL REGRESSION — globals.css needs full restore**. Building new components on top of a broken DS inherits the regression. Spec doesn't mention it.

**Fix:** Pre-flight check in Phase A.0: confirm `globals.css` is restored OR pin Phase C to wait on DS fix.

### P2-2. ADR-001 Phase 0 gate not verified

Spec adds 16 new files. ADR-001 D6 says "no new Console features until activation metrics exist." Trust Snapshot is technically the agent page (not Console), but the spirit ("validate before build") still applies. Spec should explicitly cite the most recent Phase decision (e.g., `docs/roadmap/decisions/2026-03-28-phase0-go-decision.md`) and confirm this work is gated through.

### P2-3. OG card regression risk understated

Spec preserves `generateMetadata` but doesn't account for **certificate snapshot OG generation** (`findLatestSnapshot` → `/api/certificate/snapshot/[hash]`). If hero rework changes the visual basis the snapshots were minted against, old certificates become **misleading evidence** (the URL renders different content than the certificate hash represents). This is an integrity concern, not a visual one.

**Fix:** Invalidate prior snapshots OR version the certificate so old hashes still render old layout. Decide before merge.

---

## Misalignments with user's original brief

### M-1. Trust Certificate v2 deferred to v2 against user MVP request

User listed "Shareable Trust Certificate v2" in the **MVP** requirements. Spec §7.1 marks it ✅ MVP but §7.2 then lists "Trust Certificate v2 visual template" as v2 (gated). Internal contradiction.

**Fix:** Either confirm the existing `AgentCertificateActions` flow + new hero copy IS the v2 (and clarify "v2 visual template" is a separate styling pass), OR include the new template in MVP scope and adjust timeline.

### M-2. Sticky CTA visibility vs ADR-001 minimalism

User asked for premium, sobria UX. Sticky header risks feeling busy. Worth a single-screen prototype before committing.

### M-3. "More útil que un explorer" claim depends on Improvement Suggestions

That section is the only place DenScope tells the user *what to do*. It's gated behind a `collapsed by default` drawer in some flows. If improvements are the differentiator, they should be **expanded by default at least for non-claimed views**.

---

## Recommendations (priority-ordered)

1. **Block Phase A start** until P0-1 through P0-5 are resolved in a revision of the spec.
2. **Revise §4.6** to ship 4 derivable badges + 4 explicit "PENDING" placeholders. Make the missing convention a public artifact (proposal in `docs/conventions/agent-metadata-v1.md`) so DenLabs *creates* the standard rather than guessing it.
3. **Tighten §4.2 verdict table** into an explicit if/else chain. Add the missing low-confidence row.
4. **Extend `TrustSnapshotData`** to include `openIncidents` array (P1-2) so improvements can reference IDs.
5. **Resolve M-1 (Trust Certificate v2 scope)** with the user before Day 4 — Phase E touches certificate flow.
6. **Pre-flight DS v1.1 regression check** as Phase A.0. Block if broken.
7. **Sign off invalidation policy for old certificate snapshots** before any hero rework lands (P2-3).
8. After fixes, **re-run this red team on the revised spec** before approving for TDD.

The spec's bones are right. Its discipline isn't tight enough yet to honor its own anti-thesis. Tighten, then ship.

---

## Risks the original spec missed

| Missed risk | Severity | Note |
|---|---|---|
| Invented metadata field detection (P0-1) | high | Self-contradiction with spec's own rule |
| Verdict table gap (P0-3) | high | Undefined runtime behavior |
| Certificate snapshot integrity (P2-3) | medium | Affects already-minted artifacts |
| DS regression as silent blocker (P2-1) | medium | Will manifest as UI bugs late |
| ADR-001 Phase 0 gating (P2-2) | medium | Process discipline |
| Health badge false negatives (P1-4) | medium | UX harm to legitimate agents |
| Two competing scores (radar vs hero, P1-5) | low-medium | Resolved by copy, not architecture |

---

**End of red team. Awaiting decision: revise spec, or accept findings as backlog and proceed?**
