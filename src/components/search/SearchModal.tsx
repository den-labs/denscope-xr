'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { searchAgents } from '@/lib/supabase/search-agents'
import { SearchResult } from './SearchResult'
import type { AgentSummary } from '@/types/agents'

const MAX_RESULTS = 20

function getChainIdFromURL(): number | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const v = params.get('chain')
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

type SearchModalProps = {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [chainId, setChainId] = useState<number | null>(null)
  useEffect(() => {
    if (open) setChainId(getChainIdFromURL())
  }, [open])
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [remoteResults, setRemoteResults] = useState<AgentSummary[]>([])
  const [searching, setSearching] = useState(false)
  const agents = useAgentStore((s) => s.agents)

  const localResults = useMemo(() => {
    let all = Array.from(agents.values())
    if (chainId != null) all = all.filter((a) => a.chainId === chainId)
    if (!query.trim()) return all.slice(0, MAX_RESULTS)
    const q = query.toLowerCase()
    return all
      .filter(
        (a) =>
          a.agentId.toString().includes(q) ||
          a.metadata?.name?.toLowerCase().includes(q) ||
          a.owner.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS)
  }, [agents, query, chainId])

  // Fallback to Supabase when local search has no results
  useEffect(() => {
    const q = query.trim()
    if (!q || localResults.length > 0) {
      setRemoteResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await searchAgents(q, MAX_RESULTS, chainId)
      setRemoteResults(results)
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, localResults.length, chainId])

  const results = localResults.length > 0 ? localResults : remoteResults

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const navigate = useCallback(
    (index: number) => {
      const agent = results[index]
      if (!agent) return
      router.push(`/agent/${agent.chainId}/${agent.agentId}`)
      onClose()
    },
    [results, router, onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((i) => (i + 1) % results.length || 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((i) => (i - 1 + results.length) % results.length || 0)
          break
        case 'Enter':
          e.preventDefault()
          navigate(activeIndex)
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [results.length, activeIndex, navigate, onClose]
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden border border-border bg-bg shadow-2xl"
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <svg
                className="h-4 w-4 shrink-0 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search agents..."
                className="flex-1 bg-transparent font-mono text-sm text-text-primary placeholder:text-text-muted outline-none"
              />
              <kbd className="hidden shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:inline-block">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-xs text-text-muted">
                  {searching ? 'Searching...' : query.trim() ? 'No agents found' : 'Type to search'}
                </div>
              ) : (
                results.map((agent, i) => (
                  <SearchResult
                    key={`${agent.chainId}:${agent.agentId}`}
                    agent={agent}
                    active={i === activeIndex}
                    onSelect={() => navigate(i)}
                  />
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
