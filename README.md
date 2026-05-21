# DenScope

Real-time ERC-8004 agent explorer with trust scoring, signal detection, and x402 micropayments.

[![Deploy](https://img.shields.io/badge/deploy-vercel-black)](https://www.denscope.xyz)

**Live:** [https://www.denscope.xyz](https://www.denscope.xyz)

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Chain client:** viem
- **State:** zustand
- **Graph:** d3-force
- **Database:** Supabase (Postgres + Realtime + Edge Functions + pg_cron)
- **Styling:** Tailwind CSS
- **Wallet:** wagmi + SIWE

## Features

- Live event feed with Supabase Realtime subscriptions
- Trust Graph visualization (d3-force canvas)
- Discovery Signals -- 5 detection rules (first_interaction, validation_complete, feedback_spike, reputation_drop, sybil_cluster)
- Owner Console with SIWE wallet-gated authentication
- Agent Dossier pages with SSR and OG share cards
- Reputation API (M6) -- pre-computed trust scores via authenticated REST
- x402 Trust Oracle (M7) -- pay-per-call micropayments for autonomous agents
- Public API documentation at `/docs/api`

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Celo Mainnet | 42220 | Active |
| Celo Sepolia | 11142220 | Testnet |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

Configure your `.env` with Supabase credentials, RPC endpoints, and optionally x402 settings. See `.env.example` for required variables.

```bash
# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm test` | Run vitest tests |
| `pnpm test:watch` | Watch mode |
| `pnpm lint` | ESLint |

## Testing

- **214 tests** across **45 files**
- **57% statement coverage**

```bash
pnpm test                    # All tests
pnpm test src/lib/           # Pipeline + discovery + agent tests
pnpm test src/stores/        # Zustand store tests
pnpm test src/config/        # Chain config tests
```

## API Routes

| Route | Description |
|-------|-------------|
| `/api/auth/nonce` | Generate SIWE nonce |
| `/api/claim` | Claim agent ownership |
| `/api/v1/agent/[chain]/[id]` | Agent profile |
| `/api/v1/agent/[chain]/[id]/score` | Trust score with breakdown (API key or x402) |
| `/api/v1/agent/[chain]/[id]/signals` | Incidents (API key or x402) |
| `/api/v1/agent/[chain]/[id]/events` | Paginated event history |
| `/api/v1/keys` | API key CRUD |
| `/api/v1/search` | Search agents by ID, owner, or chain |
| `/api/og/agent/[chain]/[id]` | Agent OG share card |
| `/docs/api` | Public API documentation |

### Authentication

API endpoints accept `Authorization: Bearer ds_...` or `X-API-Key: ds_...` headers. Endpoints marked with x402 also accept `X-PAYMENT` headers for pay-per-call access without API keys.

## Architecture

DenScope is organized around a real-time trust pipeline that indexes ERC-8004 agent activity on Celo, detects behavioral signals, computes trust scores, and renders an interactive force-directed graph.

**Stack:** Next.js 16 · viem · Zustand · d3-force · Supabase Edge Functions

**Data flow:**
On-chain events → Signal detection → Trust scoring → Live visualization

Key directories:

```
src/config/       Chain registry and constants
src/lib/          Core logic (pipeline, discovery, auth, reputation, x402)
src/stores/       Zustand state stores
src/components/   React components
src/app/          Next.js pages and API routes
supabase/         Edge Functions and migrations
```

## License

MIT
