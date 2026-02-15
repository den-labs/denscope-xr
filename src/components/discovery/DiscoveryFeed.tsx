'use client'

import { useDiscoveryStore } from '@/stores/discovery'
import { SignalCard } from './SignalCard'

export function DiscoveryFeed() {
  const signals = useDiscoveryStore((s) => s.signals)

  if (signals.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        <div className="text-center font-mono">
          <p className="text-lg">No discovery signals yet</p>
          <p className="mt-1 text-sm">Patterns will appear as events flow in</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
        {signals.map((signal, i) => (
          <SignalCard key={`${signal.kind}-${signal.timestamp}-${i}`} signal={signal} />
        ))}
      </div>
    </div>
  )
}
