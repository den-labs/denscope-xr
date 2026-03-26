# SKALE Technical Reconnaissance

**Date:** 2026-03-25
**Status:** Complete — actionable findings
**Type:** Research (no implementation)

---

# 1. Executive Recommendation

**Proceed with internal technical prep now.** ERC-8004 contracts are already deployed on SKALE Base (chain ID 1187947933) using the same deterministic CREATE2 addresses DenScope already indexes on Celo. viem has a built-in `skaleBase` chain definition. The integration delta is small: one chain config entry, one Edge Function addition, one deploy_blocks row. The partner question list is reduced to 3 items.

---

# 2. Public-Docs Findings

### ERC-8004 Deployment on SKALE (DOCUMENTED FACT)

ERC-8004 contracts are deployed on SKALE Base via deterministic CREATE2. Same addresses as all other mainnet chains:

| Network | Chain ID | IdentityRegistry | ReputationRegistry |
|---------|----------|-----------------|-------------------|
| SKALE Base (mainnet) | 1187947933 | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| SKALE Base Sepolia (testnet) | 324705682 | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

**Source:** [erc-8004/erc-8004-contracts GitHub repository](https://github.com/erc-8004/erc-8004-contracts) (authoritative deployment registry)

### SKALE Network Architecture (DOCUMENTED FACT)

SKALE is a multichain network of EVM-compatible application-specific blockchains. Four hub chains plus application-specific chains and an L3 offering:

| Hub | Chain ID | Purpose | RPC |
|-----|----------|---------|-----|
| Europa | 2046399126 | DeFi, liquidity, bridging | `mainnet.skalenodes.com/v1/elated-tan-skat` |
| Calypso | 1564830818 | NFTs, marketplaces | `mainnet.skalenodes.com/v1/honorable-steel-rasalhague` |
| Nebula | 1482601649 | Gaming | `mainnet.skalenodes.com/v1/green-giddy-denebola` |
| Titan | 1350216234 | AI | `mainnet.skalenodes.com/v1/parallel-stormy-spica` |
| **SKALE Base** | **1187947933** | **AI agents (L3 on Base)** | `skale-base.skalenodes.com/v1/base` |

ERC-8004 is deployed ONLY on SKALE Base, not on the traditional hubs.

### EVM Compatibility (DOCUMENTED FACT)

- Full EVM compatibility (Solidity contracts deploy without modification)
- Standard `eth_getLogs` supported (blockHash field support confirmed)
- WebSocket RPC endpoints available for all chains
- Multicall3 deployed on hub chains
- Custom C++ EVM implementation (not geth), but standard RPC interface
- Blockscout explorers on all chains

### Zero Gas Model (DOCUMENTED FACT)

- Transactions require sFUEL (no economic value, spam protection only)
- SKALE Base uses CREDIT as native token (same model)
- Chain operators pay via SKL token subscription
- No impact on read operations (`eth_getLogs`, `eth_call`)
- Agents/wallets need sFUEL seeding before transacting (does not affect read path)

### AI Agent Positioning (DOCUMENTED FACT)

- SKALE Base (Nov 2025): explicitly an "L3 for AI agents"
- Khorus partnership: A2A agent launchpad building ERC-8004 agent apps gas-free on SKALE
- Co-hosted x402 Agentic Commerce Hackathon (Feb 2026, SF) with Google, Coinbase, Virtuals
- Titan Hub designated for AI use cases
- BITE encryption for agent strategy privacy

### viem Support (DOCUMENTED FACT)

16 SKALE chains defined in viem, including `skaleBase` (1187947933) and `skaleBaseSepoliaTestnet` (324705682). Both include HTTP + WebSocket RPC URLs and Blockscout explorer URLs.

---

# 3. Candidate Network Matrix

### Candidate A: SKALE Base (Mainnet) — chain ID 1187947933

| Aspect | Assessment |
|--------|-----------|
| **Why plausible** | ERC-8004 contracts already deployed. Designated for AI agents. Active Khorus partnership. |
| **Benefits** | Same CREATE2 addresses as Celo mainnet. viem chain definition exists. Blockscout explorer. Real agents possible. |
| **Risks** | Network launched Nov 2025 — relatively new. Unknown agent registration volume. Native token is CREDIT (not sFUEL). |
| **Recommendation** | **Primary candidate** |

### Candidate B: SKALE Base Sepolia (Testnet) — chain ID 324705682

| Aspect | Assessment |
|--------|-----------|
| **Why plausible** | ERC-8004 testnet contracts deployed. Safe for experimentation. |
| **Benefits** | Same testnet addresses as Celo Sepolia. Low-risk testing environment. |
| **Risks** | No real agents. Partner validation requires real usage, not testnet. |
| **Recommendation** | **Dev/testing only** — use for integration verification, not for partner evaluation |

### Candidate C: Titan Hub (Mainnet) — chain ID 1350216234

| Aspect | Assessment |
|--------|-----------|
| **Why plausible** | AI-designated hub. Established mainnet. |
| **Benefits** | Longer track record than SKALE Base. sFUEL-based (standard SKALE model). |
| **Risks** | **No ERC-8004 contracts deployed.** Would require manual deployment or partner coordination. |
| **Recommendation** | **Not viable for v0** — no contracts |

### Candidate D: Europa Hub (Mainnet) — chain ID 2046399126

| Aspect | Assessment |
|--------|-----------|
| **Why plausible** | Most established SKALE hub. DeFi focus with liquidity. |
| **Benefits** | Largest SKALE community. Well-tested infrastructure. |
| **Risks** | **No ERC-8004 contracts deployed.** DeFi focus, not AI/agent focused. |
| **Recommendation** | **Not viable for v0** — no contracts, wrong focus |

---

# 4. Recommended Starting Point

**SKALE Base (chain ID 1187947933)**

**Rationale:**
1. Only SKALE environment with ERC-8004 contracts deployed
2. Explicitly positioned as AI agent infrastructure
3. Active Khorus partnership building ERC-8004 agent apps
4. Deterministic CREATE2 addresses match Celo — same contract interface, same ABI
5. viem has built-in chain definition with RPC + explorer URLs
6. Blockscout explorer available for verification

**Confidence level: HIGH** for technical feasibility. The integration path is well-defined. Confidence is MEDIUM for partner alignment — we assume the partner's "SKALE" reference means SKALE Base, but this needs confirmation.

**Testnet companion:** SKALE Base Sepolia (324705682) for dev/testing. Same testnet addresses as Celo Sepolia.

---

# 5. DenScope Integration Delta

### Files Likely Impacted

| File/Area | Change Type | Description |
|-----------|-------------|-------------|
| `src/config/chains.ts` | Add entry | New `ChainConfig` for SKALE Base (mainnet) and optionally SKALE Base Sepolia (testnet) |
| `src/config/wagmi.ts` | Add chain | Import `skaleBase` from viem, add to wagmi config |
| `supabase/functions/erc8004-poller/index.ts` | Add chain | Add SKALE Base to the `CHAINS` array |
| `deploy_blocks` table | Insert row | Set initial deploy block for SKALE Base |
| `@denlabs/trust-sdk` | Add chain config | SKALE Base chain entry in SDK chain registry |

### What Should Remain Untouched

- Trust score v1 formula (`src/lib/reputation/compute.ts`) — chain-agnostic
- Certificate generation (`src/lib/trust/certificate.ts`) — chain-agnostic
- API routes (`src/app/api/v1/agent/[chain]/[id]/`) — already parameterized by `{chain}`
- Agent dossier page (`src/app/agent/[chain]/[id]/`) — already parameterized
- Signal detection rules — chain-agnostic
- Console, Discovery, Graph — out of scope
- x402 payment infrastructure — out of scope
- All existing Celo functionality

### Estimated Delta Size

~50-80 lines of config changes. No new files. No new routes. No new components.

---

# 6. v0 Technical Plan

See `docs/specs/skale-v0-technical-plan.md` for the full plan.

---

# 7. Assumptions and Unknowns

See `docs/notes/skale-assumptions-log.md` for the full log.

---

# 8. Risks

### Technical Risks
- **RPC reliability unknown.** SKALE Base is new (Nov 2025). No data on uptime, rate limits, or `eth_getLogs` block range limits. Mitigation: start with small chunk sizes, add retry logic.
- **Agent registration volume unknown.** If zero agents are registered on SKALE Base, the trust loop has nothing to process. Mitigation: partner confirms test agents exist or will be created.
- **Edge Function quota.** Adding a third chain to the 1-minute polling cycle increases Supabase Edge Function invocations. Currently ~86K/month for 2 chains. Third chain adds ~43K. Still well within 500K free tier.

### Product Risks
- **Partner means a different SKALE chain.** If the partner's "SKALE" reference is Europa or Titan (no ERC-8004), v0 is blocked on contract deployment. Mitigation: confirm before implementation.
- **Zero external usage.** If the partner does not drive developers to register agents, the evaluation produces no signal. Mitigation: composite success criteria includes written partner confirmation.

### Scope Risks
- **"Just add one more chain" precedent.** If SKALE Base works, pressure to add Europa, Titan, Nebula. Mitigation: guardrails in skale-addendum.md, ADR-001 multichain gate.
- **Partner asks for features beyond v0.** Discovery, alerts, Console on SKALE. Mitigation: explicit out-of-scope list, partner-facing scope doc.

### Dependency Risks
- **Phase 0 competition for attention.** SKALE work could distract from #139 (conversations) and #140 (go/no-go). Mitigation: Phase 0 scheduling priority is absolute.

---

# 9. Reduced Partner Questions

See `docs/notes/skale-partner-questions-reduced.md` (3 questions only).

---

# 10. Final Go/No-Go Recommendation

**Proceed with internal technical prep now.**

Justification:
- ERC-8004 contracts are confirmed deployed on SKALE Base
- The integration delta is small (~50-80 lines of config)
- viem chain definitions exist
- All DenScope infrastructure (scoring, certificates, API, SDK) is chain-agnostic
- Technical prep does not block Phase 0
- Only 3 partner questions remain, and they are confirmation-type (not discovery-type)

Internal prep means: prepare the chain config entry, verify RPC connectivity, check for registered agents. Do NOT merge to main or create the milestone until partner confirms SKALE Base is the target.
