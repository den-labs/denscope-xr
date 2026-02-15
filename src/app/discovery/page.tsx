'use client'

import { useDiscoveryStore } from '@/stores/discovery'
import { DiscoveryFeed } from '@/components/discovery/DiscoveryFeed'

export default function DiscoveryPage() {
  const signals = useDiscoveryStore((s) => s.signals)

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
            <p className="text-text-secondary text-xs uppercase tracking-widest font-mono mt-1">
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
          <select className="bg-surface border border-border text-text-primary text-xs font-mono px-3 py-1.5 appearance-none cursor-pointer focus:outline-none focus:border-border-bright">
            <option>All Severities</option>
            <option>Critical</option>
            <option>Warning</option>
            <option>Info</option>
          </select>
          <input
            type="text"
            placeholder="Search signals..."
            className="bg-surface border border-border text-text-primary text-xs font-mono px-3 py-1.5 flex-1 placeholder:text-text-muted focus:outline-none focus:border-border-bright"
          />
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <DiscoveryFeed />
      </div>
    </div>
  )
}
