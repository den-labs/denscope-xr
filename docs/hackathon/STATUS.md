# DenScope — Real Status

> Last updated: 2026-02-18 (evening)

## Build

| Field | Value |
|-------|-------|
| App version | `v0.1.0` |
| Commit (HEAD) | `294129f` |
| Branch | `main` |
| SDK version | `@denlabs/trust-sdk@0.1.0` ([npm](https://www.npmjs.com/package/@denlabs/trust-sdk)) |
| Tests | 153/153 passing (30 files) |
| Deploy | Vercel — [denscope.vercel.app](https://denscope.vercel.app) |

## Deploy Targets

| Environment | Chain | Chain ID | Status |
|-------------|-------|----------|--------|
| Production | Celo Mainnet | 42220 | Live (252 events indexed) |
| Testnet | Celo Sepolia | 11142220 | Live (34 events indexed) |

Supabase: all 8 migrations applied, Edge Function deployed, pg_cron running (1-min interval).

## Works Today

- [x] **Live Feed** — Real-time ERC-8004 event stream from Celo Mainnet + Sepolia
- [x] **Trust Graph** — d3-force interactive graph of agent relationships
- [x] **Discovery Signals** — Pattern detection (first_blood, rising_star)
- [x] **Agent Dossier** — SSR deep-link page with trust score, feedback breakdown, event history
- [x] **OG Share Cards** — Dynamic image generation for agents (`/api/og/agent/[chain]/[id]`)
- [x] **Trust Certificates** — Certificate Station panel with share-to-X flow
- [x] **Owner Console** — Wallet-gated (SIWE), claim agent ownership via `ownerOf` verification
- [x] **Agent Registration UI** — Register new agents with image upload (drag/drop/paste, Pinata IPFS)
- [x] **Incident Management** — 5 signal detectors, severity levels, resolve flow
- [x] **Alert Rules + Webhooks** — Configurable alert rules with webhook delivery
- [x] **Reputation API** — Authenticated REST API (5 endpoints), SHA-256 hashed API keys, rate limiting
- [x] **x402 Micropayments** — Pay-per-call on `/score` ($0.001) and `/signals` ($0.0005) via UltravioletaDAO facilitator (USDC on Celo)
- [x] **trust-sdk** — Published on npm (`@denlabs/trust-sdk`), zero-dep TypeScript, API key + x402 modes, automatic 402 flow
- [x] **API Docs Page** — Public documentation at `/docs/api` with code examples
- [x] **Serverless Sync** — pg_cron + Edge Function, zero infrastructure, zero manual intervention
- [x] **Embed Widget** — `<iframe>` snippet for embedding agent cards
- [x] **Responsive Mobile UX** — Hamburger menu, mobile feed layout, responsive dossier page
- [x] **UI Polish** — Copy feedback, loading skeletons, consistent button styles, debounced filters

## Recent PRs (2026-02-18)

| PR | Description | Files |
|----|-------------|-------|
| #81 | Certificate Station — share-first docked panel | — |
| #82 | Mobile UX: Certificate Station close fix + responsive Header hamburger | 3 |
| #83 | UI polish: mobile feed layout, copy feedback, skeletons, debounce, StatusBar | 11 |
| #84 | Agent Dossier mobile layout + button style consistency | 5 |

## Known Gaps / Bugs

- [ ] No custom domain (using `denscope.vercel.app`)
- [ ] `package.json` version still `0.1.0` — not semver-bumped for milestones
- [ ] Agent Registration requires wallet connection but no gas estimation UI
- [ ] x402 facilitator (UltravioletaDAO) is a third-party dependency — if it goes down, x402 fails gracefully to 402 response
- [ ] Trust score formula v1 is simple (5 weighted components) — no ML or advanced heuristics
- [ ] Supabase free tier limits: ~86K cron invocations/month out of 500K budget
- [ ] No multi-chain beyond Celo yet (EVM-ready architecture but not deployed)

## Next Priorities

1. Register DenLabs flagship agent on Celo Sepolia, then Celo Mainnet
2. Claim the flagship agent, verify full Console flow end-to-end
3. Generate API key, test trust-sdk integration end-to-end
4. Trust Certificate UX Phase 2 (certificate image generation, animations)
5. Framework SDKs (LangChain, CrewAI) — after real agents + feedback
6. Multi-chain — last priority

## Evidence

### Repos

- DenScope: https://github.com/den-labs/denscope-xr
- trust-sdk: https://github.com/den-labs/trust-sdk
- NPM: https://www.npmjs.com/package/@denlabs/trust-sdk

### On-Chain Contracts (ERC-8004)

| Chain | Identity Registry | Reputation Registry |
|-------|-------------------|---------------------|
| Celo Mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Celo Sepolia | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
