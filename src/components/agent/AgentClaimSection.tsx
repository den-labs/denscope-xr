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
        <p className="text-xs text-foreground-muted">Checking claim status...</p>
      </div>
    )
  }

  if (isClaimed) {
    return (
      <div className="mt-6 border-t border-border pt-6 flex items-center gap-2">
        <ClaimedBadge />
        <p className="text-xs text-foreground-secondary">
          This agent has been claimed by its owner.
        </p>
      </div>
    )
  }

  if (!ownerAddress) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <p className="text-xs text-foreground-muted">
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
