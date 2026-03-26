# SKALE Partner-Led Exception

**Date:** 2026-03-25
**Status:** Proposed
**Author:** wolfcito

## Why SKALE Is Treated as a Partner-Led Exception

DenScope is a Celo-first trust infrastructure product. The core roadmap (Phase 0 validation, Phase 1 foundation, Phase 2 developer traction) is not changing.

SKALE enters the picture because a real partner contact indicated that trust scoring, certificates, and SDK/API support are relevant to their ecosystem. They also indicated willingness to push developers toward the product and help gather feedback.

This is a **demand signal**, not a strategy pivot. The correct response is to test it in a bounded way — not to ignore it, and not to pivot toward it.

## Why This Does NOT Change the Core Roadmap

1. **Phase 0 remains the strategic blocker.** Issues #139 (conversations) and #140 (go/no-go) are still the gates to Phase 1. SKALE work does not replace, defer, or reduce the priority of Phase 0.

2. **DenScope is not becoming a multichain explorer.** Adding one partner-approved SKALE network to the chain registry is not the same as building generic multichain support. There is no generalized chain abstraction, no multi-chain UI, no explorer-style expansion.

3. **No new product lines.** SKALE support is a bounded track inside DenScope, not a separate product. It reuses existing infrastructure: trust scoring, certificates, agent dossier pages, SDK read paths.

4. **No feature parity promise.** SKALE v0 is a thin-slice demonstrating the trust loop. It does not include Discovery, TrustOps, Console expansion, alerts, graph work, or x402 payments.

## Conditions Under Which the Exception Is Justified

All of the following must remain true for SKALE work to continue:

- A named partner contact is actively engaged and responsive
- The partner has confirmed (or is working to confirm) ERC-8004 deployment on a SKALE environment
- There is a concrete path to real agents being registered and queryable
- Phase 0 work is not being delayed or deprioritized because of SKALE
- The work strengthens at least one of: trust visibility, trust API/SDK, or certificate/verification loop

If any of these conditions stop being true, the SKALE track pauses immediately.

## Risks of Scope Drift

| Risk | Mitigation |
|------|------------|
| SKALE becomes a generic multichain precedent | Explicit guardrails: 1 network, no new UI, no feature parity |
| Partner engagement stalls but work continues | Composite success signal with archive conditions (see skale-v0-scope.md) |
| Phase 0 gets deprioritized in favor of "partner momentum" | Phase 0 takes scheduling priority; SKALE is interstitial work |
| Technical unknowns (RPC reliability, contract availability) block progress | Dependencies documented; no implementation until unknowns resolved |
| Scope expands one small piece at a time | All additions must pass the ADR-001 issue litmus test |

## Decision Record

This document is the authoritative record of why SKALE is being explored. Any future chain additions must go through the same evaluation: named partner, real demand signal, bounded scope, no roadmap disruption.
