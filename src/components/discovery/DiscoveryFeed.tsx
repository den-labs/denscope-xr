'use client'

import { useMemo } from 'react'
import { useDiscoveryStore } from '@/stores/discovery'
import { SignalCard } from './SignalCard'

type Props = {
  severity?: string
  search?: string
}

export function DiscoveryFeed({ severity, search }: Props) {
  const signals = useDiscoveryStore((s) => s.signals)

  const filtered = useMemo(() => {
    const q = search?.trim().toLowerCase() ?? ''
    return signals.filter((s) => {
      if (severity && s.severity !== severity) return false
      if (q) {
        const matchesTitle = s.title.toLowerCase().includes(q)
        const matchesAgent = s.agentIds.some((id) => String(id) === q)
        if (!matchesTitle && !matchesAgent) return false
      }
      return true
    })
  }, [signals, severity, search])

  if (signals.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-foreground-muted">
        <div className="text-center font-mono max-w-md">
          <p className="text-lg">Listening for patterns...</p>
          <p className="mt-2 text-sm">
            Discovery detects signals like an agent&apos;s first interaction or unusual feedback spikes.
            Signals appear in real-time as on-chain events are processed.
          </p>
          <div className="mt-6 flex flex-col gap-2 text-xs text-left mx-auto w-fit">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span>First Blood — agent receives its first feedback</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              <span>Rising Star — 5+ feedbacks within 24 hours</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-foreground-muted">
        <div className="text-center font-mono">
          <p className="text-lg">No signals match filters</p>
          <p className="mt-1 text-sm">Try adjusting severity or search criteria</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
        {filtered.map((signal, i) => (
          <SignalCard key={`${signal.kind}-${signal.timestamp}-${i}`} signal={signal} />
        ))}
      </div>
    </div>
  )
}
