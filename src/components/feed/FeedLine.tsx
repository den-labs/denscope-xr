'use client'

import type { ScopeEvent } from '@/types/events'

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

export function FeedLine({ event, onClick }: { event: ScopeEvent; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid w-full grid-cols-[120px_100px_100px_1fr_120px_40px] items-center gap-0 border-b border-border px-4 py-1.5 text-left font-mono text-sm transition-colors hover:bg-surface-hover"
    >
      {/* Timestamp */}
      <span className="shrink-0 text-text-muted text-xs">
        {formatTime(event.timestamp)}
      </span>

      {/* Event Type Pill */}
      <span>
        <span className={kindPillClass[event.kind] ?? 'status-pill status-pill-neutral'}>
          {kindLabels[event.kind] ?? event.kind.toUpperCase()}
        </span>
      </span>

      {/* Protocol */}
      <span className="text-text-secondary text-xs">
        ERC-8004
      </span>

      {/* Agent Identity */}
      <span className="truncate text-text-primary text-xs">
        {formatSummary(event)}
      </span>

      {/* Tx Hash */}
      <span className="font-mono text-text-muted text-xs">
        {formatTxHash(event.txHash)}
      </span>

      {/* Arrow button */}
      <span className="text-text-muted text-xs text-right hover:text-text-primary transition-colors">
        &rarr;
      </span>
    </button>
  )
}
