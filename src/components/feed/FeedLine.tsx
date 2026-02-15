'use client'

import type { ScopeEvent } from '@/types/events'

const kindColors: Record<string, string> = {
  register: 'text-emerald-400', uri_update: 'text-sky-400', metadata: 'text-sky-400',
  feedback: 'text-blue-400', feedback_revoked: 'text-red-400',
  response: 'text-purple-400', validation_req: 'text-amber-400', validation_res: 'text-amber-400',
}

const kindLabels: Record<string, string> = {
  register: 'REGISTER', uri_update: 'URI_UPD', metadata: 'METADATA',
  feedback: 'FEEDBACK', feedback_revoked: 'REVOKE',
  response: 'RESPONSE', validation_req: 'VAL_REQ', validation_res: 'VAL_RES',
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '--:--:--'
  return new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
}

function formatSummary(event: ScopeEvent): string {
  switch (event.kind) {
    case 'register': return `Agent #${event.agentId} registered`
    case 'feedback': {
      const d = event.data as { clientAddress: string; value: bigint; tag1: string }
      const score = Number(d.value)
      const tag = d.tag1 ? ` [${d.tag1}]` : ''
      return `Agent #${event.agentId} <- ${score > 0 ? '+' : ''}${score} by ${String(d.clientAddress).slice(0, 8)}..${tag}`
    }
    case 'feedback_revoked': return `Feedback on Agent #${event.agentId} revoked`
    default: return `Agent #${event.agentId}`
  }
}

export function FeedLine({ event, onClick }: { event: ScopeEvent; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full gap-3 px-4 py-1 text-left font-mono text-sm transition-colors hover:bg-zinc-900"
    >
      <span className="shrink-0 text-zinc-600">{formatTime(event.timestamp)}</span>
      <span className={`shrink-0 w-20 font-semibold ${kindColors[event.kind] ?? 'text-zinc-400'}`}>
        {kindLabels[event.kind] ?? event.kind.toUpperCase()}
      </span>
      <span className="truncate text-zinc-300">{formatSummary(event)}</span>
    </button>
  )
}
