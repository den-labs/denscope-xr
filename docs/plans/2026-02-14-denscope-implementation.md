# DenScope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time ERC-8004 agent explorer with live feed, trust graph, and discovery signals — browser-first, zero-DB.

**Architecture:** Next.js 15 App Router reads ERC-8004 contracts directly via viem (getLogs + watchContractEvent polling). State managed with zustand, persisted to IndexedDB. Multi-chain by config.

**Tech Stack:** Next.js 15, TypeScript, viem, zustand, d3-force, framer-motion, @vercel/og, idb, Tailwind CSS, pnpm

**Design doc:** `docs/plans/2026-02-14-denscope-design.md`

---

## Phase 0: Scaffold

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`

**Step 1: Create Next.js app**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack
```

Expected: Project scaffolded with App Router structure.

**Step 2: Install core dependencies**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope
pnpm add viem zustand idb framer-motion
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 3: Configure vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 4: Verify setup**

```bash
pnpm build
pnpm test
```

Expected: Build succeeds, test runner starts (0 tests).

**Step 5: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts tailwind.config.ts vitest.config.ts postcss.config.mjs eslint.config.mjs src/ public/ .gitignore
git commit -m "chore: scaffold Next.js 15 with viem, zustand, vitest"
```

---

### Task 2: Define chain config and contract ABIs

**Files:**
- Create: `src/config/chains.ts`
- Create: `src/config/contracts.ts`
- Create: `src/config/constants.ts`
- Test: `src/config/__tests__/chains.test.ts`

**Step 1: Write the test**

```typescript
// src/config/__tests__/chains.test.ts
import { describe, it, expect } from 'vitest'
import { chains, getChain } from '../chains'

describe('chains', () => {
  it('has Celo Alfajores configured', () => {
    const chain = getChain(44787)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Celo Alfajores')
    expect(chain!.contracts.identity).toMatch(/^0x/)
    expect(chain!.contracts.reputation).toMatch(/^0x/)
  })

  it('has Celo Mainnet configured', () => {
    const chain = getChain(42220)
    expect(chain).toBeDefined()
    expect(chain!.name).toBe('Celo')
  })

  it('returns undefined for unknown chain', () => {
    expect(getChain(99999)).toBeUndefined()
  })

  it('all chains have required fields', () => {
    for (const chain of chains) {
      expect(chain.backfillWindow).toBeGreaterThan(0)
      expect(chain.backfillChunkSize).toBeGreaterThan(0)
      expect(chain.confirmations).toBeGreaterThanOrEqual(0)
      expect(chain.pollingInterval).toBeGreaterThan(0)
    }
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/config/__tests__/chains.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement chain config**

```typescript
// src/config/chains.ts
export type ChainConfig = {
  id: number
  name: string
  rpc: { http: string; ws?: string }
  contracts: {
    identity: `0x${string}`
    reputation: `0x${string}`
    validation?: `0x${string}`
  }
  explorer: string
  badge: { label: string; color: string }
  backfillWindow: number
  backfillChunkSize: number
  confirmations: number
  pollingInterval: number
}

export const chains: ChainConfig[] = [
  {
    id: 44787,
    name: 'Celo Alfajores',
    rpc: { http: 'https://alfajores-forno.celo-testnet.org' },
    contracts: {
      identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
      reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    },
    explorer: 'https://alfajores.celoscan.io',
    badge: { label: 'Alfajores', color: '#FCFF52' },
    backfillWindow: 7200,
    backfillChunkSize: 2000,
    confirmations: 1,
    pollingInterval: 4000,
  },
  {
    id: 42220,
    name: 'Celo',
    rpc: { http: 'https://forno.celo.org' },
    contracts: {
      identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    },
    explorer: 'https://celoscan.io',
    badge: { label: 'Celo', color: '#35D07F' },
    backfillWindow: 7200,
    backfillChunkSize: 2000,
    confirmations: 1,
    pollingInterval: 4000,
  },
]

export function getChain(chainId: number): ChainConfig | undefined {
  return chains.find((c) => c.id === chainId)
}
```

```typescript
// src/config/contracts.ts
export const identityRegistryAbi = [
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'URIUpdated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'newURI', type: 'string', indexed: false },
      { name: 'updatedBy', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'MetadataSet',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'indexedMetadataKey', type: 'string', indexed: true },
      { name: 'metadataKey', type: 'string', indexed: false },
      { name: 'metadataValue', type: 'bytes', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

export const reputationRegistryAbi = [
  {
    type: 'event',
    name: 'NewFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'clientAddress', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: false },
      { name: 'value', type: 'int128', indexed: false },
      { name: 'valueDecimals', type: 'uint8', indexed: false },
      { name: 'indexedTag1', type: 'string', indexed: true },
      { name: 'tag1', type: 'string', indexed: false },
      { name: 'tag2', type: 'string', indexed: false },
      { name: 'endpoint', type: 'string', indexed: false },
      { name: 'feedbackURI', type: 'string', indexed: false },
      { name: 'feedbackHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FeedbackRevoked',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'clientAddress', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ResponseAppended',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'clientAddress', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: false },
      { name: 'responder', type: 'address', indexed: true },
      { name: 'responseURI', type: 'string', indexed: false },
      { name: 'responseHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'reviewers', type: 'address[]' },
      { name: 'tagPrimary', type: 'string' },
      { name: 'tagSecondary', type: 'string' },
    ],
    outputs: [
      { name: 'totalValue', type: 'int256' },
      { name: 'count', type: 'uint256' },
    ],
  },
] as const
```

```typescript
// src/config/constants.ts
export const CURSOR_SAVE_INTERVAL_MS = 30_000
export const CURSOR_SAVE_EVENT_THRESHOLD = 50
export const MAX_FEED_EVENTS = 500
export const MAX_DISCOVERY_SIGNALS = 100
export const BLOCK_TIMESTAMP_CACHE_SIZE = 5000
export const IPFS_GATEWAYS = [
  'https://w3s.link/ipfs/',
  'https://ipfs.io/ipfs/',
]
export const METADATA_FETCH_TIMEOUT_MS = 10_000
```

**Step 4: Run test**

```bash
pnpm test src/config/__tests__/chains.test.ts
```

Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add src/config/ src/test/
git commit -m "feat: add chain config, contract ABIs, and constants"
```

---

### Task 3: Define core types

**Files:**
- Create: `src/types/events.ts`
- Create: `src/types/agents.ts`
- Create: `src/types/graph.ts`
- Create: `src/types/discovery.ts`
- Create: `src/types/cursor.ts`
- Test: `src/types/__tests__/events.test.ts`

**Step 1: Write the test**

```typescript
// src/types/__tests__/events.test.ts
import { describe, it, expect } from 'vitest'
import type { ScopeEvent, RegisterData, FeedbackData } from '../events'

describe('ScopeEvent types', () => {
  it('accepts a valid register event', () => {
    const event: ScopeEvent = {
      chainId: 44787,
      block: 1000,
      txHash: '0xabc',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: {
        agentURI: 'https://example.com/agent.json',
        owner: '0x1234567890abcdef1234567890abcdef12345678',
      } satisfies RegisterData,
    }
    expect(event.kind).toBe('register')
  })

  it('accepts a feedback event with optional timestamp', () => {
    const event: ScopeEvent = {
      chainId: 44787,
      block: 1001,
      txHash: '0xdef',
      logIndex: 1,
      timestamp: 1707900000,
      kind: 'feedback',
      agentId: 2,
      data: {
        clientAddress: '0xabcdef',
        feedbackIndex: 0n,
        value: 92n,
        valueDecimals: 0,
        tag1: 'starred',
        tag2: '',
        endpoint: '',
        feedbackURI: '',
        feedbackHash: '0x0',
      } satisfies FeedbackData,
    }
    expect(event.timestamp).toBe(1707900000)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/types/__tests__/events.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement types**

```typescript
// src/types/events.ts
export type EventKind =
  | 'register'
  | 'uri_update'
  | 'metadata'
  | 'feedback'
  | 'feedback_revoked'
  | 'response'
  | 'validation_req'
  | 'validation_res'

export type RegisterData = {
  agentURI: string
  owner: string
}

export type URIUpdateData = {
  newURI: string
  updatedBy: string
}

export type MetadataData = {
  metadataKey: string
  metadataValue: string
}

export type FeedbackData = {
  clientAddress: string
  feedbackIndex: bigint
  value: bigint
  valueDecimals: number
  tag1: string
  tag2: string
  endpoint: string
  feedbackURI: string
  feedbackHash: string
}

export type FeedbackRevokedData = {
  clientAddress: string
  feedbackIndex: bigint
}

export type ResponseData = {
  clientAddress: string
  feedbackIndex: bigint
  responder: string
  responseURI: string
  responseHash: string
}

export type ValidationReqData = {
  validatorAddress: string
  requestURI: string
  requestHash: string
}

export type ValidationResData = {
  validatorAddress: string
  requestHash: string
  response: number
  responseURI: string
  responseHash: string
  tag: string
}

export type ScopeEventData =
  | RegisterData
  | URIUpdateData
  | MetadataData
  | FeedbackData
  | FeedbackRevokedData
  | ResponseData
  | ValidationReqData
  | ValidationResData

export type ScopeEvent = {
  chainId: number
  block: number
  txHash: string
  logIndex: number
  timestamp?: number
  kind: EventKind
  agentId: number
  data: ScopeEventData
}
```

```typescript
// src/types/agents.ts
export type AgentService = {
  type: 'a2a' | 'mcp' | 'x402' | 'web' | 'ens' | 'did' | 'email'
  url?: string
  version?: string
}

export type AgentMetadata = {
  name: string
  description: string
  image?: string
  services: AgentService[]
  x402?: boolean
}

export type AgentSummary = {
  agentId: number
  chainId: number
  owner: string
  agentURI: string
  metadata?: AgentMetadata
  feedbackCount: number
  positiveFeedback: number
  negativeFeedback: number
  lastEventBlock: number
  registeredAt?: number
}
```

```typescript
// src/types/graph.ts
export type GraphNode = {
  id: string // "chainId:agentId"
  agentId: number
  chainId: number
  label: string
  feedbackCount: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

export type TrustEdge = {
  source: string // "chainId:agentId"
  target: string // "chainId:agentId"
  kind: 'feedback' | 'validation'
  value: number
  timestamp?: number
}
```

```typescript
// src/types/discovery.ts
export type SignalKind =
  | 'first_blood'
  | 'trust_cluster'
  | 'reputation_crash'
  | 'rising_star'
  | 'x402_ready'
  | 'multi_chain_agent'
  | 'sybil_alert'

export type DiscoverySignal = {
  kind: SignalKind
  title: string
  description: string
  agentIds: number[]
  chainId: number
  timestamp: number
  severity: 'info' | 'warning' | 'critical'
}
```

```typescript
// src/types/cursor.ts
export type CursorState = {
  chainId: number
  lastBlock: number
  lastBlockHash: string
  lastLogIndex: number
  timestamp: number
}
```

**Step 4: Run test**

```bash
pnpm test src/types/__tests__/events.test.ts
```

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add core types (events, agents, graph, discovery, cursor)"
```

---

## Phase 1: Pipeline

### Task 4: Event parser (raw logs to ScopeEvent)

**Files:**
- Create: `src/lib/pipeline/parse.ts`
- Test: `src/lib/pipeline/__tests__/parse.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/pipeline/__tests__/parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseIdentityLog, parseReputationLog } from '../parse'

describe('parseIdentityLog', () => {
  it('parses a Registered event', () => {
    const result = parseIdentityLog({
      eventName: 'Registered',
      args: { agentId: 1n, agentURI: 'https://example.com/a.json', owner: '0xabc' },
      blockNumber: 1000n,
      transactionHash: '0xdef',
      logIndex: 0,
    }, 44787)

    expect(result).toEqual({
      chainId: 44787,
      block: 1000,
      txHash: '0xdef',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: { agentURI: 'https://example.com/a.json', owner: '0xabc' },
    })
  })

  it('parses a URIUpdated event', () => {
    const result = parseIdentityLog({
      eventName: 'URIUpdated',
      args: { agentId: 2n, newURI: 'ipfs://Qm...', updatedBy: '0x123' },
      blockNumber: 1001n,
      transactionHash: '0xghi',
      logIndex: 1,
    }, 44787)

    expect(result).toEqual({
      chainId: 44787,
      block: 1001,
      txHash: '0xghi',
      logIndex: 1,
      kind: 'uri_update',
      agentId: 2,
      data: { newURI: 'ipfs://Qm...', updatedBy: '0x123' },
    })
  })
})

describe('parseReputationLog', () => {
  it('parses a NewFeedback event', () => {
    const result = parseReputationLog({
      eventName: 'NewFeedback',
      args: {
        agentId: 1n,
        clientAddress: '0xabc',
        feedbackIndex: 0n,
        value: 92n,
        valueDecimals: 0,
        indexedTag1: 'starred',
        tag1: 'starred',
        tag2: '',
        endpoint: '',
        feedbackURI: '',
        feedbackHash: '0x0000',
      },
      blockNumber: 1002n,
      transactionHash: '0xjkl',
      logIndex: 2,
    }, 44787)

    expect(result?.kind).toBe('feedback')
    expect(result?.agentId).toBe(1)
  })

  it('parses a FeedbackRevoked event', () => {
    const result = parseReputationLog({
      eventName: 'FeedbackRevoked',
      args: { agentId: 1n, clientAddress: '0xabc', feedbackIndex: 0n },
      blockNumber: 1003n,
      transactionHash: '0xmno',
      logIndex: 3,
    }, 44787)

    expect(result?.kind).toBe('feedback_revoked')
  })

  it('returns null for unknown event', () => {
    const result = parseReputationLog({
      eventName: 'UnknownEvent',
      args: {},
      blockNumber: 1004n,
      transactionHash: '0xpqr',
      logIndex: 4,
    }, 44787)

    expect(result).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/pipeline/__tests__/parse.test.ts
```

Expected: FAIL.

**Step 3: Implement parser**

```typescript
// src/lib/pipeline/parse.ts
import type { ScopeEvent } from '@/types/events'

type RawLog = {
  eventName: string
  args: Record<string, unknown>
  blockNumber: bigint
  transactionHash: string
  logIndex: number
}

export function parseIdentityLog(log: RawLog, chainId: number): ScopeEvent | null {
  const base = {
    chainId,
    block: Number(log.blockNumber),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  }

  switch (log.eventName) {
    case 'Registered':
      return {
        ...base,
        kind: 'register',
        agentId: Number(log.args.agentId as bigint),
        data: {
          agentURI: log.args.agentURI as string,
          owner: log.args.owner as string,
        },
      }
    case 'URIUpdated':
      return {
        ...base,
        kind: 'uri_update',
        agentId: Number(log.args.agentId as bigint),
        data: {
          newURI: log.args.newURI as string,
          updatedBy: log.args.updatedBy as string,
        },
      }
    case 'MetadataSet':
      return {
        ...base,
        kind: 'metadata',
        agentId: Number(log.args.agentId as bigint),
        data: {
          metadataKey: log.args.metadataKey as string,
          metadataValue: log.args.metadataValue as string,
        },
      }
    default:
      return null
  }
}

export function parseReputationLog(log: RawLog, chainId: number): ScopeEvent | null {
  const base = {
    chainId,
    block: Number(log.blockNumber),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  }

  switch (log.eventName) {
    case 'NewFeedback':
      return {
        ...base,
        kind: 'feedback',
        agentId: Number(log.args.agentId as bigint),
        data: {
          clientAddress: log.args.clientAddress as string,
          feedbackIndex: log.args.feedbackIndex as bigint,
          value: log.args.value as bigint,
          valueDecimals: log.args.valueDecimals as number,
          tag1: log.args.tag1 as string,
          tag2: log.args.tag2 as string,
          endpoint: log.args.endpoint as string,
          feedbackURI: log.args.feedbackURI as string,
          feedbackHash: log.args.feedbackHash as string,
        },
      }
    case 'FeedbackRevoked':
      return {
        ...base,
        kind: 'feedback_revoked',
        agentId: Number(log.args.agentId as bigint),
        data: {
          clientAddress: log.args.clientAddress as string,
          feedbackIndex: log.args.feedbackIndex as bigint,
        },
      }
    case 'ResponseAppended':
      return {
        ...base,
        kind: 'response',
        agentId: Number(log.args.agentId as bigint),
        data: {
          clientAddress: log.args.clientAddress as string,
          feedbackIndex: log.args.feedbackIndex as bigint,
          responder: log.args.responder as string,
          responseURI: log.args.responseURI as string,
          responseHash: log.args.responseHash as string,
        },
      }
    default:
      return null
  }
}
```

**Step 4: Run test**

```bash
pnpm test src/lib/pipeline/__tests__/parse.test.ts
```

Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add src/lib/pipeline/
git commit -m "feat: add event parser (raw logs → ScopeEvent)"
```

---

### Task 5: Dedup and reconciliation

**Files:**
- Create: `src/lib/pipeline/reconcile.ts`
- Test: `src/lib/pipeline/__tests__/reconcile.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/pipeline/__tests__/reconcile.test.ts
import { describe, it, expect } from 'vitest'
import { createDeduplicator } from '../reconcile'
import type { ScopeEvent } from '@/types/events'

const makeEvent = (txHash: string, logIndex: number): ScopeEvent => ({
  chainId: 44787,
  block: 1000,
  txHash,
  logIndex,
  kind: 'register',
  agentId: 1,
  data: { agentURI: 'https://example.com', owner: '0x1' },
})

describe('createDeduplicator', () => {
  it('allows first occurrence', () => {
    const dedup = createDeduplicator()
    expect(dedup.isNew(makeEvent('0xabc', 0))).toBe(true)
  })

  it('rejects duplicate txHash + logIndex', () => {
    const dedup = createDeduplicator()
    dedup.isNew(makeEvent('0xabc', 0))
    expect(dedup.isNew(makeEvent('0xabc', 0))).toBe(false)
  })

  it('allows same txHash with different logIndex', () => {
    const dedup = createDeduplicator()
    dedup.isNew(makeEvent('0xabc', 0))
    expect(dedup.isNew(makeEvent('0xabc', 1))).toBe(true)
  })

  it('respects max size (evicts oldest)', () => {
    const dedup = createDeduplicator(2)
    dedup.isNew(makeEvent('0x1', 0))
    dedup.isNew(makeEvent('0x2', 0))
    dedup.isNew(makeEvent('0x3', 0)) // evicts 0x1:0
    expect(dedup.isNew(makeEvent('0x1', 0))).toBe(true) // re-allowed
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/pipeline/__tests__/reconcile.test.ts
```

**Step 3: Implement**

```typescript
// src/lib/pipeline/reconcile.ts
export function createDeduplicator(maxSize = 10_000) {
  const seen = new Map<string, true>()

  function makeKey(txHash: string, logIndex: number): string {
    return `${txHash}:${logIndex}`
  }

  return {
    isNew(event: { txHash: string; logIndex: number }): boolean {
      const key = makeKey(event.txHash, event.logIndex)
      if (seen.has(key)) return false
      seen.set(key, true)
      // Evict oldest if over max
      if (seen.size > maxSize) {
        const first = seen.keys().next().value!
        seen.delete(first)
      }
      return true
    },
    clear() {
      seen.clear()
    },
  }
}
```

**Step 4: Run test**

```bash
pnpm test src/lib/pipeline/__tests__/reconcile.test.ts
```

Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add src/lib/pipeline/reconcile.ts src/lib/pipeline/__tests__/reconcile.test.ts
git commit -m "feat: add event deduplicator (txHash + logIndex)"
```

---

### Task 6: IndexedDB cursor persistence

**Files:**
- Create: `src/lib/cache/idb.ts`
- Test: `src/lib/cache/__tests__/idb.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/cache/__tests__/idb.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createCursorStore } from '../idb'
import type { CursorState } from '@/types/cursor'

// In jsdom, IndexedDB is not available. We test the in-memory fallback.
describe('createCursorStore (in-memory fallback)', () => {
  let store: ReturnType<typeof createCursorStore>

  beforeEach(() => {
    store = createCursorStore()
  })

  it('returns null for unknown chain', async () => {
    const cursor = await store.getCursor(99999)
    expect(cursor).toBeNull()
  })

  it('saves and retrieves cursor', async () => {
    const cursor: CursorState = {
      chainId: 44787,
      lastBlock: 1000,
      lastBlockHash: '0xabc',
      lastLogIndex: 5,
      timestamp: Date.now(),
    }
    await store.saveCursor(cursor)
    const retrieved = await store.getCursor(44787)
    expect(retrieved).toEqual(cursor)
  })

  it('overwrites previous cursor for same chain', async () => {
    await store.saveCursor({
      chainId: 44787, lastBlock: 1000, lastBlockHash: '0xabc',
      lastLogIndex: 0, timestamp: 1,
    })
    await store.saveCursor({
      chainId: 44787, lastBlock: 2000, lastBlockHash: '0xdef',
      lastLogIndex: 3, timestamp: 2,
    })
    const cursor = await store.getCursor(44787)
    expect(cursor?.lastBlock).toBe(2000)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/cache/__tests__/idb.test.ts
```

**Step 3: Implement**

```typescript
// src/lib/cache/idb.ts
import type { CursorState } from '@/types/cursor'

// Use IndexedDB when available, fall back to in-memory Map
export function createCursorStore() {
  const memory = new Map<number, CursorState>()

  // IndexedDB helpers (lazy init)
  let dbPromise: Promise<IDBDatabase> | null = null

  function getDb(): Promise<IDBDatabase> | null {
    if (typeof window === 'undefined' || !window.indexedDB) return null
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('denscope', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('cursors')) {
          db.createObjectStore('cursors', { keyPath: 'chainId' })
        }
        if (!db.objectStoreNames.contains('blockTimestamps')) {
          db.createObjectStore('blockTimestamps')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return dbPromise
  }

  return {
    async getCursor(chainId: number): Promise<CursorState | null> {
      const db = getDb()
      if (!db) return memory.get(chainId) ?? null
      try {
        const resolved = await db
        return new Promise((resolve, reject) => {
          const tx = resolved.transaction('cursors', 'readonly')
          const req = tx.objectStore('cursors').get(chainId)
          req.onsuccess = () => resolve(req.result ?? null)
          req.onerror = () => reject(req.error)
        })
      } catch {
        return memory.get(chainId) ?? null
      }
    },

    async saveCursor(cursor: CursorState): Promise<void> {
      memory.set(cursor.chainId, cursor)
      const db = getDb()
      if (!db) return
      try {
        const resolved = await db
        return new Promise((resolve, reject) => {
          const tx = resolved.transaction('cursors', 'readwrite')
          tx.objectStore('cursors').put(cursor)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      } catch {
        // IndexedDB unavailable, memory fallback already set
      }
    },
  }
}
```

**Step 4: Run test**

```bash
pnpm test src/lib/cache/__tests__/idb.test.ts
```

Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add src/lib/cache/
git commit -m "feat: add IndexedDB cursor persistence with in-memory fallback"
```

---

### Task 7: Block timestamp cache

**Files:**
- Create: `src/lib/cache/block-timestamps.ts`
- Test: `src/lib/cache/__tests__/block-timestamps.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/cache/__tests__/block-timestamps.test.ts
import { describe, it, expect } from 'vitest'
import { createBlockTimestampCache } from '../block-timestamps'

describe('createBlockTimestampCache', () => {
  it('returns undefined for unknown block', () => {
    const cache = createBlockTimestampCache()
    expect(cache.get(1000)).toBeUndefined()
  })

  it('stores and retrieves timestamp', () => {
    const cache = createBlockTimestampCache()
    cache.set(1000, 1707900000)
    expect(cache.get(1000)).toBe(1707900000)
  })

  it('evicts oldest when over max size', () => {
    const cache = createBlockTimestampCache(2)
    cache.set(1, 100)
    cache.set(2, 200)
    cache.set(3, 300) // evicts block 1
    expect(cache.get(1)).toBeUndefined()
    expect(cache.get(2)).toBe(200)
    expect(cache.get(3)).toBe(300)
  })

  it('extractUniqueBlocks returns only uncached blocks', () => {
    const cache = createBlockTimestampCache()
    cache.set(100, 1000)
    cache.set(200, 2000)
    const unique = cache.extractUniqueBlocks([100, 200, 300, 300, 400])
    expect(unique).toEqual([300, 400])
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/cache/__tests__/block-timestamps.test.ts
```

**Step 3: Implement**

```typescript
// src/lib/cache/block-timestamps.ts
import { BLOCK_TIMESTAMP_CACHE_SIZE } from '@/config/constants'

export function createBlockTimestampCache(maxSize = BLOCK_TIMESTAMP_CACHE_SIZE) {
  const cache = new Map<number, number>()

  return {
    get(blockNumber: number): number | undefined {
      return cache.get(blockNumber)
    },
    set(blockNumber: number, timestamp: number) {
      cache.set(blockNumber, timestamp)
      if (cache.size > maxSize) {
        const first = cache.keys().next().value!
        cache.delete(first)
      }
    },
    extractUniqueBlocks(blockNumbers: number[]): number[] {
      const unique = new Set<number>()
      for (const b of blockNumbers) {
        if (!cache.has(b)) unique.add(b)
      }
      return Array.from(unique)
    },
  }
}
```

**Step 4: Run test**

```bash
pnpm test src/lib/cache/__tests__/block-timestamps.test.ts
```

Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add src/lib/cache/block-timestamps.ts src/lib/cache/__tests__/block-timestamps.test.ts
git commit -m "feat: add block timestamp LRU cache"
```

---

### Task 8: Zustand stores (events, agents, discovery)

**Files:**
- Create: `src/stores/events.ts`
- Create: `src/stores/agents.ts`
- Create: `src/stores/graph.ts`
- Create: `src/stores/discovery.ts`
- Test: `src/stores/__tests__/events.test.ts`
- Test: `src/stores/__tests__/agents.test.ts`

**Step 1: Write the tests**

```typescript
// src/stores/__tests__/events.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useEventStore } from '../events'
import type { ScopeEvent } from '@/types/events'

const makeEvent = (block: number, kind: string = 'register'): ScopeEvent => ({
  chainId: 44787,
  block,
  txHash: `0x${block}`,
  logIndex: 0,
  kind: kind as ScopeEvent['kind'],
  agentId: 1,
  data: { agentURI: 'https://example.com', owner: '0x1' },
})

describe('useEventStore', () => {
  beforeEach(() => {
    useEventStore.getState().clear()
  })

  it('starts empty', () => {
    expect(useEventStore.getState().events).toEqual([])
  })

  it('pushes events (newest first)', () => {
    useEventStore.getState().push(makeEvent(100))
    useEventStore.getState().push(makeEvent(101))
    const events = useEventStore.getState().events
    expect(events[0].block).toBe(101)
    expect(events[1].block).toBe(100)
  })

  it('respects max size', () => {
    for (let i = 0; i < 600; i++) {
      useEventStore.getState().push(makeEvent(i))
    }
    expect(useEventStore.getState().events.length).toBeLessThanOrEqual(500)
  })
})
```

```typescript
// src/stores/__tests__/agents.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentStore } from '../agents'

describe('useAgentStore', () => {
  beforeEach(() => {
    useAgentStore.getState().clear()
  })

  it('upserts agent on register', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787,
      block: 100,
      txHash: '0x1',
      logIndex: 0,
      kind: 'register',
      agentId: 1,
      data: { agentURI: 'https://example.com', owner: '0xabc' },
    })
    const agent = useAgentStore.getState().agents.get('44787:1')
    expect(agent).toBeDefined()
    expect(agent!.owner).toBe('0xabc')
  })

  it('increments feedback count on feedback event', () => {
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787, block: 100, txHash: '0x1', logIndex: 0,
      kind: 'register', agentId: 1,
      data: { agentURI: 'https://example.com', owner: '0xabc' },
    })
    useAgentStore.getState().upsertFromEvent({
      chainId: 44787, block: 101, txHash: '0x2', logIndex: 0,
      kind: 'feedback', agentId: 1,
      data: {
        clientAddress: '0xdef', feedbackIndex: 0n, value: 50n,
        valueDecimals: 0, tag1: '', tag2: '', endpoint: '',
        feedbackURI: '', feedbackHash: '0x0',
      },
    })
    const agent = useAgentStore.getState().agents.get('44787:1')
    expect(agent!.feedbackCount).toBe(1)
    expect(agent!.positiveFeedback).toBe(1)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test src/stores/__tests__/
```

**Step 3: Implement stores**

```typescript
// src/stores/events.ts
import { create } from 'zustand'
import type { ScopeEvent } from '@/types/events'
import { MAX_FEED_EVENTS } from '@/config/constants'

type EventStoreState = {
  events: ScopeEvent[]
  push: (event: ScopeEvent) => void
  pushBatch: (events: ScopeEvent[]) => void
  clear: () => void
}

export const useEventStore = create<EventStoreState>()((set) => ({
  events: [],
  push: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, MAX_FEED_EVENTS),
    })),
  pushBatch: (events) =>
    set((state) => ({
      events: [...events.reverse(), ...state.events].slice(0, MAX_FEED_EVENTS),
    })),
  clear: () => set({ events: [] }),
}))
```

```typescript
// src/stores/agents.ts
import { create } from 'zustand'
import type { AgentSummary } from '@/types/agents'
import type { ScopeEvent, FeedbackData } from '@/types/events'

type AgentStoreState = {
  agents: Map<string, AgentSummary>
  upsertFromEvent: (event: ScopeEvent) => void
  clear: () => void
}

function agentKey(chainId: number, agentId: number): string {
  return `${chainId}:${agentId}`
}

export const useAgentStore = create<AgentStoreState>()((set, get) => ({
  agents: new Map(),
  upsertFromEvent: (event) => {
    const key = agentKey(event.chainId, event.agentId)
    const agents = new Map(get().agents)
    const existing = agents.get(key) ?? {
      agentId: event.agentId,
      chainId: event.chainId,
      owner: '',
      agentURI: '',
      feedbackCount: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      lastEventBlock: 0,
    }

    existing.lastEventBlock = event.block

    switch (event.kind) {
      case 'register': {
        const data = event.data as { agentURI: string; owner: string }
        existing.owner = data.owner
        existing.agentURI = data.agentURI
        existing.registeredAt = event.timestamp
        break
      }
      case 'uri_update': {
        const data = event.data as { newURI: string }
        existing.agentURI = data.newURI
        break
      }
      case 'feedback': {
        const data = event.data as FeedbackData
        existing.feedbackCount++
        if (data.value > 0n) existing.positiveFeedback++
        else if (data.value < 0n) existing.negativeFeedback++
        break
      }
    }

    agents.set(key, { ...existing })
    set({ agents })
  },
  clear: () => set({ agents: new Map() }),
}))
```

```typescript
// src/stores/graph.ts
import { create } from 'zustand'
import type { GraphNode, TrustEdge } from '@/types/graph'

type GraphStoreState = {
  nodes: Map<string, GraphNode>
  edges: TrustEdge[]
  addNode: (node: GraphNode) => void
  addEdge: (edge: TrustEdge) => void
  clear: () => void
}

export const useGraphStore = create<GraphStoreState>()((set, get) => ({
  nodes: new Map(),
  edges: [],
  addNode: (node) => {
    const nodes = new Map(get().nodes)
    nodes.set(node.id, node)
    set({ nodes })
  },
  addEdge: (edge) =>
    set((state) => ({ edges: [...state.edges, edge] })),
  clear: () => set({ nodes: new Map(), edges: [] }),
}))
```

```typescript
// src/stores/discovery.ts
import { create } from 'zustand'
import type { DiscoverySignal } from '@/types/discovery'
import { MAX_DISCOVERY_SIGNALS } from '@/config/constants'

type DiscoveryStoreState = {
  signals: DiscoverySignal[]
  push: (signal: DiscoverySignal) => void
  clear: () => void
}

export const useDiscoveryStore = create<DiscoveryStoreState>()((set) => ({
  signals: [],
  push: (signal) =>
    set((state) => ({
      signals: [signal, ...state.signals].slice(0, MAX_DISCOVERY_SIGNALS),
    })),
  clear: () => set({ signals: [] }),
}))
```

**Step 4: Run tests**

```bash
pnpm test src/stores/__tests__/
```

Expected: PASS (5 tests across 2 files).

**Step 5: Commit**

```bash
git add src/stores/
git commit -m "feat: add zustand stores (events, agents, graph, discovery)"
```

---

### Task 9: Ingestion orchestrator (getLogs + watchContractEvent)

**Files:**
- Create: `src/lib/pipeline/ingest.ts`
- Create: `src/lib/pipeline/client.ts`

> **Note:** This task connects to live RPC. No unit test for the orchestrator itself — it's integration code. The individual pieces (parse, dedup, cursor) are already tested. Manual verification with `pnpm dev` against Alfajores testnet.

**Step 1: Create viem client factory**

```typescript
// src/lib/pipeline/client.ts
import { createPublicClient, http } from 'viem'
import { celo, celoAlfajores } from 'viem/chains'
import type { ChainConfig } from '@/config/chains'

const viemChains: Record<number, typeof celo> = {
  42220: celo,
  44787: celoAlfajores,
}

export function createChainClient(config: ChainConfig) {
  const chain = viemChains[config.id]
  return createPublicClient({
    chain,
    transport: http(config.rpc.http),
  })
}
```

**Step 2: Create ingestion orchestrator**

```typescript
// src/lib/pipeline/ingest.ts
import type { ChainConfig } from '@/config/chains'
import { identityRegistryAbi, reputationRegistryAbi } from '@/config/contracts'
import { createChainClient } from './client'
import { parseIdentityLog, parseReputationLog } from './parse'
import { createDeduplicator } from './reconcile'
import { createCursorStore } from '@/lib/cache/idb'
import { createBlockTimestampCache } from '@/lib/cache/block-timestamps'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'
import { useGraphStore } from '@/stores/graph'
import type { ScopeEvent, FeedbackData } from '@/types/events'
import type { CursorState } from '@/types/cursor'
import { CURSOR_SAVE_INTERVAL_MS } from '@/config/constants'

export type PipelineHandle = {
  stop: () => void
  status: () => 'running' | 'stopped'
}

export async function startPipeline(chain: ChainConfig): Promise<PipelineHandle> {
  const client = createChainClient(chain)
  const cursorStore = createCursorStore()
  const dedup = createDeduplicator()
  const tsCache = createBlockTimestampCache()
  let running = true

  // --- Process a batch of events ---
  function processEvent(event: ScopeEvent) {
    if (!dedup.isNew(event)) return
    useEventStore.getState().push(event)
    useAgentStore.getState().upsertFromEvent(event)

    // Build graph edges for feedback
    if (event.kind === 'feedback') {
      const data = event.data as FeedbackData
      const sourceId = `${event.chainId}:${data.clientAddress}`
      const targetId = `${event.chainId}:${event.agentId}`
      useGraphStore.getState().addEdge({
        source: sourceId,
        target: targetId,
        kind: 'feedback',
        value: Number(data.value),
        timestamp: event.timestamp,
      })
    }

    // Add/update graph node
    useGraphStore.getState().addNode({
      id: `${event.chainId}:${event.agentId}`,
      agentId: event.agentId,
      chainId: event.chainId,
      label: `Agent #${event.agentId}`,
      feedbackCount:
        useAgentStore.getState().agents.get(`${event.chainId}:${event.agentId}`)
          ?.feedbackCount ?? 0,
    })
  }

  // --- Backfill with getLogs (paginated) ---
  async function backfill(fromBlock: bigint, toBlock: bigint) {
    for (let start = fromBlock; start <= toBlock; start += BigInt(chain.backfillChunkSize)) {
      if (!running) return
      const end = start + BigInt(chain.backfillChunkSize) - 1n > toBlock
        ? toBlock
        : start + BigInt(chain.backfillChunkSize) - 1n

      // Fetch identity + reputation logs in parallel
      const [identityLogs, reputationLogs] = await Promise.all([
        client.getContractEvents({
          address: chain.contracts.identity,
          abi: identityRegistryAbi,
          fromBlock: start,
          toBlock: end,
        }),
        client.getContractEvents({
          address: chain.contracts.reputation,
          abi: reputationRegistryAbi,
          fromBlock: start,
          toBlock: end,
        }),
      ])

      // Parse and process
      for (const log of identityLogs) {
        const event = parseIdentityLog(log as never, chain.id)
        if (event) processEvent(event)
      }
      for (const log of reputationLogs) {
        const event = parseReputationLog(log as never, chain.id)
        if (event) processEvent(event)
      }
    }
  }

  // --- Boot sequence ---
  const latestBlock = await client.getBlockNumber()
  const safeBlock = latestBlock - BigInt(chain.confirmations)
  const savedCursor = await cursorStore.getCursor(chain.id)

  let startBlock: bigint
  if (savedCursor) {
    // Verify block hash for reorg detection
    try {
      const block = await client.getBlock({ blockNumber: BigInt(savedCursor.lastBlock) })
      if (block.hash === savedCursor.lastBlockHash) {
        startBlock = BigInt(savedCursor.lastBlock) + 1n
      } else {
        // Reorg detected — rollback
        const rollback = Math.max(0, savedCursor.lastBlock - 200)
        startBlock = BigInt(rollback)
      }
    } catch {
      startBlock = safeBlock - BigInt(chain.backfillWindow)
    }
  } else {
    startBlock = safeBlock - BigInt(chain.backfillWindow)
    if (startBlock < 0n) startBlock = 0n
  }

  // Backfill
  await backfill(startBlock, safeBlock)

  // Save cursor after backfill
  const latestSafeBlock = await client.getBlock({ blockNumber: safeBlock })
  await cursorStore.saveCursor({
    chainId: chain.id,
    lastBlock: Number(safeBlock),
    lastBlockHash: latestSafeBlock.hash ?? '',
    lastLogIndex: 0,
    timestamp: Date.now(),
  })

  // --- Realtime tail with polling ---
  const unwatchIdentity = client.watchContractEvent({
    address: chain.contracts.identity,
    abi: identityRegistryAbi,
    poll: true,
    pollingInterval: chain.pollingInterval,
    onLogs: (logs) => {
      for (const log of logs) {
        const event = parseIdentityLog(log as never, chain.id)
        if (event) {
          event.timestamp = Date.now()
          processEvent(event)
        }
      }
    },
  })

  const unwatchReputation = client.watchContractEvent({
    address: chain.contracts.reputation,
    abi: reputationRegistryAbi,
    poll: true,
    pollingInterval: chain.pollingInterval,
    onLogs: (logs) => {
      for (const log of logs) {
        const event = parseReputationLog(log as never, chain.id)
        if (event) {
          event.timestamp = Date.now()
          processEvent(event)
        }
      }
    },
  })

  // Periodic cursor save
  const cursorInterval = setInterval(async () => {
    if (!running) return
    try {
      const block = await client.getBlock()
      await cursorStore.saveCursor({
        chainId: chain.id,
        lastBlock: Number(block.number),
        lastBlockHash: block.hash ?? '',
        lastLogIndex: 0,
        timestamp: Date.now(),
      })
    } catch {
      // Silently fail cursor save
    }
  }, CURSOR_SAVE_INTERVAL_MS)

  return {
    stop: () => {
      running = false
      unwatchIdentity()
      unwatchReputation()
      clearInterval(cursorInterval)
    },
    status: () => (running ? 'running' : 'stopped'),
  }
}
```

**Step 3: Verify build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/lib/pipeline/client.ts src/lib/pipeline/ingest.ts
git commit -m "feat: add ingestion orchestrator (backfill + realtime polling)"
```

---

## Phase 2: Live Feed (MVP)

### Task 10: Layout shell (header + status bar + nav)

**Files:**
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/StatusBar.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create Header**

```tsx
// src/components/layout/Header.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Live Feed' },
  { href: '/graph', label: 'Trust Graph' },
  { href: '/discovery', label: 'Discovery' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight text-white">
            DenScope
          </h1>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pathname === item.href
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
            Alfajores
          </span>
        </div>
      </div>
    </header>
  )
}
```

**Step 2: Create StatusBar**

```tsx
// src/components/layout/StatusBar.tsx
'use client'

import { useEventStore } from '@/stores/events'

export function StatusBar() {
  const eventCount = useEventStore((s) => s.events.length)

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-6 py-2">
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          connected
        </span>
        <span>{eventCount} events</span>
      </div>
    </footer>
  )
}
```

**Step 3: Update layout.tsx**

Replace the default `src/app/layout.tsx` with:

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { StatusBar } from '@/components/layout/StatusBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DenScope — ERC-8004 Agent Explorer',
  description: 'Real-time explorer for ERC-8004 trustless agent identity and reputation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex h-screen flex-col bg-zinc-950 text-white`}>
        <Header />
        <main className="flex-1 overflow-hidden">{children}</main>
        <StatusBar />
      </body>
    </html>
  )
}
```

**Step 4: Verify**

```bash
pnpm build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/layout/ src/app/layout.tsx src/app/page.tsx
git commit -m "feat: add layout shell (header, nav, status bar)"
```

---

### Task 11: LiveFeed + FeedLine components

**Files:**
- Create: `src/components/feed/LiveFeed.tsx`
- Create: `src/components/feed/FeedLine.tsx`
- Create: `src/components/feed/PulseEffect.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create FeedLine**

```tsx
// src/components/feed/FeedLine.tsx
'use client'

import type { ScopeEvent } from '@/types/events'

const kindColors: Record<string, string> = {
  register: 'text-emerald-400',
  uri_update: 'text-sky-400',
  metadata: 'text-sky-400',
  feedback: 'text-blue-400',
  feedback_revoked: 'text-red-400',
  response: 'text-purple-400',
  validation_req: 'text-amber-400',
  validation_res: 'text-amber-400',
}

const kindLabels: Record<string, string> = {
  register: 'REGISTER',
  uri_update: 'URI_UPD',
  metadata: 'METADATA',
  feedback: 'FEEDBACK',
  feedback_revoked: 'REVOKE',
  response: 'RESPONSE',
  validation_req: 'VAL_REQ',
  validation_res: 'VAL_RES',
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '--:--:--'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
}

function formatSummary(event: ScopeEvent): string {
  switch (event.kind) {
    case 'register': {
      const d = event.data as { agentURI: string }
      return `Agent #${event.agentId} registered`
    }
    case 'feedback': {
      const d = event.data as { clientAddress: string; value: bigint; tag1: string }
      const score = Number(d.value)
      const tag = d.tag1 ? ` [${d.tag1}]` : ''
      return `Agent #${event.agentId} ← ${score > 0 ? '+' : ''}${score} by ${d.clientAddress.slice(0, 8)}..${tag}`
    }
    case 'feedback_revoked':
      return `Feedback on Agent #${event.agentId} revoked`
    default:
      return `Agent #${event.agentId}`
  }
}

export function FeedLine({ event, onClick }: { event: ScopeEvent; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full gap-3 px-4 py-1 text-left font-mono text-sm transition-colors hover:bg-zinc-900"
    >
      <span className="shrink-0 text-zinc-600">{formatTime(event.timestamp)}</span>
      <span className={`shrink-0 w-20 font-semibold ${kindColors[event.kind] ?? 'text-zinc-400'}`}>
        {kindLabels[event.kind] ?? event.kind.toUpperCase()}
      </span>
      <span className="truncate text-zinc-300">{formatSummary(event)}</span>
    </button>
  )
}
```

**Step 2: Create PulseEffect**

```tsx
// src/components/feed/PulseEffect.tsx
'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function PulseEffect({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, backgroundColor: 'rgba(52, 211, 153, 0.08)' }}
      animate={{ opacity: 1, backgroundColor: 'rgba(52, 211, 153, 0)' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
```

**Step 3: Create LiveFeed**

```tsx
// src/components/feed/LiveFeed.tsx
'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEventStore } from '@/stores/events'
import { FeedLine } from './FeedLine'
import { PulseEffect } from './PulseEffect'

export function LiveFeed() {
  const events = useEventStore((s) => s.events)
  const containerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {events.length === 0 ? (
        <div className="flex h-full items-center justify-center text-zinc-600">
          <div className="text-center">
            <p className="text-lg">Waiting for events...</p>
            <p className="mt-1 text-sm">Listening on ERC-8004 contracts</p>
          </div>
        </div>
      ) : (
        <div className="py-2">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <motion.div
                key={`${event.txHash}:${event.logIndex}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PulseEffect>
                  <FeedLine event={event} />
                </PulseEffect>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {paused && (
        <div className="pointer-events-none fixed bottom-12 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
            paused — move mouse away to resume
          </span>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Update page.tsx**

```tsx
// src/app/page.tsx
import { LiveFeed } from '@/components/feed/LiveFeed'

export default function FeedPage() {
  return <LiveFeed />
}
```

**Step 5: Verify build**

```bash
pnpm build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/components/feed/ src/app/page.tsx
git commit -m "feat: add LiveFeed with FeedLine and pulse animations"
```

---

### Task 12: Pipeline bootstrap (connect feed to chain)

**Files:**
- Create: `src/components/providers/PipelineProvider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create PipelineProvider**

```tsx
// src/components/providers/PipelineProvider.tsx
'use client'

import { useEffect, useRef } from 'react'
import { chains } from '@/config/chains'
import { startPipeline, type PipelineHandle } from '@/lib/pipeline/ingest'

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const pipelines = useRef<PipelineHandle[]>([])

  useEffect(() => {
    // Start pipeline for each configured chain
    const handles: PipelineHandle[] = []

    for (const chain of chains) {
      startPipeline(chain).then((handle) => {
        handles.push(handle)
      }).catch((err) => {
        console.error(`Pipeline failed for ${chain.name}:`, err)
      })
    }

    pipelines.current = handles

    return () => {
      for (const h of handles) {
        h.stop()
      }
    }
  }, [])

  return <>{children}</>
}
```

**Step 2: Add to layout**

Wrap `{children}` in layout.tsx with `<PipelineProvider>`:

In `src/app/layout.tsx`, wrap the body content:

```tsx
<body className={`${inter.className} flex h-screen flex-col bg-zinc-950 text-white`}>
  <PipelineProvider>
    <Header />
    <main className="flex-1 overflow-hidden">{children}</main>
    <StatusBar />
  </PipelineProvider>
</body>
```

Add import: `import { PipelineProvider } from '@/components/providers/PipelineProvider'`

**Step 3: Manual test**

```bash
pnpm dev
```

Open `http://localhost:3000`. Should see:
- Header with "DenScope" and nav links
- "Waiting for events..." or live feed (if events on Alfajores)
- Status bar at bottom

**Step 4: Commit**

```bash
git add src/components/providers/ src/app/layout.tsx
git commit -m "feat: add PipelineProvider, connect live feed to chain"
```

---

**At this point, Phase 0-2 MVP is complete.** The app connects to Celo Alfajores, backfills recent events, and streams new ones in real-time with pulse animations.

---

## Phase 3: X-Ray Panel

### Task 13: Agent metadata reader

**Files:**
- Create: `src/lib/agent/read.ts`
- Create: `src/lib/agent/metadata.ts`
- Test: `src/lib/agent/__tests__/metadata.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/agent/__tests__/metadata.test.ts
import { describe, it, expect } from 'vitest'
import { parseAgentMetadata } from '../metadata'

describe('parseAgentMetadata', () => {
  it('parses a valid registration JSON', () => {
    const json = {
      name: 'TestBot',
      description: 'A test agent',
      image: 'https://example.com/img.png',
      services: [
        { type: 'a2a', url: 'https://agent.example.com' },
        { type: 'mcp', url: 'https://mcp.example.com', version: '1.2' },
      ],
      x402: true,
    }
    const result = parseAgentMetadata(json)
    expect(result.name).toBe('TestBot')
    expect(result.services).toHaveLength(2)
    expect(result.x402).toBe(true)
  })

  it('handles missing optional fields', () => {
    const json = { name: 'MinimalBot' }
    const result = parseAgentMetadata(json)
    expect(result.name).toBe('MinimalBot')
    expect(result.services).toEqual([])
    expect(result.x402).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/agent/__tests__/metadata.test.ts
```

**Step 3: Implement**

```typescript
// src/lib/agent/metadata.ts
import type { AgentMetadata } from '@/types/agents'
import { IPFS_GATEWAYS, METADATA_FETCH_TIMEOUT_MS } from '@/config/constants'

export function parseAgentMetadata(json: Record<string, unknown>): AgentMetadata {
  return {
    name: (json.name as string) ?? 'Unknown Agent',
    description: (json.description as string) ?? '',
    image: json.image as string | undefined,
    services: Array.isArray(json.services)
      ? json.services.map((s: Record<string, string>) => ({
          type: s.type as AgentMetadata['services'][number]['type'],
          url: s.url,
          version: s.version,
        }))
      : [],
    x402: json.x402 === true,
  }
}

function resolveIPFS(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '')
    return `${IPFS_GATEWAYS[0]}${cid}`
  }
  return uri
}

export async function fetchAgentMetadata(agentURI: string): Promise<AgentMetadata | null> {
  const url = resolveIPFS(agentURI)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const json = await res.json()
    return parseAgentMetadata(json)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
```

```typescript
// src/lib/agent/read.ts
import { createChainClient } from '@/lib/pipeline/client'
import { identityRegistryAbi } from '@/config/contracts'
import type { ChainConfig } from '@/config/chains'

export async function readAgentOwner(chain: ChainConfig, agentId: number): Promise<string | null> {
  try {
    const client = createChainClient(chain)
    const owner = await client.readContract({
      address: chain.contracts.identity,
      abi: identityRegistryAbi,
      functionName: 'ownerOf',
      args: [BigInt(agentId)],
    })
    return owner as string
  } catch {
    return null
  }
}

export async function readAgentURI(chain: ChainConfig, agentId: number): Promise<string | null> {
  try {
    const client = createChainClient(chain)
    const uri = await client.readContract({
      address: chain.contracts.identity,
      abi: identityRegistryAbi,
      functionName: 'tokenURI',
      args: [BigInt(agentId)],
    })
    return uri as string
  } catch {
    return null
  }
}
```

**Step 4: Run test**

```bash
pnpm test src/lib/agent/__tests__/metadata.test.ts
```

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add src/lib/agent/
git commit -m "feat: add agent metadata reader and IPFS resolver"
```

---

### Task 14: X-Ray panel UI

**Files:**
- Create: `src/components/xray/XRayPanel.tsx`
- Create: `src/components/xray/AgentIdentity.tsx`
- Create: `src/components/xray/AgentServices.tsx`
- Create: `src/components/shared/ChainBadge.tsx`
- Create: `src/components/shared/AddressChip.tsx`

**Step 1: Create shared components**

```tsx
// src/components/shared/ChainBadge.tsx
import { getChain } from '@/config/chains'

export function ChainBadge({ chainId }: { chainId: number }) {
  const chain = getChain(chainId)
  if (!chain) return null
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${chain.badge.color}20`, color: chain.badge.color }}
    >
      {chain.badge.label}
    </span>
  )
}
```

```tsx
// src/components/shared/AddressChip.tsx
'use client'

import { getChain } from '@/config/chains'

export function AddressChip({ address, chainId }: { address: string; chainId?: number }) {
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`
  const chain = chainId ? getChain(chainId) : null
  const explorerUrl = chain ? `${chain.explorer}/address/${address}` : null

  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm text-zinc-400">
      <span>{truncated}</span>
      <button
        onClick={() => navigator.clipboard.writeText(address)}
        className="text-zinc-600 hover:text-zinc-300"
        title="Copy address"
      >
        copy
      </button>
      {explorerUrl && (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-300">
          ↗
        </a>
      )}
    </span>
  )
}
```

**Step 2: Create AgentIdentity and AgentServices**

```tsx
// src/components/xray/AgentIdentity.tsx
import type { AgentSummary } from '@/types/agents'
import { ChainBadge } from '@/components/shared/ChainBadge'
import { AddressChip } from '@/components/shared/AddressChip'

export function AgentIdentity({ agent }: { agent: AgentSummary }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">
          {agent.metadata?.name ?? `Agent #${agent.agentId}`}
        </h2>
        <ChainBadge chainId={agent.chainId} />
      </div>
      {agent.metadata?.description && (
        <p className="text-sm text-zinc-400">{agent.metadata.description}</p>
      )}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Owner</span>
          <AddressChip address={agent.owner} chainId={agent.chainId} />
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Feedback</span>
          <span className="text-zinc-300">
            {agent.feedbackCount} ({agent.positiveFeedback}+ / {agent.negativeFeedback}-)
          </span>
        </div>
      </div>
    </div>
  )
}
```

```tsx
// src/components/xray/AgentServices.tsx
import type { AgentMetadata } from '@/types/agents'

const serviceLabels: Record<string, string> = {
  a2a: 'A2A',
  mcp: 'MCP',
  x402: 'x402',
  web: 'Web',
  ens: 'ENS',
  did: 'DID',
}

export function AgentServices({ metadata }: { metadata?: AgentMetadata }) {
  if (!metadata) return null
  const badges = [...metadata.services]
  if (metadata.x402) badges.push({ type: 'x402' as const })

  if (badges.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-500">Services</h3>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((s, i) => (
          <span
            key={i}
            className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300"
          >
            {serviceLabels[s.type] ?? s.type}
            {s.version ? ` v${s.version}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Create XRayPanel**

```tsx
// src/components/xray/XRayPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { fetchAgentMetadata } from '@/lib/agent/metadata'
import { AgentIdentity } from './AgentIdentity'
import { AgentServices } from './AgentServices'
import type { AgentMetadata } from '@/types/agents'

type XRayPanelProps = {
  agentKey: string | null // "chainId:agentId"
  onClose: () => void
}

export function XRayPanel({ agentKey, onClose }: XRayPanelProps) {
  const agent = useAgentStore((s) => (agentKey ? s.agents.get(agentKey) : undefined))
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!agent?.agentURI) return
    setLoading(true)
    fetchAgentMetadata(agent.agentURI)
      .then(setMetadata)
      .finally(() => setLoading(false))
  }, [agent?.agentURI])

  const enrichedAgent = agent
    ? { ...agent, metadata: metadata ?? agent.metadata }
    : null

  return (
    <AnimatePresence>
      {agentKey && enrichedAgent && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 z-50 h-full w-96 border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-zinc-500 hover:text-white"
          >
            ✕
          </button>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 rounded bg-zinc-800" />
              <div className="h-4 w-64 rounded bg-zinc-800" />
              <div className="h-4 w-32 rounded bg-zinc-800" />
            </div>
          ) : (
            <div className="space-y-6">
              <AgentIdentity agent={enrichedAgent} />
              <AgentServices metadata={enrichedAgent.metadata} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Step 4: Verify build**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add src/components/xray/ src/components/shared/
git commit -m "feat: add X-Ray panel with agent identity and services"
```

---

### Task 15: Wire X-Ray to Live Feed

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update page to include X-Ray state**

```tsx
// src/app/page.tsx
'use client'

import { useState } from 'react'
import { LiveFeed } from '@/components/feed/LiveFeed'
import { XRayPanel } from '@/components/xray/XRayPanel'

export default function FeedPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-hidden">
        <LiveFeed onAgentClick={setSelectedAgent} />
      </div>
      <XRayPanel agentKey={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  )
}
```

**Step 2: Update LiveFeed to pass click handler**

Add `onAgentClick` prop to `LiveFeed` and `FeedLine`:

In `LiveFeed.tsx`, accept `onAgentClick?: (key: string) => void` prop and pass to FeedLine:

```tsx
<FeedLine
  event={event}
  onClick={() => onAgentClick?.(`${event.chainId}:${event.agentId}`)}
/>
```

**Step 3: Verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/feed/LiveFeed.tsx
git commit -m "feat: wire X-Ray panel to Live Feed click events"
```

---

## Phase 4: Trust Graph

### Task 16: d3-force graph engine

**Files:**
- Create: `src/lib/graph/layout.ts`
- Create: `src/components/graph/TrustGraph.tsx`
- Create: `src/app/graph/page.tsx`

**Step 1: Create layout engine**

```typescript
// src/lib/graph/layout.ts
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { GraphNode, TrustEdge } from '@/types/graph'

export type SimNode = GraphNode & SimulationNodeDatum
export type SimLink = SimulationLinkDatum<SimNode> & { kind: string; value: number }

export function createSimulation(
  nodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
) {
  return forceSimulation(nodes)
    .force('link', forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(80))
    .force('charge', forceManyBody().strength(-200))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(20))
}
```

**Step 2: Create TrustGraph canvas component**

```tsx
// src/components/graph/TrustGraph.tsx
'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useGraphStore } from '@/stores/graph'
import { createSimulation, type SimNode, type SimLink } from '@/lib/graph/layout'

export function TrustGraph({ onNodeClick }: { onNodeClick?: (key: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesMap = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const nodes: SimNode[] = Array.from(nodesMap.values()).map((n) => ({ ...n }))
    const links: SimLink[] = edges
      .filter((e) => nodesMap.has(e.source as string) && nodesMap.has(e.target as string))
      .map((e) => ({ source: e.source, target: e.target, kind: e.kind, value: e.value }))

    if (nodes.length === 0) {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#52525b'
      ctx.textAlign = 'center'
      ctx.fillText('No agents in graph yet', width / 2, height / 2)
      return
    }

    const sim = createSimulation(nodes, links, width, height)

    sim.on('tick', () => {
      ctx.clearRect(0, 0, width, height)

      // Draw edges
      ctx.strokeStyle = '#3f3f46'
      ctx.lineWidth = 1
      for (const link of links) {
        const s = link.source as SimNode
        const t = link.target as SimNode
        ctx.beginPath()
        ctx.moveTo(s.x!, s.y!)
        ctx.lineTo(t.x!, t.y!)
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        const radius = Math.max(4, Math.min(16, 4 + node.feedbackCount * 2))
        ctx.beginPath()
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2)
        ctx.fillStyle = '#34d399'
        ctx.fill()
        ctx.strokeStyle = '#064e3b'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Label
        ctx.fillStyle = '#d4d4d8'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`#${node.agentId}`, node.x!, node.y! + radius + 12)
      }
    })

    return () => sim.stop()
  }, [nodesMap, edges])

  useEffect(() => {
    const cleanup = draw()
    return () => cleanup?.()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
    />
  )
}
```

**Step 3: Create graph page**

```tsx
// src/app/graph/page.tsx
import { TrustGraph } from '@/components/graph/TrustGraph'

export default function GraphPage() {
  return <TrustGraph />
}
```

**Step 4: Install d3-force**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope
pnpm add d3-force
pnpm add -D @types/d3-force
```

**Step 5: Verify build**

```bash
pnpm build
```

**Step 6: Commit**

```bash
git add src/lib/graph/ src/components/graph/ src/app/graph/ package.json pnpm-lock.yaml
git commit -m "feat: add Trust Graph with d3-force canvas rendering"
```

---

## Phase 5: Discovery Signals

### Task 17: Discovery rule engine

**Files:**
- Create: `src/lib/discovery/engine.ts`
- Create: `src/lib/discovery/rules.ts`
- Test: `src/lib/discovery/__tests__/rules.test.ts`

**Step 1: Write the test**

```typescript
// src/lib/discovery/__tests__/rules.test.ts
import { describe, it, expect } from 'vitest'
import { detectFirstBlood, detectX402Ready } from '../rules'
import type { ScopeEvent } from '@/types/events'

describe('detectFirstBlood', () => {
  it('fires when agent gets first feedback', () => {
    const feedbackCounts = new Map<string, number>()
    const event: ScopeEvent = {
      chainId: 44787, block: 100, txHash: '0x1', logIndex: 0,
      kind: 'feedback', agentId: 42,
      data: {
        clientAddress: '0xabc', feedbackIndex: 0n, value: 80n,
        valueDecimals: 0, tag1: 'starred', tag2: '', endpoint: '',
        feedbackURI: '', feedbackHash: '0x0',
      },
    }
    const signal = detectFirstBlood(event, feedbackCounts)
    expect(signal).not.toBeNull()
    expect(signal!.kind).toBe('first_blood')
  })

  it('does NOT fire on second feedback', () => {
    const feedbackCounts = new Map<string, number>([['44787:42', 1]])
    const event: ScopeEvent = {
      chainId: 44787, block: 101, txHash: '0x2', logIndex: 0,
      kind: 'feedback', agentId: 42,
      data: {
        clientAddress: '0xdef', feedbackIndex: 1n, value: 90n,
        valueDecimals: 0, tag1: '', tag2: '', endpoint: '',
        feedbackURI: '', feedbackHash: '0x0',
      },
    }
    const signal = detectFirstBlood(event, feedbackCounts)
    expect(signal).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/discovery/__tests__/rules.test.ts
```

**Step 3: Implement rules**

```typescript
// src/lib/discovery/rules.ts
import type { ScopeEvent } from '@/types/events'
import type { DiscoverySignal } from '@/types/discovery'

export function detectFirstBlood(
  event: ScopeEvent,
  feedbackCounts: Map<string, number>,
): DiscoverySignal | null {
  if (event.kind !== 'feedback') return null
  const key = `${event.chainId}:${event.agentId}`
  const count = feedbackCounts.get(key) ?? 0
  if (count > 0) return null
  return {
    kind: 'first_blood',
    title: 'First Blood',
    description: `Agent #${event.agentId} received its first-ever feedback`,
    agentIds: [event.agentId],
    chainId: event.chainId,
    timestamp: event.timestamp ?? Date.now(),
    severity: 'info',
  }
}

export function detectX402Ready(event: ScopeEvent): DiscoverySignal | null {
  if (event.kind !== 'register') return null
  // We can only detect x402 after metadata fetch — this is a placeholder
  // that checks the agentURI for x402 hints
  return null
}

export function detectRisingStar(
  event: ScopeEvent,
  recentFeedbacks: Map<string, { count: number; since: number }>,
): DiscoverySignal | null {
  if (event.kind !== 'feedback') return null
  const key = `${event.chainId}:${event.agentId}`
  const entry = recentFeedbacks.get(key)
  if (!entry) return null
  const hoursSinceFirst = (Date.now() - entry.since) / (1000 * 60 * 60)
  if (entry.count >= 5 && hoursSinceFirst < 24) {
    return {
      kind: 'rising_star',
      title: 'Rising Star',
      description: `Agent #${event.agentId} got ${entry.count} feedbacks in ${Math.round(hoursSinceFirst)}h`,
      agentIds: [event.agentId],
      chainId: event.chainId,
      timestamp: event.timestamp ?? Date.now(),
      severity: 'info',
    }
  }
  return null
}
```

```typescript
// src/lib/discovery/engine.ts
import type { ScopeEvent } from '@/types/events'
import type { DiscoverySignal } from '@/types/discovery'
import { detectFirstBlood, detectRisingStar } from './rules'
import { useDiscoveryStore } from '@/stores/discovery'

const feedbackCounts = new Map<string, number>()
const recentFeedbacks = new Map<string, { count: number; since: number }>()

export function runDiscoveryRules(event: ScopeEvent): void {
  const signals: (DiscoverySignal | null)[] = [
    detectFirstBlood(event, feedbackCounts),
    detectRisingStar(event, recentFeedbacks),
  ]

  // Update tracking state
  if (event.kind === 'feedback') {
    const key = `${event.chainId}:${event.agentId}`
    feedbackCounts.set(key, (feedbackCounts.get(key) ?? 0) + 1)
    const entry = recentFeedbacks.get(key)
    if (!entry) {
      recentFeedbacks.set(key, { count: 1, since: Date.now() })
    } else {
      entry.count++
    }
  }

  // Push signals to store
  for (const signal of signals) {
    if (signal) useDiscoveryStore.getState().push(signal)
  }
}
```

**Step 4: Run test**

```bash
pnpm test src/lib/discovery/__tests__/rules.test.ts
```

Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add src/lib/discovery/
git commit -m "feat: add discovery rule engine (first_blood, rising_star)"
```

---

### Task 18: Discovery page UI + wire engine to pipeline

**Files:**
- Create: `src/components/discovery/DiscoveryFeed.tsx`
- Create: `src/components/discovery/SignalCard.tsx`
- Create: `src/app/discovery/page.tsx`
- Modify: `src/lib/pipeline/ingest.ts` (add `runDiscoveryRules` call)

**Step 1: Create SignalCard**

```tsx
// src/components/discovery/SignalCard.tsx
import type { DiscoverySignal } from '@/types/discovery'
import { ChainBadge } from '@/components/shared/ChainBadge'

const severityColors = {
  info: 'border-blue-500/30 bg-blue-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
}

export function SignalCard({ signal }: { signal: DiscoverySignal }) {
  return (
    <div className={`rounded-lg border p-4 ${severityColors[signal.severity]}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">{signal.title}</h3>
        <ChainBadge chainId={signal.chainId} />
      </div>
      <p className="mt-1 text-sm text-zinc-400">{signal.description}</p>
      <span className="mt-2 block text-xs text-zinc-600">
        {new Date(signal.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}
```

**Step 2: Create DiscoveryFeed**

```tsx
// src/components/discovery/DiscoveryFeed.tsx
'use client'

import { useDiscoveryStore } from '@/stores/discovery'
import { SignalCard } from './SignalCard'

export function DiscoveryFeed() {
  const signals = useDiscoveryStore((s) => s.signals)

  if (signals.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-600">
        <div className="text-center">
          <p className="text-lg">No discovery signals yet</p>
          <p className="mt-1 text-sm">Patterns will appear as events flow in</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-3">
        {signals.map((signal, i) => (
          <SignalCard key={`${signal.kind}-${signal.timestamp}-${i}`} signal={signal} />
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Create discovery page**

```tsx
// src/app/discovery/page.tsx
import { DiscoveryFeed } from '@/components/discovery/DiscoveryFeed'

export default function DiscoveryPage() {
  return <DiscoveryFeed />
}
```

**Step 4: Wire discovery engine into pipeline**

In `src/lib/pipeline/ingest.ts`, add to the `processEvent` function:

```typescript
import { runDiscoveryRules } from '@/lib/discovery/engine'

// Inside processEvent(), after graph updates:
runDiscoveryRules(event)
```

**Step 5: Verify build**

```bash
pnpm build
```

**Step 6: Commit**

```bash
git add src/components/discovery/ src/app/discovery/ src/lib/pipeline/ingest.ts
git commit -m "feat: add Discovery view with signal cards, wire to pipeline"
```

---

## Phase 6: Multi-chain + Polish

### Task 19: Agent deep link page with SSR

**Files:**
- Create: `src/app/agent/[chain]/[id]/page.tsx`

**Step 1: Create agent page**

```tsx
// src/app/agent/[chain]/[id]/page.tsx
import type { Metadata } from 'next'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadata } from '@/lib/agent/metadata'

type Props = { params: Promise<{ chain: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) return { title: 'Agent Not Found — DenScope' }

  const uri = await readAgentURI(chainConfig, agentId)
  const metadata = uri ? await fetchAgentMetadata(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`

  return {
    title: `${name} — DenScope`,
    description: `ERC-8004 agent on ${chainConfig.name}`,
    openGraph: {
      title: `${name} — DenScope`,
      description: `ERC-8004 agent on ${chainConfig.name}`,
      images: [`/api/og/agent/${chain}/${id}`],
    },
  }
}

export default async function AgentPage({ params }: Props) {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) {
    return <div className="flex h-full items-center justify-center text-zinc-500">Chain not found</div>
  }

  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadata(uri) : null

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold text-white">
        {metadata?.name ?? `Agent #${agentId}`}
      </h1>
      <p className="mt-1 text-zinc-500">
        on {chainConfig.name}
      </p>
      {metadata?.description && (
        <p className="mt-4 text-zinc-400">{metadata.description}</p>
      )}
      <div className="mt-6 space-y-2 text-sm text-zinc-400">
        <p>Owner: <span className="font-mono text-zinc-300">{owner ?? 'unknown'}</span></p>
        <p>URI: <span className="font-mono text-zinc-300">{uri ?? 'unknown'}</span></p>
      </div>
      {metadata?.services && metadata.services.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-500">Services</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {metadata.services.map((s, i) => (
              <span key={i} className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {s.type}{s.version ? ` v${s.version}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      <a
        href={`${chainConfig.explorer}/address/${chainConfig.contracts.identity}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block text-sm text-emerald-400 hover:underline"
      >
        View on {chainConfig.name} Explorer ↗
      </a>
    </div>
  )
}
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add src/app/agent/
git commit -m "feat: add agent deep link page with SSR + OG metadata"
```

---

### Task 20: OG Share Card endpoint

**Files:**
- Create: `src/app/api/og/agent/[chain]/[id]/route.tsx`

**Step 1: Install @vercel/og**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope
pnpm add @vercel/og
```

**Step 2: Create OG route**

```tsx
// src/app/api/og/agent/[chain]/[id]/route.tsx
import { ImageResponse } from '@vercel/og'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadata } from '@/lib/agent/metadata'

export const runtime = 'edge'

type Props = { params: Promise<{ chain: string; id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) {
    return new ImageResponse(
      <div style={{ display: 'flex', background: '#09090b', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
        Agent not found
      </div>,
      { width: 1200, height: 630 }
    )
  }

  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadata(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`
  const ownerTruncated = owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : 'unknown'

  return new ImageResponse(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
      padding: '60px',
      fontFamily: 'monospace',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#34d399', fontSize: '24px', fontWeight: 'bold' }}>DenScope</span>
          <span style={{ color: '#52525b', fontSize: '16px', marginTop: '4px' }}>ERC-8004 Agent Explorer</span>
        </div>
        <span style={{
          background: `${chainConfig.badge.color}20`,
          color: chainConfig.badge.color,
          padding: '6px 16px',
          borderRadius: '999px',
          fontSize: '16px',
        }}>
          {chainConfig.badge.label}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '80px', flex: 1 }}>
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 'bold' }}>{name}</span>
        {metadata?.description && (
          <span style={{ color: '#a1a1aa', fontSize: '20px', marginTop: '12px', maxWidth: '800px' }}>
            {metadata.description.slice(0, 120)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '32px', color: '#71717a', fontSize: '18px' }}>
        <span>Owner: {ownerTruncated}</span>
        {metadata?.services && <span>Services: {metadata.services.map(s => s.type).join(', ')}</span>}
        {metadata?.x402 && <span style={{ color: '#34d399' }}>x402 enabled</span>}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=300' },
    }
  )
}
```

**Step 3: Verify build**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/app/api/og/ package.json pnpm-lock.yaml
git commit -m "feat: add OG share card endpoint for agent pages"
```

---

### Task 21: Share button in X-Ray panel

**Files:**
- Create: `src/components/xray/ShareButton.tsx`
- Modify: `src/components/xray/XRayPanel.tsx`

**Step 1: Create ShareButton**

```tsx
// src/components/xray/ShareButton.tsx
'use client'

import { useState } from 'react'
import type { AgentSummary } from '@/types/agents'

export function ShareButton({ agent }: { agent: AgentSummary }) {
  const [copied, setCopied] = useState(false)
  const agentUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/agent/${agent.chainId}/${agent.agentId}`
  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`

  const tweetText = `${name} on ERC-8004\n\n${agentUrl}\n\nExplored with DenScope`

  function copyTweet() {
    navigator.clipboard.writeText(tweetText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={copyTweet}
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
      >
        {copied ? 'Copied!' : 'Copy Tweet'}
      </button>
      <a
        href={agentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
      >
        Share Link
      </a>
    </div>
  )
}
```

**Step 2: Add ShareButton to XRayPanel**

In `XRayPanel.tsx`, after `<AgentServices>`:

```tsx
import { ShareButton } from './ShareButton'

// Inside the panel content, after AgentServices:
<ShareButton agent={enrichedAgent} />
```

**Step 3: Verify build**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add src/components/xray/ShareButton.tsx src/components/xray/XRayPanel.tsx
git commit -m "feat: add share button (copy tweet + share link) to X-Ray panel"
```

---

### Task 22: Final polish — CLAUDE.md + run all tests

**Files:**
- Create: `denscope/CLAUDE.md`
- Run: all tests + build

**Step 1: Create project CLAUDE.md**

```markdown
# DenScope — CLAUDE.md

## Overview

Real-time ERC-8004 agent explorer. Browser-first, zero-DB architecture.

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- viem (chain client), zustand (state), d3-force (graph), framer-motion (animations)
- @vercel/og (share cards), idb (IndexedDB persistence)
- moduleResolution: bundler — no `.js` extensions needed

## Commands

```bash
pnpm dev          # Dev server
pnpm build        # Production build
pnpm test         # Run vitest tests
pnpm test:watch   # Watch mode
pnpm lint         # ESLint
```

## Architecture

- `src/config/` — Chain registry, ABIs, constants
- `src/lib/pipeline/` — Event ingestion (cursor, parse, dedup, ingest)
- `src/lib/discovery/` — Pattern detection rules
- `src/lib/agent/` — Contract reads + metadata fetch
- `src/stores/` — Zustand stores (events, agents, graph, discovery)
- `src/components/` — React components (feed, graph, xray, discovery, shared)
- `src/app/` — Next.js pages + API routes

## Adding a Chain

Edit `src/config/chains.ts`, add a `ChainConfig` entry. Zero code changes.

## Key Constraints

- HTTP polling (no WebSocket) — configurable `pollingInterval` per chain
- getLogs paginated in `backfillChunkSize` chunks
- Timestamps: `Date.now()` for realtime, `getBlock()` batch for backfill
- IndexedDB client-only, SSR routes use `readContract()` directly
```

**Step 2: Run all tests**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope
pnpm test
```

Expected: All tests pass.

**Step 3: Run build**

```bash
pnpm build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add project CLAUDE.md for DenScope"
```

---

## Summary

| Phase | Tasks | What you get |
|-------|-------|-------------|
| 0 — Scaffold | 1-3 | Next.js + viem + types + config |
| 1 — Pipeline | 4-9 | Event parsing, dedup, cursor, stores, ingestion |
| 2 — Live Feed | 10-12 | MVP: working feed connected to Alfajores |
| 3 — X-Ray | 13-15 | Agent detail panel + metadata + share |
| 4 — Trust Graph | 16 | d3-force interactive graph |
| 5 — Discovery | 17-18 | Rule engine + signal cards |
| 6 — Polish | 19-22 | Deep links, OG cards, share, CLAUDE.md |

**Total: 22 tasks. MVP at task 12. Full product at task 22.**
