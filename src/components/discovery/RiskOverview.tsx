import type { TrustOpsOverview } from '@/lib/trustops/collect'

type BandCardProps = {
  label: string
  count: number
  color: string
  total: number
}

function BandCard({ label, count, color, total }: BandCardProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-mono">
          {label}
        </span>
      </div>
      <span className="text-2xl font-bold text-text-primary font-mono">{count}</span>
      <div className="mt-2 h-1.5 w-full bg-surface-alt border border-border">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] text-text-muted font-mono mt-1 block">{pct}%</span>
    </div>
  )
}

function StatCard({ label, value, variant }: { label: string; value: number; variant?: 'warning' | 'critical' }) {
  const textColor =
    variant === 'critical' ? 'text-critical' :
    variant === 'warning' ? 'text-warning' :
    'text-text-primary'

  return (
    <div className="border border-border bg-surface p-4">
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-mono block mb-2">
        {label}
      </span>
      <span className={`text-2xl font-bold font-mono ${textColor}`}>{value}</span>
    </div>
  )
}

export function RiskOverview({ overview }: { overview: TrustOpsOverview }) {
  const scoredTotal =
    overview.trustBands.high +
    overview.trustBands.medium +
    overview.trustBands.low +
    overview.trustBands.insufficient

  return (
    <div className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
        Risk Overview
      </h2>

      {/* Trust Band Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BandCard label="High Trust" count={overview.trustBands.high} color="#059669" total={scoredTotal} />
        <BandCard label="Medium Trust" count={overview.trustBands.medium} color="#EA580C" total={scoredTotal} />
        <BandCard label="Low Trust" count={overview.trustBands.low} color="#DC2626" total={scoredTotal} />
        <BandCard label="Insufficient" count={overview.trustBands.insufficient} color="#6b7280" total={scoredTotal} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <StatCard label="Total Agents" value={overview.totalAgents} />
        <StatCard label="Open Incidents" value={overview.openIncidents} variant={overview.openIncidents > 0 ? 'warning' : undefined} />
        <StatCard label="Elevated Risk" value={overview.elevatedRiskCount} variant={overview.elevatedRiskCount > 0 ? 'warning' : undefined} />
        <StatCard label="Critical Risk" value={overview.criticalRiskCount} variant={overview.criticalRiskCount > 0 ? 'critical' : undefined} />
      </div>
    </div>
  )
}
