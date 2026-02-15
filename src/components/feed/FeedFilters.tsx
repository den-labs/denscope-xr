'use client'

import type { EventKind } from '@/types/events'
import type { FeedFilters } from '@/hooks/useFeedFilters'
import { chains } from '@/config/chains'

const ALL_KINDS: EventKind[] = [
  'register', 'uri_update', 'metadata',
  'feedback', 'feedback_revoked',
  'response', 'validation_req', 'validation_res',
]

const kindLabels: Record<EventKind, string> = {
  register: 'REGISTER',
  uri_update: 'URI_UPD',
  metadata: 'METADATA',
  feedback: 'FEEDBACK',
  feedback_revoked: 'REVOKE',
  response: 'RESPONSE',
  validation_req: 'VAL_REQ',
  validation_res: 'VAL_RES',
}

const kindPillClass: Record<EventKind, string> = {
  register: 'status-pill-success',
  feedback: 'status-pill-success',
  feedback_revoked: 'status-pill-critical',
  uri_update: 'status-pill-neutral',
  metadata: 'status-pill-neutral',
  response: 'status-pill-neutral',
  validation_req: 'status-pill-warning',
  validation_res: 'status-pill-warning',
}

type FeedFiltersBarProps = {
  filters: FeedFilters
  onChange: (filters: FeedFilters) => void
}

export function FeedFiltersBar({ filters, onChange }: FeedFiltersBarProps) {
  function toggleKind(kind: EventKind) {
    const next = new Set(filters.kinds)
    if (next.has(kind)) {
      next.delete(kind)
    } else {
      next.add(kind)
    }
    onChange({ ...filters, kinds: next })
  }

  function setChain(value: string) {
    onChange({ ...filters, chainId: value === '' ? null : Number(value) })
  }

  function setAgent(value: string) {
    onChange({ ...filters, agentId: value })
  }

  const hasActiveFilters = filters.kinds.size > 0 || filters.chainId !== null || filters.agentId !== ''

  return (
    <div className="border-b border-border bg-surface px-4 py-2 flex flex-wrap items-center gap-3">
      {/* Kind pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted mr-1">Kind</span>
        {ALL_KINDS.map((kind) => {
          const active = filters.kinds.has(kind)
          return (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              className={`status-pill cursor-pointer transition-opacity ${kindPillClass[kind]} ${
                active ? 'opacity-100 ring-1 ring-text-primary' : filters.kinds.size > 0 ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {kindLabels[kind]}
            </button>
          )
        })}
      </div>

      {/* Chain dropdown */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Chain</span>
        <select
          value={filters.chainId ?? ''}
          onChange={(e) => setChain(e.target.value)}
          className="bg-surface border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm focus:outline-none focus:ring-1 focus:ring-text-primary"
        >
          <option value="">All Chains</option>
          {chains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.badge.label}
            </option>
          ))}
        </select>
      </div>

      {/* Agent ID input */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">Agent</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="#"
          value={filters.agentId}
          onChange={(e) => setAgent(e.target.value.replace(/[^0-9]/g, ''))}
          className="bg-surface border border-border text-text-primary text-xs font-mono px-2 py-1 w-16 rounded-sm focus:outline-none focus:ring-1 focus:ring-text-primary placeholder:text-text-muted"
        />
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={() => onChange({ kinds: new Set(), chainId: null, agentId: '' })}
          className="text-[10px] font-mono uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors ml-auto"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
