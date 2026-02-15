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
  const services = agent.metadata?.services?.map((s) => s.type.toUpperCase()) ?? []
  const serviceSuffix = services.length > 0 ? ` [${services.join(' / ')}]` : ''
  const tweetText = `${name}${serviceSuffix} on ERC-8004\n\n${agentUrl}\n\nExplored with @denlabs_app`
  const tweetUrl = `https://x.com/intent/post?text=${encodeURIComponent(tweetText)}`

  return (
    <div className="flex gap-2">
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
      >
        Post on X
      </a>
      <button
        onClick={() => {
          navigator.clipboard.writeText(agentUrl)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  )
}
