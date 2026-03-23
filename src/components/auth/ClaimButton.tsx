'use client'

import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { createSiweMessage } from '@/lib/auth/siwe'
import { humanizeError } from '@/lib/errors/humanize'
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
        <p className="text-xs text-foreground-muted font-mono">
          Are you the owner of this agent?
        </p>
        <ConnectButton />
      </div>
    )
  }

  // Connected but not the owner
  if (address.toLowerCase() !== ownerAddress.toLowerCase()) {
    return (
      <p className="text-xs text-foreground-muted font-mono">
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
      setError(humanizeError(err))
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClaim}
        disabled={state === 'signing' || state === 'verifying'}
        className="border border-interactive/30 bg-interactive/5 px-3 py-1.5 text-xs font-mono text-interactive hover:bg-interactive/10 hover:border-interactive/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'signing' && 'Sign message...'}
        {state === 'verifying' && 'Verifying...'}
        {(state === 'idle' || state === 'error') && 'Claim this Agent'}
      </button>
      {error && (
        <p className="text-xs text-danger font-mono">{error}</p>
      )}
    </div>
  )
}
