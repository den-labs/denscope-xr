'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { fetchAgentMetadata } from '@/lib/agent/metadata'
import { AgentIdentity } from './AgentIdentity'
import { AgentServices } from './AgentServices'
import { ShareButton } from './ShareButton'
import type { AgentMetadata } from '@/types/agents'

type XRayPanelProps = { agentKey: string | null; onClose: () => void }

export function XRayPanel({ agentKey, onClose }: XRayPanelProps) {
  const agent = useAgentStore((s) => (agentKey ? s.agents.get(agentKey) : undefined))
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!agent?.agentURI) return
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
      })
      .finally(() => setLoading(false))
  }, [agent?.agentURI])

  const enriched = agent ? { ...agent, metadata: metadata ?? agent.metadata } : null

  function retry() {
    if (!agent?.agentURI) return
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
      })
      .finally(() => setLoading(false))
  }

  return (
    <AnimatePresence>
      {agentKey && enriched && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 z-50 h-full w-96 border-l border-border bg-bg p-6 shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 bg-surface" />
              <div className="h-4 w-64 bg-surface" />
            </div>
          ) : (
            <div className="space-y-6">
              <AgentIdentity agent={enriched} />
              {error && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-mono">Metadata unavailable</span>
                  <button
                    onClick={retry}
                    className="text-xs text-accent font-mono hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              <AgentServices metadata={enriched.metadata} />
              <ShareButton agent={enriched} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
