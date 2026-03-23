import type { AgentSummary } from '@/types/agents'
import { ChainBadge } from '@/components/shared/ChainBadge'
import { AddressChip } from '@/components/shared/AddressChip'

export function AgentIdentity({ agent }: { agent: AgentSummary }) {
  return (
    <div className="bg-surface border border-border p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-display font-bold text-foreground">
            {agent.metadata?.name ?? `Agent #${agent.agentId}`}
          </h2>
          <ChainBadge chainId={agent.chainId} />
        </div>
        {agent.metadata?.description && (
          <p className="text-sm text-foreground-secondary line-clamp-6">{agent.metadata.description}</p>
        )}
      </div>

      <div className="border-t border-border my-3" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-foreground-muted text-xs uppercase tracking-wider">Owner</span>
          <AddressChip address={agent.owner} chainId={agent.chainId} />
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-muted text-xs uppercase tracking-wider">Feedback</span>
          <span className="text-foreground-secondary font-mono text-sm">
            {agent.feedbackCount} (<span className="text-success">{agent.positiveFeedback}+</span> / <span className="text-danger">{agent.negativeFeedback}-</span>)
          </span>
        </div>
      </div>
    </div>
  )
}
