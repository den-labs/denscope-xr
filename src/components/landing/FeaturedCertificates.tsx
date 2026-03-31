import Link from 'next/link'
import { ChainBadge } from '@/components/shared/ChainBadge'
import type { FeaturedCertificate } from '@/lib/supabase/featured-certificates'

type FeaturedCertificatesProps = {
  topScore: FeaturedCertificate[]
  recent: FeaturedCertificate[]
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  )
  if (seconds < 0) return 'just now'
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function scoreToBand(score: number): { label: string; color: string } {
  if (score >= 60) return { label: 'High Trust', color: '#059669' }
  if (score >= 35) return { label: 'Medium Trust', color: '#EA580C' }
  if (score >= 15) return { label: 'Low Trust', color: '#DC2626' }
  return { label: 'Insufficient', color: '#6b7280' }
}

function CertificateCard({ cert }: { cert: FeaturedCertificate }) {
  const band = scoreToBand(cert.score)

  return (
    <Link
      href={`/agent/${cert.chainId}/${cert.agentId}`}
      className="group block rounded-lg border border-border p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-center gap-2">
        <div className="text-3xl font-bold font-display text-text-primary">
          {cert.score}
        </div>
        <span
          className="rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase leading-tight text-white"
          style={{ backgroundColor: band.color }}
        >
          {band.label}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ChainBadge chainId={cert.chainId} />
        <span className="text-sm text-text-secondary font-mono">
          #{cert.agentId}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {cert.group === 'top-score' ? 'Top Score' : 'Recent'}
        </span>
        <span className="text-xs text-text-muted">{timeAgo(cert.issuedAt)}</span>
      </div>
    </Link>
  )
}

export function FeaturedCertificates({
  topScore,
  recent,
}: FeaturedCertificatesProps) {
  if (topScore.length === 0 && recent.length === 0) return null

  return (
    <section className="px-6 py-14 md:py-20">
      <div className="mx-auto max-w-[900px]">
        <h2 className="text-center font-display text-2xl font-bold text-text-primary">
          Featured Certificates
        </h2>
        <p className="mt-2 text-center text-sm text-text-muted">
          A live mix of high-trust and recently issued agent certificates.
        </p>

        {topScore.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Top Trust Certificates
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topScore.map((cert) => (
                <CertificateCard key={cert.hash} cert={cert} />
              ))}
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Recent Certificates
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((cert) => (
                <CertificateCard key={cert.hash} cert={cert} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
