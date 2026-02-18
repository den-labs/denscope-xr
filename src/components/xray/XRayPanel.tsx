'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { fetchAgentMetadata } from '@/lib/agent/metadata'
import { ChainBadge } from '@/components/shared/ChainBadge'
import { AgentIdentity } from './AgentIdentity'
import { AgentServices } from './AgentServices'
import {
  buildXIntentUrl,
  buildCertificateShareText,
  buildOwnerShareText,
} from '@/lib/share'
import type { AgentMetadata } from '@/types/agents'

type XRayPanelProps = { agentKey: string | null; onClose: () => void; isDocked?: boolean }

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function XRayPanel({ agentKey, onClose, isDocked }: XRayPanelProps) {
  const agent = useAgentStore((s) => (agentKey ? s.agents.get(agentKey) : undefined))
  const cacheMetadata = useAgentStore((s) => s.cacheMetadata)
  const [metadata, setMetadata] = useState<AgentMetadata | null>(agent?.metadata ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)

  useEffect(() => {
    if (!agent?.agentURI) return
    if (agent.metadata) {
      setMetadata(agent.metadata)
      return
    }
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
        if (result && agentKey) cacheMetadata(agentKey, result)
      })
      .finally(() => setLoading(false))
  }, [agent?.agentURI, agent?.metadata, agentKey, cacheMetadata])

  const enriched = agent ? { ...agent, metadata: metadata ?? agent.metadata } : null

  function retry() {
    if (!agent?.agentURI) return
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
        if (result && agentKey) cacheMetadata(agentKey, result)
      })
      .finally(() => setLoading(false))
  }

  const name = enriched?.metadata?.name ?? (enriched ? `Agent #${enriched.agentId}` : '')
  const shareInput = enriched
    ? { chainId: enriched.chainId, agentId: enriched.agentId, name: enriched.metadata?.name }
    : null

  function handleShare() {
    if (!shareInput) return
    window.open(buildXIntentUrl(buildCertificateShareText(shareInput)), '_blank')
  }

  function toggleShareMenu() {
    setShareMenuOpen(!shareMenuOpen)
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
        Share Certificate
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
              {enriched.metadata?.description && (
                <p className="text-sm text-text-secondary line-clamp-2">
                  {enriched.metadata.description}
                </p>
              )}
              <div className="font-mono text-xs text-text-secondary">
                {enriched.feedbackCount > 0 ? (
                  <span>
                    Positive: <span className="text-success">{Math.round((enriched.positiveFeedback / enriched.feedbackCount) * 100)}%</span>
                    {' '}({enriched.feedbackCount} total)
                  </span>
                ) : (
                  <span className="text-text-muted">Awaiting feedback</span>
                )}
              </div>
            </div>

            {/* Primary CTA — Share Certificate (direct X intent) */}
            <button
              onClick={handleShare}
              className="w-full border border-text-primary bg-text-primary px-4 py-3 text-sm font-mono font-bold text-bg hover:bg-transparent hover:text-text-primary transition-colors"
            >
              Share Certificate
            </button>

            {/* Owner share option */}
            <div className="relative">
              <button
                onClick={toggleShareMenu}
                className="w-full text-center font-mono text-[11px] text-text-muted hover:text-text-secondary transition-colors"
              >
                More share options...
              </button>
              {shareMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 flex flex-col border border-border-bright bg-surface shadow-lg">
                  <a
                    href={buildXIntentUrl(buildOwnerShareText(shareInput))}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShareMenuOpen(false)}
                    className="px-4 py-2.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors text-left"
                  >
                    I Own This Agent
                  </a>
                </div>
              )}
            </div>

            {/* Secondary CTA */}
            <a
              href={`/agent/${enriched.chainId}/${enriched.agentId}`}
              className="block text-center font-mono text-xs text-text-muted hover:text-accent transition-colors"
            >
              View Full Report &rarr;
            </a>

            {/* Micro-data (1 line) */}
            <p className="font-mono text-[10px] text-text-muted truncate">
              Owner {truncateAddress(enriched.owner)} | +{enriched.positiveFeedback} / -{enriched.negativeFeedback} | Snapshot {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
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
        {enriched ? certificateContent : emptyContent}
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
          {enriched ? certificateContent : emptyContent}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
