'use client'

import { useState, useCallback, useEffect } from 'react'
import type { EventKind } from '@/types/events'

export type FeedFilters = {
  kinds: Set<EventKind>
  chainId: number | null
  agentId: string
}

const ALL_KINDS: EventKind[] = [
  'register', 'uri_update', 'metadata',
  'feedback', 'feedback_revoked',
  'response', 'validation_req', 'validation_res',
]

function parseFiltersFromURL(): FeedFilters {
  if (typeof window === 'undefined') {
    return { kinds: new Set(), chainId: null, agentId: '' }
  }
  const params = new URLSearchParams(window.location.search)

  const kindParam = params.get('kind')
  const kinds = new Set<EventKind>(
    kindParam
      ? (kindParam.split(',').filter((k) => ALL_KINDS.includes(k as EventKind)) as EventKind[])
      : []
  )

  const chainParam = params.get('chain')
  const chainRaw = chainParam ? Number(chainParam) : null
  const chainId = chainRaw != null && Number.isFinite(chainRaw) ? chainRaw : null

  const agentId = params.get('agent') ?? ''

  return { kinds, chainId, agentId }
}

function syncFiltersToURL(filters: FeedFilters) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()

  if (filters.kinds.size > 0) {
    params.set('kind', Array.from(filters.kinds).join(','))
  }
  if (filters.chainId !== null) {
    params.set('chain', String(filters.chainId))
  }
  if (filters.agentId !== '') {
    params.set('agent', filters.agentId)
  }

  const qs = params.toString()
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', url)
}

export function useFeedFilters() {
  const [filters, setFiltersRaw] = useState<FeedFilters>(() => parseFiltersFromURL())

  // Re-read URL on mount (handles SSR hydration mismatch)
  useEffect(() => {
    setFiltersRaw(parseFiltersFromURL())
  }, [])

  const setFilters = useCallback((next: FeedFilters) => {
    setFiltersRaw(next)
    syncFiltersToURL(next)
  }, [])

  return { filters, setFilters }
}
