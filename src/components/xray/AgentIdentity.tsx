import type { AgentSummary } from '@/types/agents'
import { ChainBadge } from '@/components/shared/ChainBadge'
import { AddressChip } from '@/components/shared/AddressChip'

export function AgentIdentity({ agent }: { agent: AgentSummary }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">
          {agent.metadata?.name ?? `Agent #${agent.agentId}`}
        </h2>
        <ChainBadge chainId={agent.chainId} />
      </div>
      {agent.metadata?.description && (
        <p className="text-sm text-zinc-400">{agent.metadata.description}</p>
      )}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Owner</span>
          <AddressChip address={agent.owner} chainId={agent.chainId} />
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Feedback</span>
          <span className="text-zinc-300">
            {agent.feedbackCount} ({agent.positiveFeedback}+ / {agent.negativeFeedback}-)
          </span>
        </div>
      </div>
    </div>
  )
}
