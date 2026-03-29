import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { collectMetrics } from '@/lib/metrics/collect'
import type { MetricsPayload } from '@/lib/metrics/collect'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-mono text-text-primary">{value}</span>
    </div>
  )
}

function MetricGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
        {title}
      </h2>
      <div className="border-t border-border">{children}</div>
    </div>
  )
}

function Dashboard({ metrics }: { metrics: MetricsPayload }) {
  return (
    <>
      <MetricGroup title="Adoption">
        <MetricRow label="Owner Profiles" value={fmt(metrics.adoption.ownerProfiles)} />
        <MetricRow label="API Keys" value={fmt(metrics.adoption.apiKeysTotal)} />
        <MetricRow label="API Keys (Last 7d)" value={fmt(metrics.adoption.apiKeysLast7d)} />
        <MetricRow label="API Keys with Usage" value={fmt(metrics.adoption.apiKeysWithUsage)} />
        <MetricRow label="Key → First Call Conversion" value={pct(metrics.adoption.conversionRate)} />
      </MetricGroup>

      <MetricGroup title="Usage">
        <MetricRow label="API Calls (Last 7d)" value={fmt(metrics.usage.apiCallsLast7d)} />
        <MetricRow label="x402 Payments" value={fmt(metrics.usage.x402PaymentsTotal)} />
      </MetricGroup>

      <MetricGroup title="Trust Surface">
        <MetricRow label="Agents" value={fmt(metrics.trustSurface.agentsTotal)} />
        <MetricRow label="Events" value={fmt(metrics.trustSurface.eventsTotal)} />
        <MetricRow label="Events (Last 7d)" value={fmt(metrics.trustSurface.eventsLast7d)} />
        <MetricRow label="Active Agents (Last 7d)" value={fmt(metrics.trustSurface.activeAgentsLast7d)} />
        <MetricRow label="Certificates" value={fmt(metrics.trustSurface.certificatesTotal)} />
        <MetricRow label="Certificates (Last 7d)" value={fmt(metrics.trustSurface.certificatesLast7d)} />
      </MetricGroup>
    </>
  )
}

export default async function InternalMetricsPage() {
  const session = await requireSession()
  if (!session.ok) {
    redirect('/')
  }

  let metrics: MetricsPayload | null = null
  let error: string | null = null

  try {
    metrics = await collectMetrics()
  } catch (e) {
    console.error('Failed to collect metrics:', e)
    error = 'Failed to load metrics. Try again.'
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold text-text-primary">
            Internal Metrics
          </h1>
          <Link
            href="/internal/metrics"
            className="text-xs text-text-muted underline underline-offset-2 hover:text-accent transition-colors"
          >
            Refresh
          </Link>
        </div>

        {metrics && (
          <p className="mt-1 text-xs font-mono text-text-muted">
            Collected at {metrics.collectedAt}
          </p>
        )}

        {error && (
          <div className="mt-8 rounded-lg border border-critical/30 bg-critical/5 p-4">
            <p className="text-sm text-critical">{error}</p>
          </div>
        )}

        {metrics && <Dashboard metrics={metrics} />}
      </div>
    </div>
  )
}
