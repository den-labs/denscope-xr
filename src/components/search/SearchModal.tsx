'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { SearchResult } from './SearchResult'

const MAX_RESULTS = 20

type SearchModalProps = {
  open: boolean
  onClose: () => void
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const agents = useAgentStore((s) => s.agents)

  const results = useMemo(() => {
    const all = Array.from(agents.values())
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
  }, [agents, query])

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
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden border border-border bg-background shadow-2xl"
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <svg
                className="h-4 w-4 shrink-0 text-foreground-muted"
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
                className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-foreground-muted outline-none"
              />
              <kbd className="hidden shrink-0 border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground-muted sm:inline-block">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-foreground-muted">
                  No agents found
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
