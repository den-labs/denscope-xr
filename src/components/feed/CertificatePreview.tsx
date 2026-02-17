'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChainBadge } from '@/components/shared/ChainBadge'
import { useAgentStore } from '@/stores/agents'
import { buildXIntentUrl, buildCertificateShareText } from '@/lib/share'

type CertificatePreviewProps = {
  agentKey: string
  rect: DOMRect
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function CertificatePreview({ agentKey, rect, onMouseEnter, onMouseLeave }: CertificatePreviewProps) {
  const [mounted, setMounted] = useState(false)
  const agent = useAgentStore((s) => s.agents.get(agentKey))

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !agent) return null

  const name = agent.metadata?.name ?? `Agent #${agent.agentId}`
  const shareInput = { chainId: agent.chainId, agentId: agent.agentId, name: agent.metadata?.name }

  // Simple trust indicator from local feedback data
  const hasFeedback = agent.feedbackCount > 0
  const positiveRatio = hasFeedback
    ? Math.round((agent.positiveFeedback / agent.feedbackCount) * 100)
    : null

  // Position: right of the row
  const top = rect.top + rect.height / 2
  const left = rect.right + 8

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    window.open(buildXIntentUrl(buildCertificateShareText(shareInput)), '_blank')
  }

  const tooltip = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="fixed z-40 hidden md:block"
        style={{ top, left, transform: 'translateY(-50%)' }}
      >
        <div className="border border-border-bright bg-surface shadow-lg w-[220px] p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-text-primary font-bold truncate">
              {name}
            </span>
            <ChainBadge chainId={agent.chainId} />
          </div>

          {/* Trust indicator */}
          <div className="font-mono text-xs text-text-secondary">
            {positiveRatio !== null ? (
              <span>Positive feedback: <span className="text-text-primary">{positiveRatio}%</span> ({agent.feedbackCount})</span>
            ) : (
              <span className="text-text-muted">Awaiting data</span>
            )}
          </div>

          {/* Share Certificate — primary CTA */}
          <button
            onClick={handleShare}
            className="w-full border border-text-primary bg-text-primary px-3 py-1.5 text-xs font-mono font-bold text-bg hover:bg-transparent hover:text-text-primary transition-colors"
          >
            Share Certificate
          </button>

          {/* View Full Report — secondary */}
          <a
            href={`/agent/${agent.chainId}/${agent.agentId}`}
            className="block text-center font-mono text-[11px] text-text-muted hover:text-accent transition-colors"
          >
            View Full Report &rarr;
          </a>
        </div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(tooltip, document.body)
}
