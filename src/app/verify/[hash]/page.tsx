import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findSnapshotByHash } from '@/lib/supabase/certificate-snapshots'
import { getAppBaseUrl, truncateHash } from '@/lib/trust/certificate'
import { getCertificateLabels } from '@/lib/trust/certificate-i18n'
import type { ShareCardStateKey } from '@/lib/trust/share-card-state'
import { VerifyContent } from './verify-content'

type Props = {
  params: Promise<{ hash: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params
  const snapshot = await findSnapshotByHash(hash)
  if (!snapshot) return { title: 'Certificate Not Found — DenScope' }

  const { name, score, state, signalCount } = snapshot.payload as {
    name: string | null
    score: number
    state: ShareCardStateKey
    signalCount: number
  }
  const labels = getCertificateLabels('en')
  const displayName = name ?? labels.unnamedAgent
  const stateLabel = labels.stateLabels[state]
  const baseUrl = getAppBaseUrl()

  return {
    title: `Trust Certificate — ${displayName} — DenScope`,
    description: `Trust Score: ${score}/100 · ${stateLabel} · ${signalCount} signals`,
    openGraph: {
      title: `DenScope Trust Certificate — ${displayName}`,
      description: `Trust Score: ${score}/100 · ${stateLabel} · ${signalCount} signals`,
      url: `${baseUrl}/verify/${hash}`,
      images: [`${baseUrl}/api/certificate/snapshot/${hash}`],
    },
    twitter: {
      card: 'summary_large_image',
    },
  }
}

export default async function VerifyPage({ params }: Props) {
  const { hash } = await params

  if (!/^[0-9a-f]{64}$/.test(hash)) {
    notFound()
  }

  const snapshot = await findSnapshotByHash(hash)
  if (!snapshot) {
    notFound()
  }

  const payload = snapshot.payload as {
    agentId: number
    chainId: number
    chainName: string
    name: string | null
    controller: string | null
    score: number
    state: ShareCardStateKey
    signalCount: number
    positiveCount: number
    negativeCount: number
  }

  const baseUrl = getAppBaseUrl()
  const imageUrl = snapshot.image_key
    ? `${baseUrl}/api/certificate/snapshot/${hash}`
    : null

  return (
    <VerifyContent
      hash={hash}
      displayHash={truncateHash(hash)}
      payload={payload}
      issuedAt={snapshot.issued_at}
      imageUrl={imageUrl}
      baseUrl={baseUrl}
    />
  )
}
