'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { useGraphStore } from '@/stores/graph'
import { fetchAgentMetadata } from '@/lib/agent/metadata'
import { ChainBadge } from '@/components/shared/ChainBadge'
import { AgentIdentity } from './AgentIdentity'
import { AgentServices } from './AgentServices'
import { TapePanel } from './TapePanel'
import { LeadersPanel } from './LeadersPanel'
import { feedbackStatsForTarget } from '@/lib/firehose/feedbackStats'
import { fetchTrustScore } from '@/lib/supabase/trust-scores'
import { getShareCardState } from '@/lib/trust/share-card-state'
import {
  buildXIntentUrl,
  buildCertificateShareText,
  shareCertificate,
} from '@/lib/share'
import type { ShareCardStateKey } from '@/lib/trust/share-card-state'
import type { AgentMetadata } from '@/types/agents'
import type { TrustScore } from '@/types/trust-score'

type XRayPanelProps = {
  agentKey: string | null
  onClose: () => void
  isDocked?: boolean
  onSelectAgent?: (agentKey: string) => void
}

function truncateAddress(addr: string | null): string {
  if (!addr) return 'Unknown'
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function XRayPanel({ agentKey, onClose, isDocked, onSelectAgent }: XRayPanelProps) {
  const agent = useAgentStore((s) => (agentKey ? s.agents.get(agentKey) : undefined))
  const edges = useGraphStore((s) => s.edges)
  const cacheMetadata = useAgentStore((s) => s.cacheMetadata)
  const [metadataCache, setMetadataCache] = useState<{ key: string; value: AgentMetadata | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [copyModalUrl, setCopyModalUrl] = useState<string | null>(null)
  const [tab, setTab] = useState<'inspector' | 'tape' | 'leaders'>('inspector')
  const [trustScoreCache, setTrustScoreCache] = useState<{ key: string; value: TrustScore | null } | null>(null)

  useEffect(() => {
    const agentURI = agent?.agentURI
    const hasMetadata = Boolean(agent?.metadata)
    if (!agentURI || hasMetadata) return

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(false)
      try {
        const result = await fetchAgentMetadata(agentURI)
        if (cancelled) return
        if (!result) setError(true)
        if (agentKey) setMetadataCache({ key: agentKey, value: result })
        if (result && agentKey) cacheMetadata(agentKey, result)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [agent?.agentURI, agent?.metadata, agentKey, cacheMetadata])

  useEffect(() => {
    const chainId = agent?.chainId
    const selectedAgentId = agent?.agentId
    if (chainId == null || selectedAgentId == null || !agentKey) return
    let cancelled = false
    fetchTrustScore(chainId, selectedAgentId)
      .then((score) => {
        if (!cancelled) setTrustScoreCache({ key: agentKey, value: score })
      })
      .catch(() => {
        if (!cancelled) setTrustScoreCache({ key: agentKey, value: null })
      })
    return () => {
      cancelled = true
    }
  }, [agent?.chainId, agent?.agentId, agentKey])

  const trustScore = trustScoreCache?.key === agentKey ? trustScoreCache.value : null
  const metadata = agent?.metadata ?? (metadataCache?.key === agentKey ? metadataCache.value : null)
  const enriched = agent ? { ...agent, metadata: metadata ?? undefined } : null
  const feedbackStats = useMemo(
    () => (agentKey ? feedbackStatsForTarget(edges, agentKey) : {
      total: 0,
      posCount: 0,
      negCount: 0,
      neutralCount: 0,
      positivePct: 0,
    }),
    [edges, agentKey],
  )

  function retry() {
    if (!agent?.agentURI) return
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        if (agentKey) setMetadataCache({ key: agentKey, value: result })
        if (result && agentKey) cacheMetadata(agentKey, result)
      })
      .finally(() => setLoading(false))
  }

  const name = enriched?.metadata?.name ?? (enriched ? `Agent #${enriched.agentId}` : '')
  const shareCardState = useMemo(() => getShareCardState(trustScore), [trustScore])
  const shareInput = enriched
    ? { chainId: enriched.chainId, agentId: enriched.agentId, name: enriched.metadata?.name }
    : null

  function handleShare() {
    if (!shareInput) return
    window.open(buildXIntentUrl(buildCertificateShareText(shareInput)), '_blank')
  }

  async function handleNativeShare() {
    if (!shareInput) return
    try {
      const certUrl = `/api/certificate/${shareInput.chainId}/${shareInput.agentId}`
      const res = await fetch(`${certUrl}?format=json`)
      if (!res.ok) return
      const data = await res.json()
      const hash = data.hash as string
      const state = (data.payload?.state ?? 'insufficient_signal') as ShareCardStateKey

      const result = await shareCertificate({
        hash,
        name: shareInput.name ?? null,
        state,
        lang: 'en',
      })

      if (result === 'copied') {
        setShareStatus('Link copied!')
        setTimeout(() => setShareStatus(null), 2000)
      } else if (result === 'modal') {
        setCopyModalUrl(`${window.location.origin}/verify/${hash}`)
      }
    } catch { /* silently fail */ }
  }

  // Empty state content
  const emptyContent = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-lg font-bold text-text-primary">
        Generate a Trust Certificate
      </p>
      <p className="mt-2 font-mono text-xs text-text-secondary">
        Click any agent to preview and share.
      </p>
      <button
        disabled
        className="mt-6 w-full border border-border bg-surface px-4 py-3 text-sm font-mono font-bold text-text-muted cursor-not-allowed"
      >
        Share on X
      </button>
    </div>
  )

  // Certificate-first content
  const certificateContent = enriched && shareInput && (
    <>
      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-4 pt-2">
            <div className="h-6 w-48 bg-surface" />
            <div className="h-4 w-64 bg-surface" />
          </div>
        ) : (
          <>
            {/* Certificate Preview Card */}
            <div className="border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold text-text-primary truncate">
                  {name}
                </span>
                <ChainBadge chainId={enriched.chainId} />
              </div>
              <div
                className="border p-3 space-y-2"
                style={{
                  borderColor: shareCardState.accentSoft,
                  backgroundColor: 'rgba(0,0,0,0.18)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: shareCardState.accentColor }}
                  >
                    {shareCardState.label}
                  </span>
                  <span
                    className="font-display text-2xl font-bold leading-none"
                    style={{ color: shareCardState.accentColor }}
                  >
                    {trustScore ? Math.round(trustScore.score) : '\u2014'}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-text-secondary">
                  {shareCardState.evidenceLine}
                </p>
              </div>
              {enriched.metadata?.description && (
                <p className="text-sm text-text-secondary line-clamp-2">
                  {enriched.metadata.description}
                </p>
              )}
              <div className="font-mono text-xs text-text-secondary">
                {feedbackStats.total > 0 ? (
                  <span>
                    Positive: <span className="text-success">{feedbackStats.positivePct}%</span>
                    {' '}({feedbackStats.total} total)
                  </span>
                ) : (
                  <span className="text-text-muted">Awaiting feedback</span>
                )}
              </div>
            </div>

            {/* Primary CTA — Share on X */}
            <button
              onClick={handleShare}
              className="w-full bg-accent px-4 py-3 text-sm font-mono font-bold text-white hover:opacity-90 transition-opacity"
            >
              Share on X
            </button>

            {/* Secondary — Native Share */}
            {shareStatus && (
              <p className="text-xs text-accent font-mono text-center">{shareStatus}</p>
            )}
            <button
              onClick={handleNativeShare}
              className="w-full border border-border bg-surface px-4 py-2.5 text-sm font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
            >
              Share
            </button>

            {/* Secondary CTA */}
            <a
              href={`/agent/${enriched.chainId}/${enriched.agentId}`}
              className="block text-center font-mono text-xs text-text-muted hover:text-accent transition-colors"
            >
              View Full Report &rarr;
            </a>

            {copyModalUrl && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCopyModalUrl(null)}>
                <div className="bg-bg border border-border p-4 rounded-lg max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-text-muted mb-2 font-mono">Copy this link:</p>
                  <input
                    type="text"
                    readOnly
                    value={copyModalUrl}
                    className="w-full bg-surface border border-border px-3 py-2 text-sm font-mono text-text-primary rounded"
                    onFocus={(e) => e.target.select()}
                  />
                  <button onClick={() => setCopyModalUrl(null)} className="mt-3 w-full text-xs text-text-muted hover:text-text-primary font-mono">
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Micro-data (1 line) */}
            <p className="font-mono text-[10px] text-text-muted truncate">
              Owner {truncateAddress(enriched.owner)} | +{feedbackStats.posCount} / -{feedbackStats.negCount} / ={feedbackStats.neutralCount} | Snapshot {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
            </p>

            {error && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-mono">Metadata unavailable</span>
                <button onClick={retry} className="text-xs text-accent font-mono hover:underline">Retry</button>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Existing detail sections */}
            <AgentIdentity agent={enriched} />
            <AgentServices metadata={enriched.metadata} />
          </>
        )}
      </div>
    </>
  )

  const panelContent = tab === 'inspector'
    ? (enriched ? certificateContent : emptyContent)
    : tab === 'tape'
      ? <TapePanel onSelectAgent={(key) => onSelectAgent?.(key)} />
      : <LeadersPanel onSelectAgent={(key) => onSelectAgent?.(key)} />

  // Docked mode: always render panel (no AnimatePresence wrapper for show/hide)
  if (isDocked) {
    return (
      <div className="flex h-full w-96 flex-col border-l border-border bg-bg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            TRUST CERTIFICATE
          </span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xs">
            ✕
          </button>
        </div>
        <div className="border-b border-border px-6 py-2 flex items-center gap-2">
          <button
            onClick={() => setTab('inspector')}
            className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
              tab === 'inspector'
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-border text-text-secondary hover:text-text-primary hover:border-border-bright'
            }`}
          >
            Inspector
          </button>
          <button
            onClick={() => setTab('tape')}
            className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
              tab === 'tape'
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-border text-text-secondary hover:text-text-primary hover:border-border-bright'
            }`}
          >
            Tape
          </button>
          <button
            onClick={() => setTab('leaders')}
            className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
              tab === 'leaders'
                ? 'border-text-primary bg-text-primary text-bg'
                : 'border-border text-text-secondary hover:text-text-primary hover:border-border-bright'
            }`}
          >
            Leaders
          </button>
        </div>
        {panelContent}
      </div>
    )
  }

  // Drawer mode (mobile): animated slide-in, only when agent selected
  return (
    <AnimatePresence>
      {agentKey && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 z-50 flex h-full w-96 max-w-[90vw] flex-col border-l border-border bg-bg shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              TRUST CERTIFICATE
            </span>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xs">
              ✕
            </button>
          </div>
          <div className="border-b border-border px-6 py-2 flex items-center gap-2">
            <button
              onClick={() => setTab('inspector')}
              className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
                tab === 'inspector'
                  ? 'border-text-primary bg-text-primary text-bg'
                  : 'border-border text-text-secondary hover:text-text-primary hover:border-border-bright'
              }`}
            >
              Inspector
            </button>
            <button
              onClick={() => setTab('tape')}
              className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
                tab === 'tape'
                  ? 'border-text-primary bg-text-primary text-bg'
                  : 'border-border text-text-secondary hover:text-text-primary hover:border-border-bright'
              }`}
            >
              Tape
            </button>
            <button
              onClick={() => setTab('leaders')}
              className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
                tab === 'leaders'
                  ? 'border-text-primary bg-text-primary text-bg'
                  : 'border-border text-text-secondary hover:text-text-primary hover:border-border-bright'
              }`}
            >
              Leaders
            </button>
          </div>
          {panelContent}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
