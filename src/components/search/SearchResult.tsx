'use client'

import type { AgentSummary } from '@/types/agents'
import { getChain } from '@/config/chains'

type SearchResultProps = {
  agent: AgentSummary
  active: boolean
  onSelect: () => void
}

export function SearchResult({ agent, active, onSelect }: SearchResultProps) {
  const chain = getChain(agent.chainId)
  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`
  const owner = agent.owner
    ? `${agent.owner.slice(0, 6)}...${agent.owner.slice(-4)}`
    : 'Unknown'

  return (
    <button
      onClick={onSelect}
      onMouseEnter={(e) => e.currentTarget.focus()}
      data-active={active || undefined}
      className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
        active ? 'bg-surface-hover' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="min-w-0">
        <div className="truncate font-display text-sm text-text-primary">
          {name}
        </div>
        <div className="truncate font-mono text-xs text-text-muted">
          {owner}
        </div>
      </div>
      {chain && (
        <span
          className="ml-3 shrink-0 text-xs text-text-secondary"
          style={{ color: chain.badge.color }}
        >
          {chain.badge.label}
        </span>
      )}
    </button>
  )
}
