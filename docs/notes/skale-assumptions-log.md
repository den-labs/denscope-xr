# SKALE Assumptions Log

**Date:** 2026-03-25
**Purpose:** Track assumptions, confidence, and invalidation conditions

---

## A1: SKALE Base is the target environment

| Field | Value |
|-------|-------|
| **Assumption** | The partner's "SKALE" reference means SKALE Base (chain ID 1187947933), the AI agent L3, not Europa, Titan, or another SKALE chain. |
| **Why we believe it** | SKALE Base is the only SKALE environment with ERC-8004 contracts deployed. It is explicitly positioned as the AI agent chain. The partner mentioned trust scoring, certificates, and SDK — all of which require ERC-8004. |
| **Confidence** | MEDIUM-HIGH. The partner said "SKALE" generically. If they meant a hub chain without ERC-8004, this assumption fails. |
| **What would invalidate it** | Partner explicitly names a different SKALE chain (Europa, Titan, etc.) as the target. |
| **Partner confirmation required** | YES — this is Partner Question #1. |

## A2: Same CREATE2 contract addresses work on SKALE Base

| Field | Value |
|-------|-------|
| **Assumption** | The ERC-8004 IdentityRegistry (`0x8004A169...`) and ReputationRegistry (`0x8004BAa1...`) on SKALE Base use the same ABI and interface as on Celo. |
| **Why we believe it** | The erc-8004-contracts GitHub repo shows deterministic CREATE2 deployment across all chains. The contract source is the same. DenScope's viem ABI decoding works against the canonical ABI. |
| **Confidence** | HIGH. CREATE2 guarantees identical bytecode at identical addresses across EVM chains. |
| **What would invalidate it** | SKALE Base has an EVM incompatibility that prevents CREATE2 from producing the same addresses (extremely unlikely given Multicall3 is deployed). |
| **Partner confirmation required** | NO — verifiable via self-serve RPC call. |

## A3: SKALE Base RPC supports eth_getLogs with DenScope's chunk pattern

| Field | Value |
|-------|-------|
| **Assumption** | The SKALE Base RPC endpoint (`skale-base.skalenodes.com/v1/base`) supports `eth_getLogs` with a 500-block range, consistent with DenScope's backfillChunkSize pattern. |
| **Why we believe it** | SKALE documents full EVM compatibility and added `blockHash` support in `eth_getLogs`. Standard RPC interface is maintained. |
| **Confidence** | MEDIUM-HIGH. No public documentation of rate limits or block range caps for SKALE Base specifically. Hub chains work fine. |
| **What would invalidate it** | RPC returns errors for large block ranges, or rate-limits the Edge Function's 1-minute polling cycle. |
| **Partner confirmation required** | NO — testable with a single `eth_getLogs` call. |

## A4: Trust score v1 formula applies to SKALE agents

| Field | Value |
|-------|-------|
| **Assumption** | The same trust score formula (positiveRatio + age + activity - incidents - sybil) produces meaningful scores for SKALE agents, without SKALE-specific adjustments. |
| **Why we believe it** | The formula operates on ERC-8004 events (feedback, validation, reputation), which are chain-agnostic. The contract interface is identical. |
| **Confidence** | HIGH. The formula has no chain-specific parameters. |
| **What would invalidate it** | SKALE agents have fundamentally different interaction patterns (e.g., zero-gas enables sybil spam at a rate that overwhelms the sybil detector). |
| **Partner confirmation required** | NO — observable after initial data. |

## A5: Agents exist or will be registered on SKALE Base

| Field | Value |
|-------|-------|
| **Assumption** | There are registered ERC-8004 agents on SKALE Base, or the partner will ensure agents are registered for evaluation. |
| **Why we believe it** | Khorus partnership is building ERC-8004 agent apps on SKALE Base. The partner indicated willingness to push developers. |
| **Confidence** | MEDIUM. We have not verified agent registrations on-chain. |
| **What would invalidate it** | Zero agents registered, and partner has no concrete plan to register any. |
| **Partner confirmation required** | PARTIAL — we can self-serve check the contract, but partner should confirm developer pipeline. |

## A6: Zero-gas model does not affect DenScope's read path

| Field | Value |
|-------|-------|
| **Assumption** | SKALE's sFUEL/CREDIT zero-gas model does not affect `eth_getLogs`, `eth_call`, or event decoding. Read operations work identically to Celo. |
| **Why we believe it** | Zero gas only affects transaction submission (sFUEL required for writes). Read calls via RPC do not require gas or sFUEL. |
| **Confidence** | HIGH. This is standard EVM behavior. |
| **What would invalidate it** | SKALE Base requires sFUEL or authentication for RPC read calls (no evidence of this). |
| **Partner confirmation required** | NO. |

## A7: Adding a third chain stays within Supabase free tier

| Field | Value |
|-------|-------|
| **Assumption** | Adding SKALE Base to the Edge Function polling cycle keeps total invocations under the 500K/month free tier. |
| **Why we believe it** | Current usage: ~86K/month for 2 chains (1440 invocations/day * 60 days ≈ 86K). Third chain adds ~43K. Total ~129K, well under 500K. |
| **Confidence** | HIGH. Simple arithmetic. |
| **What would invalidate it** | Supabase changes pricing, or SKALE Base produces so many events that processing time exceeds Edge Function timeout. |
| **Partner confirmation required** | NO. |
