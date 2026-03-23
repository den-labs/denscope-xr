'use client'

import { useState } from 'react'
import type { AgentSummary } from '@/types/agents'
import {
  buildXIntentUrl,
  buildCertificateShareText,
  buildOwnerShareText,
} from '@/lib/share'

export function ShareButton({ agent }: { agent: AgentSummary }) {
  const [open, setOpen] = useState(false)
  const shareInput = {
    chainId: agent.chainId,
    agentId: agent.agentId,
    name: agent.metadata?.name,
  }

  const secondaryClass =
    'border border-border bg-surface px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground hover:border-border-bright transition-colors'

  return (
    <div className="relative">
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="border border-text-primary bg-text-primary px-4 py-1.5 text-xs font-bold text-background hover:bg-transparent hover:text-foreground transition-colors"
        >
          Share Certificate
        </button>
        <a
          href={`/agent/${agent.chainId}/${agent.agentId}`}
          className={secondaryClass}
        >
          View Full Report
        </a>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 flex flex-col border border-border-bright bg-surface shadow-lg min-w-[200px]">
          <a
            href={buildXIntentUrl(buildCertificateShareText(shareInput))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground transition-colors text-left"
          >
            Share Certificate
          </a>
          <a
            href={buildXIntentUrl(buildOwnerShareText(shareInput))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground transition-colors text-left border-t border-border"
          >
            I Own This Agent
          </a>
        </div>
      )}
    </div>
  )
}
