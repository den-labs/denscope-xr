'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { fetchAgentMetadata } from '@/lib/agent/metadata'
import {
  buildXIntentUrl,
  buildCertificateShareText,
  shareCertificate,
} from '@/lib/share'
import type { ShareCardStateKey } from '@/lib/trust/share-card-state'
import type { AgentMetadata, AgentSummary } from '@/types/agents'

const LS_KEY = 'denscope-station-open'

function readStationOpen(): boolean {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(LS_KEY)
  return v === null ? true : v === 'true'
}

function truncAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// ─── Types ───────────────────────────────────────────────────────
export type Layout = 'docked' | 'collapsible' | 'sheet'

type CertificateStationProps = {
  agentKey: string | null
  layout: Layout
  onClose?: () => void
}

// ─── Inner content (shared across layouts) ───────────────────────
function StationContent({
  agent,
  loading,
  error,
  onRetry,
}: {
  agent: AgentSummary | null
  loading: boolean
  error: boolean
  onRetry: () => void
}) {
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const [copyModalUrl, setCopyModalUrl] = useState<string | null>(null)

  if (!agent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-base font-bold text-text-primary">
          Select an agent to generate a Trust Certificate
        </p>
        <p className="mt-2 font-mono text-xs text-text-muted">
          Click any row in the feed.
        </p>
      </div>
    )
  }

  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`
  const shareInput = { chainId: agent.chainId, agentId: agent.agentId, name: agent.metadata?.name }
  const certUrl = `/api/certificate/${agent.chainId}/${agent.agentId}`

  async function handleShare() {
    try {
      // Get hash from certificate endpoint
      const res = await fetch(`${certUrl}?format=json`)
      if (!res.ok) return
      const data = await res.json()
      const hash = data.hash as string
      const state = (data.payload?.state ?? 'insufficient_signal') as ShareCardStateKey

      const result = await shareCertificate({
        hash,
        name: agent?.metadata?.name ?? null,
        state,
        lang: 'en',
      })

      if (result === 'copied') {
        setShareStatus('Link copied!')
        setTimeout(() => setShareStatus(null), 2000)
      } else if (result === 'modal') {
        const baseUrl = window.location.origin
        setCopyModalUrl(`${baseUrl}/verify/${hash}`)
      }
    } catch { /* share failed silently */ }
  }

  async function handleDownload() {
    try {
      const res = await fetch(certUrl)
      if (!res.ok) return
      const blob = await res.blob()
      const hash = res.headers.get('X-Certificate-Hash') ?? 'cert'
      const shortId = (agent?.agentId ?? 0).toString().slice(0, 6)
      const shortHash = hash.slice(0, 8)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `denscope-certificate-${shortId}-${shortHash}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* download failed silently */ }
  }

  function handleShareX() {
    window.open(buildXIntentUrl(buildCertificateShareText(shareInput)), '_blank')
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-20 space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-4 pt-2">
            <div className="h-32 w-full bg-surface" />
            <div className="h-4 w-48 bg-surface" />
          </div>
        ) : (
          <>
            {/* 2) Certificate Preview */}
            <div className="border border-border bg-surface overflow-hidden">
              <img
                src={certUrl}
                alt={`Trust Certificate for ${name}`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>

            {/* Description (max 2 lines) */}
            {agent.metadata?.description && (
              <p className="text-sm text-text-secondary line-clamp-2">
                {agent.metadata.description}
              </p>
            )}

            {/* Micro-data (1 line) */}
            <p className="font-mono text-[10px] text-text-muted truncate">
              Owner {truncAddr(agent.owner)} | +{agent.positiveFeedback} / -{agent.negativeFeedback} | Snapshot {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
            </p>

            {error && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-mono">Metadata unavailable</span>
                <button onClick={onRetry} className="text-xs text-accent font-mono hover:underline">Retry</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Copy modal fallback */}
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

      {/* 3) Action bar — sticky bottom */}
      <div className="sticky bottom-0 border-t border-border bg-bg px-5 py-3">
        {shareStatus && (
          <p className="text-xs text-accent font-mono text-center mb-2">{shareStatus}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareX}
            disabled={!agent}
            className="flex-1 bg-accent px-4 py-2.5 text-sm font-mono font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Share on X
          </button>
          <button
            onClick={handleShare}
            disabled={!agent}
            className="border border-border px-3 py-2.5 text-sm font-mono text-text-secondary hover:text-text-primary hover:border-border-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Share"
          >
            Share
          </button>
          <button
            onClick={handleDownload}
            disabled={!agent}
            className="border border-border px-3 py-2.5 text-sm text-text-muted hover:text-text-primary hover:border-text-primary transition-colors disabled:opacity-40"
            title="Download"
          >
            ⬇
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Rail handle (collapsed state) ───────────────────────────────
function RailHandle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-full w-10 flex-col items-center justify-center border-l border-border bg-bg hover:bg-surface transition-colors"
      aria-label="Open Certificate Station"
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted [writing-mode:vertical-rl] rotate-180">
        CERT
      </span>
    </button>
  )
}

// ─── Main component ──────────────────────────────────────────────
export function CertificateStation({ agentKey, layout, onClose }: CertificateStationProps) {
  const [isOpen, setIsOpen] = useState(true) // SSR-safe default; sync from localStorage in effect
  const agent = useAgentStore((s) => (agentKey ? s.agents.get(agentKey) : undefined))
  const cacheMetadata = useAgentStore((s) => s.cacheMetadata)
  const [metadata, setMetadata] = useState<AgentMetadata | null>(agent?.metadata ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Sync open/closed with localStorage
  useEffect(() => {
    // Read persisted value on mount
    const stored = localStorage.getItem(LS_KEY)
    if (stored !== null) setIsOpen(stored === 'true')
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEY, String(isOpen))
  }, [isOpen])

  // Reopen station when user selects a new agent (click row / inspect)
  useEffect(() => {
    if (agentKey) setIsOpen(true)
  }, [agentKey])

  // Fetch metadata
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

  const retry = useCallback(() => {
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
  }, [agent, agentKey, cacheMetadata])

  function handleClose() {
    if (layout === 'sheet') {
      onClose?.()
    } else {
      setIsOpen(false)
    }
  }

  function handleOpen() {
    setIsOpen(true)
  }

  // ── Header (shared) ──
  const agentUrl = agent ? `/agent/${agent.chainId}/${agent.agentId}` : null
  const header = (
    <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
        TRUST CERTIFICATE
      </span>
      <div className="flex items-center gap-3">
        {agentUrl && (
          <a
            href={agentUrl}
            className="font-mono text-xs text-accent hover:underline"
          >
            View Agent
          </a>
        )}
        <button onClick={handleClose} className="text-text-muted hover:text-text-primary text-xs" aria-label="Close station">
          ✕
        </button>
      </div>
    </div>
  )

  // ━━━ Layout A & B: Docked / Collapsible ━━━
  if (layout === 'docked' || layout === 'collapsible') {
    if (!isOpen) {
      return <RailHandle onClick={handleOpen} />
    }

    return (
      <div className="flex h-full w-[440px] shrink-0 flex-col border-l border-border bg-bg">
        {header}
        <StationContent agent={enriched ?? null} loading={loading} error={error} onRetry={retry} />
      </div>
    )
  }

  // ━━━ Layout C: Mobile bottom sheet ━━━
  return (
    <AnimatePresence>
      {agentKey && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60"
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose?.()
            }}
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-border bg-bg shadow-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2 shrink-0">
              <div className="h-1 w-10 rounded-full bg-border-bright" />
            </div>
            {header}
            <StationContent agent={enriched ?? null} loading={loading} error={error} onRetry={retry} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
