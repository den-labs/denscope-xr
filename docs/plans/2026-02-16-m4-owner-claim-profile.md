# M4: Owner Claim & Profile — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable agent owners to connect their wallet, claim their on-chain agents via SIWE signature verification, and see a "Claimed" badge on public agent cards — bridging DenScope from "public explorer" to "my product."

**Architecture:** Wallet connection via wagmi (React hooks for Ethereum, already uses viem). Claim flow: connect wallet → sign SIWE message → server verifies signature + `ownerOf()` on-chain → insert `owner_profiles` row. Console shell is client-side gated (wallet connected = access). No Supabase Auth in M4 (added in M5 when we need persistent sessions for alerts).

**Tech Stack:** wagmi + @wagmi/connectors + @tanstack/react-query (wallet), siwe (SIWE messages), viem (on-chain reads, already installed), Supabase (owner_profiles table), Next.js API routes (claim verification), zustand (auth state)

**Ref:** Vision doc at `docs/plans/2026-02-15-denscope-vision.md`

---

## Task 1: Database Migration — `owner_profiles` Table

**Files:**
- Create: `supabase/migrations/20260216010000_owner_profiles.sql`

**Step 1: Write the migration**

```sql
-- M4: Owner claim profiles
CREATE TABLE owner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  display_name TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id)
);

CREATE INDEX idx_owner_profiles_wallet ON owner_profiles (wallet_address);
CREATE INDEX idx_owner_profiles_agent ON owner_profiles (chain_id, agent_id);

-- RLS: public read, service_role write
ALTER TABLE owner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read owner_profiles" ON owner_profiles FOR SELECT USING (true);
CREATE POLICY "Service write owner_profiles" ON owner_profiles FOR INSERT WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);
CREATE POLICY "Service update owner_profiles" ON owner_profiles FOR UPDATE USING (
  (SELECT auth.role()) = 'service_role'
);
```

**Step 2: Apply migration to Supabase**

Run: `cd denscope && supabase db push`
Expected: Migration applied successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260216010000_owner_profiles.sql
git commit -m "feat(db): add owner_profiles table for M4 claim flow"
```

---

## Task 2: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install wagmi + siwe + react-query**

Run:
```bash
cd denscope
pnpm add wagmi @wagmi/core @wagmi/connectors @tanstack/react-query siwe
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds (no breaking changes from new deps).

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add wagmi, siwe, react-query for M4 wallet auth"
```

---

## Task 3: Wagmi Config + WalletProvider

**Files:**
- Create: `src/config/wagmi.ts`
- Create: `src/components/providers/WalletProvider.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/config/__tests__/wagmi.test.ts`

**Step 1: Write the failing test for wagmi config**

```typescript
// src/config/__tests__/wagmi.test.ts
import { describe, it, expect } from 'vitest'
import { wagmiConfig } from '@/config/wagmi'

describe('wagmiConfig', () => {
  it('has Celo and Celo Sepolia chains', () => {
    const chainIds = wagmiConfig.chains.map((c) => c.id)
    expect(chainIds).toContain(42220)
    expect(chainIds).toContain(11142220)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/config/__tests__/wagmi.test.ts`
Expected: FAIL — `wagmi` module not found or config not defined.

**Step 3: Write wagmi config**

```typescript
// src/config/wagmi.ts
import { http, createConfig } from 'wagmi'
import { celo, celoSepolia } from 'wagmi/chains'
import { injected, walletConnect } from '@wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
    [celoSepolia.id]: http('https://forno.celo-sepolia.celo-testnet.org'),
  },
  ssr: true,
})
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/config/__tests__/wagmi.test.ts`
Expected: PASS

**Step 5: Write WalletProvider**

```typescript
// src/components/providers/WalletProvider.tsx
'use client'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/config/wagmi'
import { useState } from 'react'

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

**Step 6: Wrap layout with WalletProvider**

Modify `src/app/layout.tsx` — wrap `<PipelineProvider>` with `<WalletProvider>`:

```tsx
// In RootLayout body:
<WalletProvider>
  <PipelineProvider>
    <Header />
    <main className="flex-1 overflow-hidden">{children}</main>
    <StatusBar />
  </PipelineProvider>
</WalletProvider>
```

Add import: `import { WalletProvider } from '@/components/providers/WalletProvider'`

**Step 7: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 8: Commit**

```bash
git add src/config/wagmi.ts src/components/providers/WalletProvider.tsx src/app/layout.tsx src/config/__tests__/wagmi.test.ts
git commit -m "feat: add wagmi config and WalletProvider for wallet connection"
```

---

## Task 4: Auth Store + ConnectButton

**Files:**
- Create: `src/stores/auth.ts`
- Create: `src/components/auth/ConnectButton.tsx`
- Test: `src/stores/__tests__/auth.test.ts`

**Step 1: Write failing test for auth store**

```typescript
// src/stores/__tests__/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().disconnect()
  })

  it('starts disconnected', () => {
    const state = useAuthStore.getState()
    expect(state.address).toBeNull()
    expect(state.isConnected).toBe(false)
  })

  it('sets address on connect', () => {
    useAuthStore.getState().setAddress('0xabc123')
    const state = useAuthStore.getState()
    expect(state.address).toBe('0xabc123')
    expect(state.isConnected).toBe(true)
  })

  it('clears state on disconnect', () => {
    useAuthStore.getState().setAddress('0xabc123')
    useAuthStore.getState().disconnect()
    const state = useAuthStore.getState()
    expect(state.address).toBeNull()
    expect(state.isConnected).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/stores/__tests__/auth.test.ts`
Expected: FAIL — module not found.

**Step 3: Write auth store**

```typescript
// src/stores/auth.ts
import { create } from 'zustand'

type AuthState = {
  address: string | null
  isConnected: boolean
  setAddress: (address: string) => void
  disconnect: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  address: null,
  isConnected: false,
  setAddress: (address) => set({ address, isConnected: true }),
  disconnect: () => set({ address: null, isConnected: false }),
}))
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/stores/__tests__/auth.test.ts`
Expected: PASS

**Step 5: Write ConnectButton component**

```typescript
// src/components/auth/ConnectButton.tsx
'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from '@wagmi/connectors'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'

export function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const setAddress = useAuthStore((s) => s.setAddress)
  const authDisconnect = useAuthStore((s) => s.disconnect)

  useEffect(() => {
    if (isConnected && address) {
      setAddress(address)
    } else {
      authDisconnect()
    }
  }, [isConnected, address, setAddress, authDisconnect])

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-secondary">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="border border-border bg-surface px-3 py-1 text-xs font-mono text-text-muted hover:text-text-secondary hover:border-border-bright transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-mono text-accent hover:bg-accent/10 hover:border-accent/50 transition-colors"
    >
      Connect Wallet
    </button>
  )
}
```

**Step 6: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add src/stores/auth.ts src/stores/__tests__/auth.test.ts src/components/auth/ConnectButton.tsx
git commit -m "feat: add auth store and ConnectButton component"
```

---

## Task 5: SIWE Helpers (Create + Verify)

**Files:**
- Create: `src/lib/auth/siwe.ts`
- Create: `src/lib/auth/verify.ts`
- Test: `src/lib/auth/__tests__/siwe.test.ts`

**Step 1: Write failing test for SIWE message creation**

```typescript
// src/lib/auth/__tests__/siwe.test.ts
import { describe, it, expect } from 'vitest'
import { createSiweMessage } from '@/lib/auth/siwe'

describe('createSiweMessage', () => {
  it('creates a valid SIWE message string', () => {
    const message = createSiweMessage({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 42220,
      nonce: 'abc123',
      statement: 'Claim agent ownership on DenScope',
    })
    expect(message).toContain('0x1234567890abcdef1234567890abcdef12345678')
    expect(message).toContain('abc123')
    expect(message).toContain('Claim agent ownership on DenScope')
  })

  it('includes the domain and URI', () => {
    const message = createSiweMessage({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 42220,
      nonce: 'test-nonce',
    })
    expect(message).toContain('denscope.vercel.app')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/auth/__tests__/siwe.test.ts`
Expected: FAIL — module not found.

**Step 3: Write SIWE message creation helper**

```typescript
// src/lib/auth/siwe.ts
import { SiweMessage } from 'siwe'

const DOMAIN = 'denscope.vercel.app'
const URI = 'https://denscope.vercel.app'

type CreateMessageParams = {
  address: string
  chainId: number
  nonce: string
  statement?: string
}

export function createSiweMessage({
  address,
  chainId,
  nonce,
  statement = 'Sign in to DenScope',
}: CreateMessageParams): string {
  const message = new SiweMessage({
    domain: DOMAIN,
    address,
    statement,
    uri: URI,
    version: '1',
    chainId,
    nonce,
  })
  return message.prepareMessage()
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/auth/__tests__/siwe.test.ts`
Expected: PASS

**Step 5: Write server-side SIWE verification**

```typescript
// src/lib/auth/verify.ts
import { SiweMessage } from 'siwe'

type VerifyResult =
  | { valid: true; address: string }
  | { valid: false; error: string }

export async function verifySiweMessage(
  message: string,
  signature: string
): Promise<VerifyResult> {
  try {
    const siweMessage = new SiweMessage(message)
    const result = await siweMessage.verify({ signature })
    if (!result.success) {
      return { valid: false, error: 'Signature verification failed' }
    }
    return { valid: true, address: siweMessage.address }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
```

**Step 6: Commit**

```bash
git add src/lib/auth/siwe.ts src/lib/auth/verify.ts src/lib/auth/__tests__/siwe.test.ts
git commit -m "feat: add SIWE message creation and verification helpers"
```

---

## Task 6: Owner Profiles Data Layer

**Files:**
- Create: `src/lib/supabase/owner-profiles.ts`
- Test: `src/lib/supabase/__tests__/owner-profiles.test.ts`

**Step 1: Write failing test for owner-profiles helpers**

```typescript
// src/lib/supabase/__tests__/owner-profiles.test.ts
import { describe, it, expect } from 'vitest'
import { buildClaimRow, type OwnerProfile } from '@/lib/supabase/owner-profiles'

describe('owner-profiles helpers', () => {
  it('builds a claim row from params', () => {
    const row = buildClaimRow({
      walletAddress: '0xabc',
      chainId: 42220,
      agentId: 5,
    })
    expect(row).toEqual({
      wallet_address: '0xabc',
      chain_id: 42220,
      agent_id: 5,
    })
  })
})

describe('OwnerProfile type', () => {
  it('has required fields', () => {
    const profile: OwnerProfile = {
      id: 'uuid',
      wallet_address: '0x123',
      chain_id: 42220,
      agent_id: 1,
      display_name: null,
      claimed_at: '2026-02-16T00:00:00Z',
    }
    expect(profile.wallet_address).toBe('0x123')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/supabase/__tests__/owner-profiles.test.ts`
Expected: FAIL — module not found.

**Step 3: Write owner-profiles module**

```typescript
// src/lib/supabase/owner-profiles.ts
import { supabase } from './client'

export type OwnerProfile = {
  id: string
  wallet_address: string
  chain_id: number
  agent_id: number
  display_name: string | null
  claimed_at: string
}

type ClaimParams = {
  walletAddress: string
  chainId: number
  agentId: number
}

export function buildClaimRow(params: ClaimParams) {
  return {
    wallet_address: params.walletAddress,
    chain_id: params.chainId,
    agent_id: params.agentId,
  }
}

export async function fetchClaimStatus(
  chainId: number,
  agentId: number
): Promise<OwnerProfile | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('owner_profiles')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .maybeSingle()
  return data as OwnerProfile | null
}

export async function fetchOwnerAgents(
  walletAddress: string
): Promise<OwnerProfile[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('owner_profiles')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('claimed_at', { ascending: false })
  return (data ?? []) as OwnerProfile[]
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/supabase/__tests__/owner-profiles.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/supabase/owner-profiles.ts src/lib/supabase/__tests__/owner-profiles.test.ts
git commit -m "feat: add owner-profiles data layer for claim status queries"
```

---

## Task 7: Claim API Route

**Files:**
- Create: `src/app/api/auth/nonce/route.ts`
- Create: `src/app/api/claim/route.ts`

**Step 1: Write nonce endpoint**

```typescript
// src/app/api/auth/nonce/route.ts
import { NextResponse } from 'next/server'
import { generateNonce } from '@/lib/auth/siwe'

// In-memory nonce store (valid for 5 minutes)
const nonces = new Map<string, number>()

export function GET() {
  // Clean expired nonces
  const now = Date.now()
  for (const [nonce, expiry] of nonces) {
    if (expiry < now) nonces.delete(nonce)
  }

  const nonce = generateNonce()
  nonces.set(nonce, now + 5 * 60 * 1000)

  return NextResponse.json({ nonce })
}

export { nonces }
```

**Step 2: Write claim endpoint**

```typescript
// src/app/api/claim/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifySiweMessage } from '@/lib/auth/verify'
import { readAgentOwner } from '@/lib/agent/read'
import { getChain } from '@/config/chains'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { nonces } from '@/app/api/auth/nonce/route'
import { SiweMessage } from 'siwe'

export async function POST(req: NextRequest) {
  try {
    const { message, signature, chainId, agentId } = await req.json()

    if (!message || !signature || !chainId || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, signature, chainId, agentId' },
        { status: 400 }
      )
    }

    // Verify nonce is valid
    const siweMsg = new SiweMessage(message)
    if (!nonces.has(siweMsg.nonce)) {
      return NextResponse.json(
        { error: 'Invalid or expired nonce' },
        { status: 401 }
      )
    }
    nonces.delete(siweMsg.nonce)

    // Verify SIWE signature
    const result = await verifySiweMessage(message, signature)
    if (!result.valid) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }

    // Verify on-chain ownership
    const chain = getChain(chainId)
    if (!chain) {
      return NextResponse.json(
        { error: 'Unsupported chain' },
        { status: 400 }
      )
    }

    const onChainOwner = await readAgentOwner(chain, agentId)
    if (!onChainOwner) {
      return NextResponse.json(
        { error: 'Agent not found on-chain' },
        { status: 404 }
      )
    }

    if (result.address.toLowerCase() !== onChainOwner.toLowerCase()) {
      return NextResponse.json(
        { error: 'Wallet address does not match on-chain owner' },
        { status: 403 }
      )
    }

    // Insert into owner_profiles (upsert on unique constraint)
    const { data, error } = await supabaseAdmin
      .from('owner_profiles')
      .upsert(
        {
          wallet_address: result.address.toLowerCase(),
          chain_id: chainId,
          agent_id: agentId,
        },
        { onConflict: 'chain_id,agent_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Claim insert error:', error)
      return NextResponse.json(
        { error: 'Failed to save claim' },
        { status: 500 }
      )
    }

    return NextResponse.json({ claimed: true, profile: data })
  } catch (err) {
    console.error('Claim error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 3: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/auth/nonce/route.ts src/app/api/claim/route.ts
git commit -m "feat: add claim API route with SIWE + on-chain ownership verification"
```

---

## Task 8: ClaimedBadge Component

**Files:**
- Create: `src/components/shared/ClaimedBadge.tsx`

**Step 1: Write ClaimedBadge component**

```typescript
// src/components/shared/ClaimedBadge.tsx
export function ClaimedBadge() {
  return (
    <span className="status-pill status-pill-success">
      CLAIMED
    </span>
  )
}
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/shared/ClaimedBadge.tsx
git commit -m "feat: add ClaimedBadge component"
```

---

## Task 9: ClaimButton Component

**Files:**
- Create: `src/components/auth/ClaimButton.tsx`

**Step 1: Write ClaimButton component**

```typescript
// src/components/auth/ClaimButton.tsx
'use client'

import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { createSiweMessage } from '@/lib/auth/siwe'
import { ConnectButton } from './ConnectButton'

type ClaimButtonProps = {
  chainId: number
  agentId: number
  ownerAddress: string
  onClaimed?: () => void
}

type ClaimState = 'idle' | 'signing' | 'verifying' | 'success' | 'error'

export function ClaimButton({ chainId, agentId, ownerAddress, onClaimed }: ClaimButtonProps) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [state, setState] = useState<ClaimState>('idle')
  const [error, setError] = useState<string | null>(null)

  // Not connected: show connect button
  if (!isConnected || !address) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-xs text-text-muted font-mono">
          Are you the owner of this agent?
        </p>
        <ConnectButton />
      </div>
    )
  }

  // Connected but not the owner
  if (address.toLowerCase() !== ownerAddress.toLowerCase()) {
    return (
      <p className="text-xs text-text-muted font-mono">
        Connected wallet does not match the on-chain owner of this agent.
      </p>
    )
  }

  // Already claimed
  if (state === 'success') {
    return (
      <p className="text-xs text-success font-mono">
        Agent claimed successfully.
      </p>
    )
  }

  async function handleClaim() {
    setState('signing')
    setError(null)

    try {
      // 1. Fetch nonce
      const nonceRes = await fetch('/api/auth/nonce')
      const { nonce } = await nonceRes.json()

      // 2. Create and sign SIWE message
      const message = createSiweMessage({
        address: address!,
        chainId,
        nonce,
        statement: `Claim ownership of Agent #${agentId} on DenScope`,
      })

      const signature = await signMessageAsync({ message })
      setState('verifying')

      // 3. Send to claim endpoint
      const claimRes = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature, chainId, agentId }),
      })

      if (!claimRes.ok) {
        const data = await claimRes.json()
        throw new Error(data.error ?? 'Claim failed')
      }

      setState('success')
      onClaimed?.()
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClaim}
        disabled={state === 'signing' || state === 'verifying'}
        className="border border-accent/30 bg-accent/5 px-4 py-1.5 text-xs font-mono text-accent hover:bg-accent/10 hover:border-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'signing' && 'Sign message...'}
        {state === 'verifying' && 'Verifying...'}
        {(state === 'idle' || state === 'error') && 'Claim this Agent'}
      </button>
      {error && (
        <p className="text-xs text-critical font-mono">{error}</p>
      )}
    </div>
  )
}
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/auth/ClaimButton.tsx
git commit -m "feat: add ClaimButton with SIWE signing flow"
```

---

## Task 10: Update Agent Page — Integrate Claim + Badge

**Files:**
- Modify: `src/app/agent/[chain]/[id]/page.tsx`
- Create: `src/components/agent/AgentClaimSection.tsx`

**Step 1: Create client-side AgentClaimSection**

The agent page is a Server Component (SSR). The claim flow needs client-side interactivity (wallet, signing). Create a client component wrapper.

```typescript
// src/components/agent/AgentClaimSection.tsx
'use client'

import { useEffect, useState } from 'react'
import { ClaimButton } from '@/components/auth/ClaimButton'
import { ClaimedBadge } from '@/components/shared/ClaimedBadge'
import { fetchClaimStatus } from '@/lib/supabase/owner-profiles'

type Props = {
  chainId: number
  agentId: number
  ownerAddress: string | null
}

export function AgentClaimSection({ chainId, agentId, ownerAddress }: Props) {
  const [isClaimed, setIsClaimed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClaimStatus(chainId, agentId).then((profile) => {
      setIsClaimed(!!profile)
      setLoading(false)
    })
  }, [chainId, agentId])

  if (loading) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <p className="text-xs text-text-muted font-mono">Checking claim status...</p>
      </div>
    )
  }

  if (isClaimed) {
    return (
      <div className="mt-6 border-t border-border pt-6 flex items-center gap-2">
        <ClaimedBadge />
        <p className="text-xs text-text-secondary font-mono">
          This agent has been claimed by its owner.
        </p>
      </div>
    )
  }

  if (!ownerAddress) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <p className="text-xs text-text-muted font-mono">
          Owner not found on-chain.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <ClaimButton
        chainId={chainId}
        agentId={agentId}
        ownerAddress={ownerAddress}
        onClaimed={() => setIsClaimed(true)}
      />
    </div>
  )
}
```

**Step 2: Update agent page — replace static claim section with dynamic one**

In `src/app/agent/[chain]/[id]/page.tsx`:

1. Add import: `import { AgentClaimSection } from '@/components/agent/AgentClaimSection'`

2. Replace the static claim section (lines 307-313):

**Before:**
```tsx
{/* Claim */}
<div className="mt-6 border-t border-border pt-6">
  <p className="text-xs text-text-muted font-mono">
    Are you the owner of this agent?{' '}
    <span className="text-text-secondary">Claim &amp; verify coming soon.</span>
  </p>
</div>
```

**After:**
```tsx
{/* Claim */}
<AgentClaimSection chainId={chainConfig.id} agentId={agentId} ownerAddress={owner} />
```

3. Add ClaimedBadge next to the ACTIVE status pill in the identity card. Import and add a server-side claim status check:

In the `AgentPage` function, after the existing `Promise.all` call (line 110-113), add a fetch for claim status:

```typescript
// After existing fetches, add:
const claimStatusRes = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/owner_profiles?chain_id=eq.${chainConfig.id}&agent_id=eq.${agentId}&select=id`,
  {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
    },
    next: { revalidate: 60 },
  }
).then(r => r.json()).catch(() => [])
const isClaimed = Array.isArray(claimStatusRes) && claimStatusRes.length > 0
```

Then next to the ACTIVE status pill (around line 171), add:

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <span className="status-pill status-pill-success">ACTIVE</span>
    {isClaimed && <span className="status-pill status-pill-success">CLAIMED</span>}
  </div>
  <span className="font-mono text-xs text-text-muted">ERC-8004</span>
</div>
```

**Step 3: Run tests + build**

Run: `pnpm test && pnpm build`
Expected: All tests pass, build succeeds.

**Step 4: Commit**

```bash
git add src/components/agent/AgentClaimSection.tsx src/app/agent/[chain]/[id]/page.tsx
git commit -m "feat: integrate claim flow and claimed badge on agent page"
```

---

## Task 11: Update Header — ConnectButton + Console Link

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Add ConnectButton to Header**

In `src/components/layout/Header.tsx`:

1. Add import: `import { ConnectButton } from '@/components/auth/ConnectButton'`

2. In the right section (between Search button and Mainnet indicator), add `<ConnectButton />`:

```tsx
{/* Right: Search + Wallet + Status */}
<div className="flex items-center gap-4">
  <button
    onClick={() => setSearchOpen(true)}
    className="flex items-center gap-2 border border-border bg-surface px-3 py-1 text-xs font-mono text-text-muted transition-colors hover:text-text-secondary"
  >
    Search
    <kbd className="border border-border px-1 py-0.5 text-[10px]">
      {'\u2318'}K
    </kbd>
  </button>
  <ConnectButton />
  <div className="flex items-center gap-2">
    <span className="h-1.5 w-1.5 rounded-full bg-success" />
    <span className="text-[10px] uppercase tracking-widest text-text-muted">
      Mainnet
    </span>
  </div>
</div>
```

3. Add "Console" to navItems (conditionally visible when connected — handled via CSS/component):

Add to `navItems` array:
```typescript
{ href: '/console', label: 'Console', disabled: false },
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add ConnectButton and Console nav to Header"
```

---

## Task 12: Console Shell (Empty Dashboard)

**Files:**
- Create: `src/app/console/page.tsx`
- Create: `src/components/console/ConsoleGuard.tsx`
- Create: `src/components/console/ClaimedAgentsList.tsx`

**Step 1: Create ConsoleGuard (client-side auth gate)**

```typescript
// src/components/console/ConsoleGuard.tsx
'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/auth/ConnectButton'

export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-text-primary">
            Owner Console
          </h2>
          <p className="mt-2 text-sm text-text-secondary max-w-md">
            Connect your wallet to access your agent dashboard. You must be the on-chain owner of an ERC-8004 agent.
          </p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  return <>{children}</>
}
```

**Step 2: Create ClaimedAgentsList**

```typescript
// src/components/console/ClaimedAgentsList.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { fetchOwnerAgents, type OwnerProfile } from '@/lib/supabase/owner-profiles'
import { getChain } from '@/config/chains'

export function ClaimedAgentsList() {
  const { address } = useAccount()
  const [agents, setAgents] = useState<OwnerProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    fetchOwnerAgents(address).then((data) => {
      setAgents(data)
      setLoading(false)
    })
  }, [address])

  if (loading) {
    return (
      <p className="text-xs text-text-muted font-mono">Loading your agents...</p>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="bg-surface border border-border p-8 text-center">
        <p className="text-sm text-text-secondary">
          No claimed agents yet.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Visit an agent page and click &ldquo;Claim this Agent&rdquo; to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => {
        const chain = getChain(agent.chain_id)
        return (
          <Link
            key={`${agent.chain_id}:${agent.agent_id}`}
            href={`/agent/${agent.chain_id}/${agent.agent_id}`}
            className="flex items-center justify-between bg-surface border border-border p-4 hover:border-border-bright transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="font-display text-lg font-bold text-text-primary">
                #{agent.agent_id}
              </span>
              <span className="text-xs text-text-muted font-mono">
                {chain?.name ?? `Chain ${agent.chain_id}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-pill status-pill-success">CLAIMED</span>
              <span className="text-[10px] text-text-muted font-mono">
                {new Date(agent.claimed_at).toLocaleDateString()}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

**Step 3: Create console page**

```typescript
// src/app/console/page.tsx
import { ConsoleGuard } from '@/components/console/ConsoleGuard'
import { ClaimedAgentsList } from '@/components/console/ClaimedAgentsList'

export const metadata = {
  title: 'Console — DenScope',
  description: 'Manage your claimed ERC-8004 agents',
}

export default function ConsolePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-grid mx-auto max-w-4xl px-6 py-10">
        <ConsoleGuard>
          <nav className="font-mono text-xs text-text-muted uppercase tracking-wider">
            System / DenScope / Console
          </nav>

          <h1 className="font-display text-3xl font-bold uppercase tracking-wider mt-4 text-text-primary">
            Owner Console
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your claimed agents and dashboard.
          </p>

          <div className="mt-8">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
              Claimed Agents
            </h2>
            <ClaimedAgentsList />
          </div>

          {/* Placeholder sections for M5 */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-2">
                Signals
              </h2>
              <p className="text-xs text-text-muted font-mono">Coming in M5</p>
            </div>
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-2">
                Alerts
              </h2>
              <p className="text-xs text-text-muted font-mono">Coming in M5</p>
            </div>
          </div>
        </ConsoleGuard>
      </div>
    </div>
  )
}
```

**Step 4: Run full test suite + build**

Run: `pnpm test && pnpm build`
Expected: All tests pass, build succeeds.

**Step 5: Commit**

```bash
git add src/app/console/page.tsx src/components/console/ConsoleGuard.tsx src/components/console/ClaimedAgentsList.tsx
git commit -m "feat: add console shell with claimed agents list"
```

---

## Task 13: Final Integration Tests + Cleanup

**Files:**
- Run all tests
- Verify full build
- Manual testing checklist

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (existing 45 + new tests).

**Step 2: Run production build**

Run: `pnpm build`
Expected: Build succeeds with no errors.

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors.

**Step 4: Manual testing checklist**

- [ ] Visit `/` — Header shows ConnectButton, Console nav item
- [ ] Click "Connect Wallet" — MetaMask (or injected wallet) prompt appears
- [ ] After connecting — address shown in header, truncated format
- [ ] Visit `/agent/42220/5` — claim section shows based on wallet status
- [ ] If connected as owner: "Claim this Agent" button visible
- [ ] Click "Claim this Agent" — SIWE signing prompt appears in wallet
- [ ] After signing — "Verifying..." then "CLAIMED" badge appears
- [ ] Refresh page — "CLAIMED" badge persists (read from Supabase)
- [ ] Visit `/console` — shows list of claimed agents
- [ ] Click claimed agent — navigates to agent page
- [ ] Disconnect wallet — Console shows "Connect wallet" prompt

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(m4): owner claim and profile — complete integration"
```

---

## Summary

| Task | Description | Files | Tests |
|------|-------------|-------|-------|
| 1 | Database migration: `owner_profiles` | 1 new | - |
| 2 | Install deps (wagmi, siwe, react-query) | 2 modified | - |
| 3 | Wagmi config + WalletProvider | 3 new, 1 modified | 1 test file |
| 4 | Auth store + ConnectButton | 3 new | 1 test file |
| 5 | SIWE helpers (create + verify) | 2 new | 1 test file |
| 6 | Owner profiles data layer | 1 new | 1 test file |
| 7 | Claim API route (nonce + verify + insert) | 2 new | - |
| 8 | ClaimedBadge component | 1 new | - |
| 9 | ClaimButton component | 1 new | - |
| 10 | Update agent page (integrate claim + badge) | 1 new, 1 modified | - |
| 11 | Update Header (ConnectButton + Console nav) | 1 modified | - |
| 12 | Console shell (guard + agents list + page) | 3 new | - |
| 13 | Integration tests + cleanup | - | Full suite |

**Total: 18 new files, 4 modified files, 4 test files, 13 commits**
