'use client'

import type { ScopeEvent } from '@/types/events'
import { buildXIntentUrl, buildCertificateShareText } from '@/lib/share'

const kindPillClass: Record<string, string> = {
  register: 'status-pill status-pill-success',
  feedback: 'status-pill status-pill-success',
  feedback_revoked: 'status-pill status-pill-critical',
  uri_update: 'status-pill status-pill-neutral',
  metadata: 'status-pill status-pill-neutral',
  response: 'status-pill status-pill-neutral',
  validation_req: 'status-pill status-pill-warning',
  validation_res: 'status-pill status-pill-warning',
}

const kindLabels: Record<string, string> = {
  register: 'REGISTER',
  uri_update: 'URI_UPD',
  metadata: 'METADATA',
  feedback: 'FEEDBACK',
  feedback_revoked: 'REVOKE',
  response: 'RESPONSE',
  validation_req: 'VAL_REQ',
  validation_res: 'VAL_RES',
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '--:--:--'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
}

function formatSummary(event: ScopeEvent): string {
  switch (event.kind) {
    case 'register':
      return `Agent #${event.agentId} registered`
    case 'feedback': {
      const d = event.data as { clientAddress: string; value: bigint; tag1: string }
      const score = Number(d.value)
      const tag = d.tag1 ? ` [${d.tag1}]` : ''
      return `Agent #${event.agentId} <- ${score > 0 ? '+' : ''}${score} by ${String(d.clientAddress).slice(0, 8)}..${tag}`
    }
    case 'feedback_revoked':
      return `Feedback on Agent #${event.agentId} revoked`
    default:
      return `Agent #${event.agentId}`
  }
}

function formatTxHash(txHash?: string): string {
  if (!txHash) return '--'
  return `${txHash.slice(0, 8)}...${txHash.slice(-4)}`
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

type FeedLineProps = {
  event: ScopeEvent
  isSelected?: boolean
  onClick?: () => void
}

export function FeedLine({ event, isSelected, onClick }: FeedLineProps) {
  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    const url = buildXIntentUrl(
      buildCertificateShareText({ chainId: event.chainId, agentId: event.agentId })
    )
    window.open(url, '_blank')
  }

  return (
    <button
      onClick={onClick}
      className={`group w-full border-b border-border px-4 py-1.5 text-left font-mono text-sm transition-colors hover:bg-surface-hover cursor-pointer ${
        isSelected
          ? 'bg-surface-hover border-l-2 border-l-accent'
          : 'hover:border-l-2 hover:border-l-accent'
      }`}
    >
      {/* Desktop: full grid */}
      <div className="hidden md:grid grid-cols-[120px_100px_100px_1fr_120px_auto_auto] items-center gap-0">
        <span className="shrink-0 text-foreground-muted text-xs">
          {formatTime(event.timestamp)}
        </span>
        <span>
          <span className={kindPillClass[event.kind] ?? 'status-pill status-pill-neutral'}>
            {kindLabels[event.kind] ?? event.kind.toUpperCase()}
          </span>
        </span>
        <span className="text-foreground-secondary text-xs">ERC-8004</span>
        <span className="truncate text-foreground text-xs group-hover:text-interactive group-hover:underline transition-colors">
          {formatSummary(event)}
        </span>
        <span className="font-mono text-foreground-muted text-xs">
          {formatTxHash(event.txHash)}
        </span>
        <span
          role="button"
          tabIndex={-1}
          onClick={handleShare}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-foreground-muted hover:text-interactive px-2"
        >
          <ShareIcon />
        </span>
        <span className="text-[10px] tracking-wider uppercase border border-border px-2 py-0.5 text-foreground-muted group-hover:border-interactive group-hover:text-interactive transition-colors whitespace-nowrap">
          INSPECT
        </span>
      </div>

      {/* Mobile: compact 2-row layout */}
      <div className="md:hidden flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className={kindPillClass[event.kind] ?? 'status-pill status-pill-neutral'}>
            {kindLabels[event.kind] ?? event.kind.toUpperCase()}
          </span>
          <span className="truncate flex-1 text-foreground text-xs group-hover:text-interactive transition-colors">
            {formatSummary(event)}
          </span>
          <span
            role="button"
            tabIndex={-1}
            onClick={handleShare}
            className="text-foreground-muted hover:text-interactive shrink-0"
          >
            <ShareIcon />
          </span>
        </div>
        <div className="flex items-center justify-between text-foreground-muted text-[10px]">
          <span>{formatTime(event.timestamp)}</span>
          <span>{formatTxHash(event.txHash)}</span>
        </div>
      </div>
    </button>
  )
}
