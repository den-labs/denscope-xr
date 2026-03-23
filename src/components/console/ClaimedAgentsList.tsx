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
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse bg-surface border border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-5 w-10 bg-border rounded" />
              <div className="h-3 w-20 bg-border rounded" />
            </div>
            <div className="h-4 w-16 bg-border rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="bg-surface border border-border p-8 text-center shadow-sm dark:shadow-none">
        <p className="text-sm text-foreground-secondary">
          No claimed agents yet.
        </p>
        <p className="mt-2 text-xs text-foreground-muted">
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
              <span className="font-display text-lg font-bold text-foreground">
                #{agent.agent_id}
              </span>
              <span className="text-xs text-foreground-muted">
                {chain?.name ?? `Chain ${agent.chain_id}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-pill status-pill-success">CLAIMED</span>
              <span className="text-[11px] text-foreground-muted">
                {new Date(agent.claimed_at).toLocaleDateString()}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
