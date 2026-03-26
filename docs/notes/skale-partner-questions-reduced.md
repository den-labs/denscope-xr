# SKALE — Reduced Partner Questions

**Date:** 2026-03-25
**Context:** After self-serve research, only 3 questions remain.

---

## What we already know (no need to ask)

- ERC-8004 contracts are deployed on SKALE Base (chain ID 1187947933) — confirmed via erc-8004-contracts GitHub repo
- Contract addresses are deterministic CREATE2 (same as Celo) — confirmed
- viem has built-in SKALE Base chain definition — confirmed in codebase
- SKALE Base is EVM-compatible with standard eth_getLogs — documented
- Blockscout explorer is available — confirmed
- Zero-gas model does not affect read operations — standard EVM behavior
- Khorus is building ERC-8004 agent apps on SKALE Base — documented in SKALE blog

---

## Questions for the partner (3)

### Q1: Is SKALE Base the target environment?

We found ERC-8004 contracts deployed on SKALE Base (the AI agent L3, chain ID 1187947933). Is this the environment you are referring to, or do you have a different SKALE chain in mind?

**Why it matters:** ERC-8004 is only deployed on SKALE Base. If the target is Europa, Titan, or another hub, contract deployment would be a prerequisite.

### Q2: Are there registered agents on SKALE Base today?

Are there ERC-8004 agents currently registered on SKALE Base that we can use for initial validation? If not, is there a timeline for agent registrations (e.g., via Khorus or your developer community)?

**Why it matters:** DenScope needs at least one registered agent to demonstrate the trust loop. Without agents, the evaluation produces no signal.

### Q3: What does distribution support look like concretely?

You mentioned willingness to help push developers toward the product. Can you describe what that looks like? Examples: newsletter mention, docs integration, direct introductions to teams building on SKALE Base, co-hosted demo.

**Why it matters:** The evaluation success criteria includes external usage driven by partner distribution. We need to align on what "push developers" means in practice so we can measure it.

---

## What we can do without waiting

- Verify RPC connectivity to SKALE Base (self-serve test call)
- Check for registered agents on SKALE Base (self-serve contract read)
- Look up ERC-8004 deploy block on SKALE Base (Blockscout query)
- Prepare chain config entry (internal, not merged)
- Prepare Edge Function addition (internal, not merged)
