import type { Metadata } from 'next'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'
import { EmbedSnippet } from '@/components/shared/EmbedSnippet'
import { buildXIntentUrl, buildCertificateShareText } from '@/lib/share'
import { AddressChip } from '@/components/shared/AddressChip'
import { AgentEventTimeline } from '@/components/agent/AgentEventTimeline'
import { AgentClaimSection } from '@/components/agent/AgentClaimSection'
import { StatusPill } from '@/components/agent/StatusPill'
import { TrustSnapshot } from '@/components/agent/TrustSnapshot'
import { WhatChanged } from '@/components/agent/WhatChanged'
import { fetchDossierData } from '@/lib/dossier/fetch'
import { getAgentStatus, getSybilRisk, formatRelativeTime } from '@/lib/dossier/helpers'
import { toTrustScore } from '@/types/trust-score'

type Props = { params: Promise<{ chain: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)
  if (!chainConfig) return { title: 'Agent Not Found — DenScope' }

  const uri = await readAgentURI(chainConfig, agentId)
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`

  const ogImage = `/api/og/agent/${chain}/${id}`

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

function scoreColor(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 50) return 'text-accent'
  if (score >= 25) return 'text-warning'
  return 'text-critical'
}

function confidencePill(confidence: string): string {
  switch (confidence) {
    case 'high': return 'status-pill-success'
    case 'medium': return 'status-pill-accent'
    default: return 'status-pill-neutral'
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

  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null

  const claimStatusRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/owner_profiles?chain_id=eq.${chainConfig.id}&agent_id=eq.${agentId}&select=id`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
      },
      next: { revalidate: 60 },
    }
  ).then(r => r.json()).catch(() => [])
  const isClaimed = Array.isArray(claimStatusRes) && claimStatusRes.length > 0

  const trustScoreRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/trust_scores?chain_id=eq.${chainConfig.id}&agent_id=eq.${agentId}&select=*`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
      },
      next: { revalidate: 60 },
    }
  ).then(r => r.json()).catch(() => [])
  const trustScore = Array.isArray(trustScoreRes) && trustScoreRes.length > 0
    ? toTrustScore(trustScoreRes[0])
    : null

  const dossier = await fetchDossierData(chainConfig.id, agentId)

  const agentStatus = getAgentStatus(trustScore?.score ?? null)
  const sybilRisk = getSybilRisk({ openSybil: dossier.openSybilCount, resolvedSybil: dossier.resolvedSybilCount })
  const ageDays = dossier.firstSeen
    ? Math.floor((Date.now() - new Date(dossier.firstSeen).getTime()) / (24 * 60 * 60 * 1000))
    : null
  const storageType = (uri && isUrl(uri)) ? 'Off-chain' as const : 'On-chain' as const

  const services = metadata?.services?.map((s) => s.type.toUpperCase()) ?? []
  const serviceTypes = new Set(services)

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-grid mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
              <h1 className="font-display text-2xl font-bold text-text-primary">
                {metadata?.name ?? `Agent #${agentId}`}
              </h1>
              <span className="status-pill status-pill-accent">{chainConfig.name}</span>
              <StatusPill status={agentStatus} />
              {isClaimed && <span className="status-pill status-pill-success">CLAIMED</span>}
            </div>

            {metadata?.description && (
              <p className="text-sm text-text-secondary max-w-2xl mb-3">
                {metadata.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs font-mono text-text-muted">
              <span>Agent #{agentId}</span>
              <span>Last seen: {formatRelativeTime(dossier.lastSeen)}</span>
              <span>{dossier.totalEvents} events</span>
              {owner && <AddressChip address={owner} chainId={chainConfig.id} />}
            </div>
          </div>

          {/* Trust Score */}
          <div className="text-left md:text-right shrink-0">
            {trustScore ? (
              <div className="flex md:block items-center gap-3">
                <span className={`font-display text-5xl font-bold ${scoreColor(trustScore.score)}`}>
                  {trustScore.score}
                </span>
                <div className="md:mt-1">
                  <span className="text-xs text-text-muted font-mono block">/ 100</span>
                  <span className={`status-pill ${confidencePill(trustScore.confidence)} text-[10px] mt-1`}>
                    {trustScore.confidence.toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-muted font-mono">
                Awaiting first poll
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Watch Agent — placeholder, disabled */}
          <button
            disabled
            className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-muted cursor-not-allowed opacity-50"
            title="Coming soon"
          >
            Watch Agent
          </button>

          <span className="hidden md:inline-block border-l border-border h-5 mx-1" />

          {/* Secondary CTAs */}
          <a
            href={buildXIntentUrl(buildCertificateShareText({ chainId: chainConfig.id, agentId, name: metadata?.name }))}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
          >
            Share Certificate
          </a>
          <EmbedSnippet chainId={chainConfig.id} agentId={agentId} />
          <a
            href={`${chainConfig.explorer}/address/${chainConfig.contracts.identity}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
          >
            Explorer
          </a>
        </div>

        {/* Trust Snapshot — full width */}
        <div className="mt-8">
          <TrustSnapshot
            trustScore={trustScore}
            sybilRisk={sybilRisk}
            uniqueInteractors={dossier.uniqueInteractors}
            storageType={storageType}
            ageDays={ageDays}
          />
        </div>

        {/* 12-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-8">
          {/* Left column: Identity Card */}
          <div className="md:col-span-4">
            <div className="bg-surface border border-border p-6 space-y-5">
              {/* ERC-8004 label */}
              <div className="flex items-center justify-end">
                <span className="font-mono text-xs text-text-muted">
                  ERC-8004
                </span>
              </div>

              {/* Agent ID */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                  Agent ID
                </p>
                <p className="font-display text-4xl font-bold text-text-primary mt-1">
                  #{agentId}
                </p>
              </div>

              {/* Chain ID */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                  Chain ID
                </p>
                <p className="font-mono text-sm text-text-secondary mt-0.5">
                  {chainConfig.id}
                </p>
              </div>

              {/* Owner */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                  Owner
                </p>
                <div className="mt-0.5">
                  {owner ? (
                    <AddressChip address={owner} chainId={chainConfig.id} />
                  ) : (
                    <p className="font-mono text-xs text-text-secondary">unknown</p>
                  )}
                </div>
              </div>

              {/* URI */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                  Agent URI
                </p>
                {uri ? (
                  <AgentUriDisplay uri={uri} />
                ) : (
                  <p className="font-mono text-xs text-text-secondary mt-0.5">
                    unknown
                  </p>
                )}
              </div>

              {/* Storage Status */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">
                  Storage
                </p>
                <span className="status-pill status-pill-accent">
                  {storageType}
                </span>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="md:col-span-8 space-y-6">
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
                    <div
                      key={protocol}
                      className="flex items-center justify-between"
                    >
                      <span className="font-mono text-sm text-text-primary">
                        {protocol}
                      </span>
                      <span
                        className={`status-pill ${
                          isConnected
                            ? 'status-pill-success'
                            : 'status-pill-neutral'
                        }`}
                      >
                        {isConnected ? 'CONNECTED' : 'INACTIVE'}
                      </span>
                    </div>
                  )
                })}
                {/* Additional services not in KNOWN_PROTOCOLS */}
                {metadata?.services
                  ?.filter(
                    (s) =>
                      !KNOWN_PROTOCOLS.includes(
                        s.type.toUpperCase() as (typeof KNOWN_PROTOCOLS)[number]
                      )
                  )
                  .map((s, i) => (
                    <div key={`extra-${i}`} className="flex items-center justify-between">
                      <span className="font-mono text-sm text-text-primary">
                        {s.type}
                        {s.version ? ` v${s.version}` : ''}
                      </span>
                      <span className="status-pill status-pill-success">
                        CONNECTED
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Event History */}
            <AgentEventTimeline chainId={chainConfig.id} agentId={agentId} explorerUrl={chainConfig.explorer} />
          </div>
        </div>

        {/* Claim */}
        <AgentClaimSection chainId={chainConfig.id} agentId={agentId} ownerAddress={owner} />
      </div>
    </div>
  )
}
