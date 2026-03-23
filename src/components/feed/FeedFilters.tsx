'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [agentInput, setAgentInput] = useState(filters.agentId)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Sync external filter changes back to local input
  useEffect(() => {
    setAgentInput(filters.agentId)
  }, [filters.agentId])

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
    const cleaned = value.replace(/[^0-9]/g, '')
    setAgentInput(cleaned)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, agentId: cleaned })
    }, 300)
  }

  const hasActiveFilters = filters.kinds.size > 0 || filters.chainId !== null || filters.agentId !== ''

  return (
    <div className="border-b border-border bg-surface px-4 py-2 flex flex-wrap items-center gap-3">
      {/* Kind pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-foreground-muted mr-1">Kind</span>
        {ALL_KINDS.map((kind) => {
          const active = filters.kinds.has(kind)
          return (
            <button
              key={kind}
              onClick={() => toggleKind(kind)}
              className={`status-pill cursor-pointer transition-opacity ${kindPillClass[kind]} ${
                active ? 'opacity-100 ring-1 ring-ring' : filters.kinds.size > 0 ? 'opacity-40' : 'opacity-100'
              }`}
            >
              {kindLabels[kind]}
            </button>
          )
        })}
      </div>

      {/* Chain dropdown */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-foreground-muted">Chain</span>
        <select
          value={filters.chainId ?? ''}
          onChange={(e) => setChain(e.target.value)}
          className="bg-surface border border-border text-foreground text-xs font-mono px-2 py-1 rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
        <span className="text-[10px] font-mono uppercase tracking-widest text-foreground-muted">Agent</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="#"
          value={agentInput}
          onChange={(e) => setAgent(e.target.value)}
          className="bg-surface border border-border text-foreground text-xs font-mono px-2 py-1 w-16 rounded-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-foreground-muted"
        />
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={() => onChange({ kinds: new Set(), chainId: null, agentId: '' })}
          className="text-[10px] font-mono uppercase tracking-widest text-foreground-muted hover:text-foreground transition-colors ml-auto"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
