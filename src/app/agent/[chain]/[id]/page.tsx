import type { Metadata } from 'next'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'
import { EmbedSnippet } from '@/components/shared/EmbedSnippet'
import { findLatestSnapshot } from '@/lib/supabase/certificate-snapshots'
import { getAppBaseUrl } from '@/lib/trust/certificate'
import { AgentCertificateActions } from '@/components/agent/AgentCertificateActions'
import { AddressChip } from '@/components/shared/AddressChip'
import { AgentEventTimeline } from '@/components/agent/AgentEventTimeline'
import { AgentClaimSection } from '@/components/agent/AgentClaimSection'
import { WhatChanged } from '@/components/agent/WhatChanged'
import { fetchDossierData } from '@/lib/dossier/fetch'
import { formatRelativeTime } from '@/lib/dossier/helpers'
import { toTrustScore } from '@/types/trust-score'
import { buildTrustSnapshot, type TrustSnapshotInputs } from '@/lib/trust-snapshot/build'
import {
  fetchHasRecentReputationDrop,
  fetchRecentEventCount,
  fetchValidationEventCount,
} from '@/lib/supabase/event-aggregates'
import { fetchOpenIncidents } from '@/lib/supabase/open-incidents'
import { HeroBlock } from '@/components/agent/trust-snapshot/HeroBlock'
import { TrustRadar } from '@/components/agent/trust-snapshot/TrustRadar'
import { StrengthsWatchouts } from '@/components/agent/trust-snapshot/StrengthsWatchouts'
import { CoordinationMatrix } from '@/components/agent/trust-snapshot/CoordinationMatrix'
import { ImprovementList } from '@/components/agent/trust-snapshot/ImprovementList'
import { EvidenceDrawer } from '@/components/agent/trust-snapshot/EvidenceDrawer'
import { MobileStickyHeader } from '@/components/agent/trust-snapshot/MobileStickyHeader'

type Props = { params: Promise<{ chain: string; id: string }> }

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)
  if (!chainConfig) return { title: 'Agent Not Found — DenScope' }

  const uri = await readAgentURI(chainConfig, agentId)
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`

  // Use latest certificate snapshot for OG if available, else fall back to OG card
  let ogImage = `/api/og/agent/${chain}/${id}`
  try {
    const snapshot = await findLatestSnapshot(chainConfig.id, agentId)
    if (snapshot?.image_key) {
      const baseUrl = getAppBaseUrl()
      ogImage = `${baseUrl}/api/certificate/snapshot/${snapshot.hash}`
    }
  } catch { /* fall back to OG card */ }

  return {
    title: `${name} — DenScope`,
    description: `ERC-8004 agent on ${chainConfig.name}`,
    openGraph: {
      title: `${name} — DenScope`,
      description: `ERC-8004 agent on ${chainConfig.name}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} — DenScope`,
      description: `ERC-8004 agent on ${chainConfig.name}`,
      images: [ogImage],
    },
  }
}

const KNOWN_PROTOCOLS = ['A2A', 'MCP', 'x402'] as const

function isUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('ipfs://')
}

function AgentUriDisplay({ uri }: { uri: string }) {
  if (isUrl(uri)) {
    return (
      <a
        href={uri}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-accent break-all hover:underline mt-0.5 block"
      >
        {uri}
      </a>
    )
  }

  // Try to parse as JSON (some agents store metadata inline)
  try {
    const parsed = JSON.parse(uri)
    return (
      <div className="mt-1 space-y-1.5">
        {parsed.name && (
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] text-text-muted uppercase">name</span>
            <span className="font-mono text-xs text-text-secondary">{parsed.name}</span>
          </div>
        )}
        {parsed.description && (
          <div>
            <span className="text-[10px] text-text-muted uppercase">desc</span>
            <p className="font-mono text-xs text-text-secondary mt-0.5 line-clamp-2">
              {parsed.description}
            </p>
          </div>
        )}
        {parsed.image && (
          <div className="mt-1">
            <span className="text-[10px] text-text-muted uppercase">image</span>
            <a href={parsed.image} target="_blank" rel="noopener noreferrer" className="block mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={parsed.image}
                alt={parsed.name ?? 'Agent'}
                className="h-16 w-16 border border-border object-cover"
              />
            </a>
          </div>
        )}
        <span className="status-pill status-pill-accent text-[10px]">Inline JSON</span>
      </div>
    )
  } catch {
    // Not JSON, not URL — render as plain text
    return (
      <p className="font-mono text-xs text-text-secondary break-all mt-0.5">
        {uri}
      </p>
    )
  }
}

export default async function AgentPage({ params }: Props) {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        Chain not found
      </div>
    )
  }

  // On-chain identity + metadata (single read; reused by snapshot inputs + evidence).
  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null

  const now = Date.now()
  const sinceIso = new Date(now - THIRTY_DAYS_MS).toISOString()

  // Aggregate everything the snapshot needs in parallel. Identity/metadata are
  // already resolved above and passed straight into the inputs (no re-read).
  const [
    claimStatusRes,
    trustScoreRes,
    dossier,
    recentEventCount,
    validationEventCount,
    hasRecentReputationDrop,
    openIncidents,
  ] = await Promise.all([
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/owner_profiles?chain_id=eq.${chainConfig.id}&agent_id=eq.${agentId}&select=id`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
        next: { revalidate: 60 },
      }
    ).then((r) => r.json()).catch(() => []),
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/trust_scores?chain_id=eq.${chainConfig.id}&agent_id=eq.${agentId}&select=*`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        },
        next: { revalidate: 60 },
      }
    ).then((r) => r.json()).catch(() => []),
    fetchDossierData(chainConfig.id, agentId),
    fetchRecentEventCount(chainConfig.id, agentId, sinceIso),
    fetchValidationEventCount(chainConfig.id, agentId),
    fetchHasRecentReputationDrop(chainConfig.id, agentId, sinceIso),
    fetchOpenIncidents(chainConfig.id, agentId),
  ])

  const isClaimed = Array.isArray(claimStatusRes) && claimStatusRes.length > 0
  const trustScore =
    Array.isArray(trustScoreRes) && trustScoreRes.length > 0 ? toTrustScore(trustScoreRes[0]) : null

  const inputs: TrustSnapshotInputs = {
    trustScore,
    metadata,
    uriPresent: uri != null,
    ownerResolved: owner != null,
    claimed: isClaimed,
    firstSeen: dossier.firstSeen,
    lastSeen: dossier.lastSeen,
    totalEvents: dossier.totalEvents,
    uriUpdateCount: dossier.uriUpdateCount,
    feedbackCount: dossier.feedbackCount,
    positiveCount: dossier.positiveCount,
    recentEventCount,
    validationEventCount,
    openIncidents,
    hasSybilHistory: dossier.openSybilCount + dossier.resolvedSybilCount > 0,
    hasRecentReputationDrop,
    now,
  }
  const snapshot = buildTrustSnapshot(inputs)

  const agentName = metadata?.name ?? `Agent #${agentId}`
  const storageType = uri && isUrl(uri) ? ('Off-chain' as const) : ('On-chain' as const)
  const serviceTypes = new Set(metadata?.services?.map((s) => s.type.toUpperCase()) ?? [])

  return (
    <div className="h-full overflow-y-auto">
      <MobileStickyHeader snapshot={snapshot} agentName={agentName} agentId={agentId} />

      <div className="bg-grid mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* [1] Hero + footer actions row */}
        <div className="space-y-4">
          <HeroBlock
            snapshot={snapshot}
            agentName={agentName}
            chainLabel={chainConfig.name}
            agentId={agentId}
            claimed={isClaimed}
          />

          <div className="flex flex-wrap items-center gap-3">
            <AgentCertificateActions chainId={chainConfig.id} agentId={agentId} agentName={metadata?.name ?? null} />
            <details className="relative">
              <summary className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover cursor-pointer list-none">
                Embed
              </summary>
              <div className="absolute top-full mt-1 z-10">
                <EmbedSnippet chainId={chainConfig.id} agentId={agentId} />
              </div>
            </details>
            <a
              href={`${chainConfig.explorer}/address/${chainConfig.contracts.identity}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
            >
              Explorer
            </a>
          </div>
        </div>

        {/* [2] Trust Radar */}
        <TrustRadar radar={snapshot.radar} />

        {/* [3] Strengths · Watchouts */}
        <StrengthsWatchouts strengths={snapshot.strengths} watchouts={snapshot.watchouts} />

        {/* [4] Coordination Readiness Matrix */}
        <CoordinationMatrix coordination={snapshot.coordination} />

        {/* [5] Improvement Suggestions */}
        <ImprovementList improvements={snapshot.improvements} claimed={isClaimed} />

        {/* [6] Evidence drawer — identity, activity, protocols, timeline */}
        <EvidenceDrawer>
          {/* Identity Card */}
          <div className="bg-surface border border-border p-6 space-y-5">
            <div className="flex items-center justify-end">
              <span className="font-mono text-xs text-text-muted">ERC-8004</span>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">Agent ID</p>
              <p className="font-display text-4xl font-bold text-text-primary mt-1">#{agentId}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">Chain ID</p>
              <p className="font-mono text-sm text-text-secondary mt-0.5">{chainConfig.id}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">Owner</p>
              <div className="mt-0.5">
                {owner ? (
                  <AddressChip address={owner} chainId={chainConfig.id} />
                ) : (
                  <p className="font-mono text-xs text-text-secondary">unknown</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">Agent URI</p>
              {uri ? (
                <AgentUriDisplay uri={uri} />
              ) : (
                <p className="font-mono text-xs text-text-secondary mt-0.5">unknown</p>
              )}
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">Storage</p>
              <span className="status-pill status-pill-accent">{storageType}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs font-mono text-text-muted pt-2 border-t border-border">
              <span>Last seen: {formatRelativeTime(dossier.lastSeen)}</span>
              <span>{dossier.totalEvents} events</span>
            </div>
          </div>

          {/* What Changed */}
          <WhatChanged
            activity={{
              firstSeen: dossier.firstSeen,
              uriUpdateCount: dossier.uriUpdateCount,
              feedbackCount: dossier.feedbackCount,
              avgFeedback: dossier.avgFeedbackValue,
              totalEvents: dossier.totalEvents,
            }}
            lastSeen={dossier.lastSeen}
          />

          {/* Connected Protocols */}
          <div className="bg-surface border border-border p-5">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
              Connected Protocols
            </h2>
            <div className="space-y-2">
              {KNOWN_PROTOCOLS.map((protocol) => {
                const isConnected = serviceTypes.has(protocol)
                return (
                  <div key={protocol} className="flex items-center justify-between">
                    <span className="font-mono text-sm text-text-primary">{protocol}</span>
                    <span
                      className={`status-pill ${isConnected ? 'status-pill-success' : 'status-pill-neutral'}`}
                    >
                      {isConnected ? 'CONNECTED' : 'INACTIVE'}
                    </span>
                  </div>
                )
              })}
              {metadata?.services
                ?.filter(
                  (s) =>
                    !KNOWN_PROTOCOLS.includes(s.type.toUpperCase() as (typeof KNOWN_PROTOCOLS)[number])
                )
                .map((s, i) => (
                  <div key={`extra-${i}`} className="flex items-center justify-between">
                    <span className="font-mono text-sm text-text-primary">
                      {s.type}
                      {s.version ? ` v${s.version}` : ''}
                    </span>
                    <span className="status-pill status-pill-success">CONNECTED</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Event History */}
          <AgentEventTimeline chainId={chainConfig.id} agentId={agentId} explorerUrl={chainConfig.explorer} />

          <a
            href={`${chainConfig.explorer}/address/${chainConfig.contracts.identity}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-mono text-xs text-accent hover:underline"
          >
            View raw on explorer ↗
          </a>
        </EvidenceDrawer>

        {/* [7] Claim */}
        <AgentClaimSection chainId={chainConfig.id} agentId={agentId} ownerAddress={owner} />
      </div>
    </div>
  )
}
