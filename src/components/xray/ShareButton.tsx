'use client'

import type { AgentSummary } from '@/types/agents'
import {
  buildXIntentUrl,
  buildCertificateShareText,
} from '@/lib/share'

export function ShareButton({ agent }: { agent: AgentSummary }) {
  const shareInput = {
    chainId: agent.chainId,
    agentId: agent.agentId,
    name: agent.metadata?.name,
  }

  function handleShareX() {
    window.open(buildXIntentUrl(buildCertificateShareText(shareInput)), '_blank')
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleShareX}
        className="bg-accent px-4 py-1.5 text-xs font-mono font-bold text-white hover:opacity-90 transition-opacity"
      >
        Share on X
      </button>
      <a
        href={`/agent/${agent.chainId}/${agent.agentId}`}
        className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
      >
        View Full Report
      </a>
    </div>
  )
}
