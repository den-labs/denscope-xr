'use client'

import { useState } from 'react'
import { useDiscoveryStore } from '@/stores/discovery'
import { SignalCard } from './SignalCard'

export function TrustOpsSignals() {
  const signals = useDiscoveryStore((s) => s.signals)
  const [severity, setSeverity] = useState<string>('')

  const filtered = severity
    ? signals.filter((s) => s.severity === severity)
    : signals

  const criticalCount = signals.filter((s) => s.severity === 'critical').length
  const warningCount = signals.filter((s) => s.severity === 'warning').length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Active Signals
        </h2>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="status-pill status-pill-critical text-[10px]">
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="status-pill status-pill-warning text-[10px]">
              {warningCount}
            </span>
          )}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="bg-surface border border-border text-text-primary text-[10px] font-mono px-2 py-1 appearance-none cursor-pointer focus:outline-none focus:border-border-bright"
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted font-mono">Listening for signals...</p>
          <p className="text-xs text-text-muted mt-1">
            Signals appear in real-time as on-chain events are processed
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted font-mono">No signals match filter</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filtered.slice(0, 10).map((signal, i) => (
            <SignalCard key={`${signal.kind}-${signal.timestamp}-${i}`} signal={signal} />
          ))}
        </div>
      )}
    </div>
  )
}
