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
      <div className="flex h-full items-center justify-center text-text-muted">
        <div className="text-center font-mono">
          <p className="text-lg">No discovery signals yet</p>
          <p className="mt-1 text-sm">Patterns will appear as events flow in</p>
        </div>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
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
