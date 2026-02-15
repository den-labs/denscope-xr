import type { DiscoverySignal } from '@/types/discovery'
import { ChainBadge } from '@/components/shared/ChainBadge'

const severityColors = {
  info: 'border-blue-500/30 bg-blue-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
}

export function SignalCard({ signal }: { signal: DiscoverySignal }) {
  return (
    <div className={`rounded-lg border p-4 ${severityColors[signal.severity]}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">{signal.title}</h3>
        <ChainBadge chainId={signal.chainId} />
      </div>
      <p className="mt-1 text-sm text-zinc-400">{signal.description}</p>
      <span className="mt-2 block text-xs text-zinc-600">
        {new Date(signal.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}
