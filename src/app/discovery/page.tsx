import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { collectTrustOpsOverview } from '@/lib/trustops/collect'
import type { TrustOpsOverview } from '@/lib/trustops/collect'
import { RiskOverview } from '@/components/discovery/RiskOverview'
import { EvaluationActivity } from '@/components/discovery/EvaluationActivity'
import { TrustOpsSignals } from '@/components/discovery/TrustOpsSignals'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TrustOpsPage() {
  const session = await requireSession()
  if (!session.ok) {
    redirect('/')
  }

  let overview: TrustOpsOverview | null = null
  let error: string | null = null

  try {
    overview = await collectTrustOpsOverview()
  } catch (e) {
    console.error('Failed to collect TrustOps overview:', e)
    error = 'Failed to load TrustOps data. Try again.'
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-text-primary">
              TrustOps
            </h1>
            <p className="text-text-secondary text-xs uppercase tracking-widest font-mono mt-1">
              Portfolio Risk Monitoring / Evaluation Dashboard
            </p>
          </div>
          <Link
            href="/discovery"
            className="text-xs text-text-muted underline underline-offset-2 hover:text-accent transition-colors"
          >
            Refresh
          </Link>
        </div>

        {overview && (
          <p className="mt-1 text-xs font-mono text-text-muted">
            Collected at {new Date(overview.collectedAt).toLocaleTimeString()}
          </p>
        )}

        {error && (
          <div className="mt-8 border border-critical/30 bg-critical/5 p-4">
            <p className="text-sm text-critical">{error}</p>
          </div>
        )}

        {overview && (
          <>
            <RiskOverview overview={overview} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <TrustOpsSignals />
              <EvaluationActivity evaluations={overview.recentEvaluations} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
