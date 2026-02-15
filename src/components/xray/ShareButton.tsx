'use client'

import { useState } from 'react'
import type { AgentSummary } from '@/types/agents'

export function ShareButton({ agent }: { agent: AgentSummary }) {
  const [copied, setCopied] = useState(false)
  const agentUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/agent/${agent.chainId}/${agent.agentId}`
      : `/agent/${agent.chainId}/${agent.agentId}`
  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`
  const tweetText = `${name} on ERC-8004\n\n${agentUrl}\n\nExplored with DenScope`

  return (
    <div className="flex gap-2">
      <button
        onClick={() => {
          navigator.clipboard.writeText(tweetText)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
      >
        {copied ? 'Copied!' : 'Copy Tweet'}
      </button>
      <a
        href={agentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
      >
        Share Link
      </a>
    </div>
  )
}
