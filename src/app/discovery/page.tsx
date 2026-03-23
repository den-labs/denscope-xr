'use client'

import { useState } from 'react'
import { useDiscoveryStore } from '@/stores/discovery'
import { DiscoveryFeed } from '@/components/discovery/DiscoveryFeed'

export default function DiscoveryPage() {
  const signals = useDiscoveryStore((s) => s.signals)
  const [severity, setSeverity] = useState<string>('')
  const [search, setSearch] = useState('')

  const criticalCount = signals.filter((s) => s.severity === 'critical').length
  const warningCount = signals.filter((s) => s.severity === 'warning').length

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wider">
              Signals Feed
            </h1>
            <p className="text-foreground-secondary text-xs uppercase tracking-widest mt-1">
              Live Monitoring / Anomaly Detection
            </p>
          </div>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="status-pill status-pill-critical">
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="status-pill status-pill-warning">
                {warningCount} Warning
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="bg-surface border border-border text-foreground text-xs px-3 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-border-bright"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <input
            type="text"
            placeholder="Search signals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface border border-border text-foreground text-xs px-3 py-1.5 flex-1 placeholder:text-foreground-muted focus:outline-none focus:border-border-bright"
          />
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <DiscoveryFeed severity={severity} search={search} />
      </div>
    </div>
  )
}
