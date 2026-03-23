import type { TrustScore } from '@/types/trust-score'
import type { SybilRisk } from '@/lib/dossier/helpers'

type Props = {
  trustScore: TrustScore | null
  sybilRisk: SybilRisk
  uniqueInteractors: number
  storageType: 'On-chain' | 'Off-chain'
  ageDays: number | null
}

const variantTextColor: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  critical: 'text-danger',
  neutral: 'text-foreground',
  accent: 'text-interactive',
}

function MetricCard({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string
  value: string
  sub?: string
  colorClass?: string
}) {
  return (
    <div>
      <div className="text-[10px] text-foreground-muted uppercase tracking-wider font-mono mb-2">
        {label}
      </div>
      <div className={`font-mono text-lg font-bold ${colorClass ?? 'text-foreground'}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-foreground-muted font-mono mt-1">{sub}</div>
      )}
    </div>
  )
}

export function TrustSnapshot({
  trustScore,
  sybilRisk,
  uniqueInteractors,
  storageType,
  ageDays,
}: Props) {
  const reputationValue = trustScore
    ? `${trustScore.positiveCount}/${trustScore.feedbackCount}`
    : '\u2014'

  const reputationSub = trustScore && trustScore.feedbackCount > 0
    ? `${Math.round(trustScore.positiveRatio * 100)}% positive`
    : undefined

  const ageValue = ageDays !== null
    ? ageDays === 0 ? 'Today' : `${ageDays}d`
    : '\u2014'

  const ageSub = ageDays !== null
    ? ageDays === 0 ? 'Registered today' : 'Since registration'
    : undefined

  const storageSub = storageType === 'On-chain'
    ? 'Metadata stored on-chain'
    : 'Metadata stored off-chain'

  const exposureValue = uniqueInteractors > 0
    ? String(uniqueInteractors)
    : '\u2014'

  const exposureSub = uniqueInteractors > 0
    ? `unique interactor${uniqueInteractors === 1 ? '' : 's'}`
    : undefined

  return (
    <section className="bg-surface border border-border p-5">
      <h3 className="text-sm font-mono font-bold text-foreground mb-4">
        Trust Snapshot
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Reputation"
          value={reputationValue}
          sub={reputationSub}
        />
        <MetricCard
          label="Age"
          value={ageValue}
          sub={ageSub}
        />
        <MetricCard
          label="Sybil Risk"
          value={sybilRisk.level}
          colorClass={variantTextColor[sybilRisk.variant] ?? 'text-foreground'}
        />
        <MetricCard
          label="Proofs"
          value={storageType}
          sub={storageSub}
        />
        <MetricCard
          label="Exposure"
          value={exposureValue}
          sub={exposureSub}
        />
      </div>
    </section>
  )
}
