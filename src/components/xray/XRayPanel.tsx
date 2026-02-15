'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agents'
import { fetchAgentMetadata } from '@/lib/agent/metadata'
import { AgentIdentity } from './AgentIdentity'
import { AgentServices } from './AgentServices'
import type { AgentMetadata } from '@/types/agents'

type XRayPanelProps = { agentKey: string | null; onClose: () => void }

export function XRayPanel({ agentKey, onClose }: XRayPanelProps) {
  const agent = useAgentStore((s) => (agentKey ? s.agents.get(agentKey) : undefined))
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!agent?.agentURI) return
    setLoading(true)
    fetchAgentMetadata(agent.agentURI)
      .then(setMetadata)
      .finally(() => setLoading(false))
  }, [agent?.agentURI])

  const enriched = agent ? { ...agent, metadata: metadata ?? agent.metadata } : null

  return (
    <AnimatePresence>
      {agentKey && enriched && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 z-50 h-full w-96 border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-zinc-500 hover:text-white"
          >
            ✕
          </button>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-48 rounded bg-zinc-800" />
              <div className="h-4 w-64 rounded bg-zinc-800" />
            </div>
          ) : (
            <div className="space-y-6">
              <AgentIdentity agent={enriched} />
              <AgentServices metadata={enriched.metadata} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
