# Performance Policy (Prod-First, Eco-Aware)

## Purpose

Define a clear performance policy for Denscope so UX remains usable on typical laptops during long sessions, while preserving a useful live experience where it matters.

This policy is:
- production-first
- adaptive by default
- compatible with developer-focused eco modes (optional)

## Core Principles

1. Prod-first
- Performance protections must work in production, not only in development.

2. Progressive degradation
- Degrade visuals/work incrementally instead of disabling functionality outright.
- Prefer: reduce animation -> cap rendering -> reduce update frequency.

3. Background-aware by default
- When the tab is not visible, reduce non-critical work automatically.

4. Utility beats aesthetics
- If animation or visual richness harms usability, thermals, or responsiveness, utility wins.

5. Explainable behavior
- If the app reduces fidelity, the behavior should be predictable and ideally observable in code/config.

## Performance Budget Areas

### A) Data Activity (subscriptions, polling, ingest)

Policy:
- Live ingest/pipeline runs only on routes that need live data.
- Pause live ingest when `document.hidden === true`.
- Avoid unnecessary re-fetch of historical data during route switching in the same session.

Current implementation (as of 2026-02-22):
- Route-aware pipeline execution in `PipelineProvider`
- Background pause for live ingest

### B) Rendering and Lists

Policy:
- Large lists must not animate every item.
- Cap visible rows/items where needed.
- Use progressive enhancement for motion (animate recent/new items only).

Examples:
- Feed rows: render cap + animation degradation after row threshold
- Discovery/Console: monitor volume and apply caps if real evidence of load appears

### C) Visual Effects / Motion

Policy:
- Continuous animation loops only when they communicate signal directly.
- Entry animations are allowed at low volume and must degrade at high volume.
- No continuous repaints for static layers.

### D) Background (Tab Hidden) Behavior

Policy:
- Pause or reduce:
  - live ingest/pipeline
  - non-critical timers (e.g. status uptime)
  - non-essential UI effects

Current implementation:
- Pipeline pauses when tab hidden
- StatusBar timers pause when tab hidden

## Runtime Quality Modes (Conceptual)

### `Balanced` (default production behavior)
- Live UX preserved
- Route-aware and background-aware protections active
- Volume-based animation degradation active

### `Eco` (automatic or manual)
- Fewer animations
- Lower update frequency for non-critical UI
- Best for laptops / long sessions / thermally constrained environments

### `High` (future, optional)
- Higher visual fidelity
- Should only exist if there is a clear use case and budget support

## Initial Thresholds (Current/Recommended)

### Feed (`/`)
- `MAX_VISIBLE_FEED_ROWS = 150`
- `DISABLE_ANIMATIONS_AFTER_ROWS = 80`
- `MAX_ANIMATED_FEED_ROWS = 24`

Rationale:
- Keep recent context visible while avoiding mass framer-motion work.

### Discovery (`/discovery`)

Current state:
- No known heavy animation loops

Policy trigger:
- If signal volume grows significantly (e.g. 100+ visible cards), review and add render cap or virtualization.

### Console (`/console`)

Current state:
- No mass animation issue identified
- Route should not run global live ingest pipeline

Policy:
- Keep subscriptions local to components that need them
- Avoid background polling/refresh unless user value is clear

### Graph (`/graph`, Labs)

Policy baseline (if/when used):
- Route-only execution
- Background pause
- DPR cap
- FPS cap for cosmetic animation
- Layer separation (static base vs effects)
- Level-of-detail for edges/labels

## Development vs Production Guidance

## What changes in development
- Dev tooling overhead (HMR, checks, non-optimized bundles) can amplify heat/CPU usage.
- A performance issue may appear worse in dev, but the root cause can still be real in production.

## What must still hold in production
- Route-aware live work
- Background-aware pause/reduction
- Volume-based rendering degradation

Conclusion:
- Dev may exaggerate; prod may reduce.
- But root causes must be fixed in app behavior, not hidden by dev-only flags.

## Optional Developer Tooling (Not a Substitute)

Optional future flag:
- `NEXT_PUBLIC_ECO_DEV=1`

Purpose:
- Lower thermal/noise during UI work in development
- Disable/reduce non-critical live behaviors for design tasks
- Performance debugging and A/B comparison

Important:
- This is a developer convenience tool.
- It does not replace production-grade adaptive performance controls.

## Instrumentation Recommendations (Future)

Track and review:
- route session durations
- incoming event volume per minute
- rendered item counts (feed/discovery)
- when degradation thresholds activate
- client-side long tasks / frame drops (if telemetry added)

Goal:
- Tune thresholds using evidence instead of guessing.

## Review Triggers

Revisit this policy when:
- a route introduces new continuous animation
- a list grows materially in cardinality
- new realtime sources are added
- users report heat/battery drain on production sessions

