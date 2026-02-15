'use client'

import { useEffect, useState } from 'react'
import { fetchAgentEvents } from '@/lib/supabase/fetch-events'
import type { ScopeEvent } from '@/types/events'

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

function formatTime(timestamp?: number): string {
  if (!timestamp) return '--'
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatSummary(event: ScopeEvent): string {
  switch (event.kind) {
    case 'register':
      return 'Agent registered'
    case 'feedback': {
      const d = event.data as { clientAddress: string; value: bigint; tag1: string }
      const score = Number(d.value)
      const tag = d.tag1 ? ` [${d.tag1}]` : ''
      return `${score > 0 ? '+' : ''}${score} by ${String(d.clientAddress).slice(0, 8)}..${tag}`
    }
    case 'feedback_revoked':
      return 'Feedback revoked'
    case 'uri_update':
      return 'URI updated'
    case 'metadata':
      return 'Metadata set'
    case 'response':
      return 'Response submitted'
    case 'validation_req':
      return 'Validation requested'
    case 'validation_res':
      return 'Validation response'
    default:
      return event.kind
  }
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-3 w-16 bg-border rounded" />
          <div className="h-3 w-12 bg-border rounded" />
          <div className="h-3 flex-1 bg-border rounded" />
        </div>
      ))}
    </div>
  )
}

type Props = {
  chainId: number
  agentId: number
  explorerUrl: string
}

export function AgentEventTimeline({ chainId, agentId, explorerUrl }: Props) {
  const [events, setEvents] = useState<ScopeEvent[] | null>(null)

  useEffect(() => {
    fetchAgentEvents(chainId, agentId).then(setEvents)
  }, [chainId, agentId])

  return (
    <div className="bg-surface border border-border p-5">
      <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
        Event History
      </h2>

      {events === null ? (
        <Skeleton />
      ) : events.length === 0 ? (
        <p className="text-xs text-text-muted font-mono">No events recorded</p>
      ) : (
        <div className="space-y-0">
          {events.map((event, i) => (
            <div
              key={`${event.txHash}:${event.logIndex}`}
              className={`flex items-center gap-3 py-2 ${i < events.length - 1 ? 'border-b border-border' : ''}`}
            >
              {/* Timestamp */}
              <span className="shrink-0 text-[11px] font-mono text-text-muted w-28">
                {formatTime(event.timestamp)}
              </span>

              {/* Kind pill */}
              <span className={kindPillClass[event.kind] ?? 'status-pill status-pill-neutral'}>
                {kindLabels[event.kind] ?? event.kind.toUpperCase()}
              </span>

              {/* Summary */}
              <span className="flex-1 text-xs font-mono text-text-secondary truncate">
                {formatSummary(event)}
              </span>

              {/* Tx hash */}
              <a
                href={`${explorerUrl}/tx/${event.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[11px] font-mono text-text-muted hover:text-accent transition-colors"
              >
                {event.txHash.slice(0, 8)}...{event.txHash.slice(-4)}
              </a>

              {/* Block */}
              <span className="shrink-0 text-[10px] font-mono text-text-muted w-16 text-right">
                #{event.block.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
