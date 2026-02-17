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
  const cacheMetadata = useAgentStore((s) => s.cacheMetadata)
  const [metadata, setMetadata] = useState<AgentMetadata | null>(agent?.metadata ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!agent?.agentURI) return
    if (agent.metadata) {
      setMetadata(agent.metadata)
      return
    }
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
        if (result && agentKey) cacheMetadata(agentKey, result)
      })
      .finally(() => setLoading(false))
  }, [agent?.agentURI, agent?.metadata, agentKey, cacheMetadata])

  const enriched = agent ? { ...agent, metadata: metadata ?? agent.metadata } : null

  function retry() {
    if (!agent?.agentURI) return
    setLoading(true)
    setError(false)
    fetchAgentMetadata(agent.agentURI)
      .then((result) => {
        if (!result && agent.agentURI) setError(true)
        setMetadata(result)
        if (result && agentKey) cacheMetadata(agentKey, result)
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
          className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col border-l border-border bg-bg shadow-2xl"
        >
          <div className="flex items-center justify-end p-4 pb-0">
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          </div>
          {loading ? (
            <div className="animate-pulse space-y-4 p-6">
              <div className="h-6 w-48 bg-surface" />
              <div className="h-4 w-64 bg-surface" />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">TRUST CERTIFICATE</p>
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
              </div>
              <div className="border-t border-border px-6 py-4">
                <ShareButton agent={enriched} />
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
