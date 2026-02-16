'use client'

import { useState } from 'react'
import type { AgentSummary } from '@/types/agents'
import { getChain } from '@/config/chains'

function buildTweetUrl(text: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`
}

export function ShareButton({ agent }: { agent: AgentSummary }) {
  const [open, setOpen] = useState(false)
  const agentUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/agent/${agent.chainId}/${agent.agentId}`
      : `/agent/${agent.chainId}/${agent.agentId}`
  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`
  const chainName = getChain(agent.chainId)?.name ?? `Chain ${agent.chainId}`

  const reportText = `${name} @${chainName} — from on-chain events to trust signals\n${agentUrl}\n\nPowered by @denlabs_app`
  const ownerText = `I shipped my ERC-8004 agent on @${chainName}: ${name}\nX-Ray report + trust signals ↓\n${agentUrl}\n\nPowered by @denlabs_app`

  const buttonClass =
    'border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors'

  return (
    <div className="relative">
      <div className="flex gap-2">
        <button onClick={() => setOpen(!open)} className={buttonClass}>
          Share on X
        </button>
        <a
          href={`/agent/${agent.chainId}/${agent.agentId}`}
          className={buttonClass}
        >
          Open Link
        </a>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 flex flex-col border border-border bg-surface shadow-lg min-w-[200px]">
          <a
            href={buildTweetUrl(reportText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="px-3 py-2 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
          >
            Share report
          </a>
          <a
            href={buildTweetUrl(ownerText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="px-3 py-2 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left border-t border-border"
          >
            I shipped this agent
          </a>
        </div>
      )}
    </div>
  )
}
