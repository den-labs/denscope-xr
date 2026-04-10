'use client'

import { useState } from 'react'
import { getChain } from '@/config/chains'

export function AddressChip({ address, chainId }: { address: string | null; chainId?: number }) {
  const [copied, setCopied] = useState(false)
  if (!address) return <span className="font-mono text-xs text-text-muted">Unknown</span>
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`
  const chain = chainId ? getChain(chainId) : null
  const explorerUrl = chain ? `${chain.explorer}/address/${address}` : null

  function handleCopy() {
    navigator.clipboard.writeText(address!)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-text-secondary">
      <span>{truncated}</span>
      <button
        onClick={handleCopy}
        className="text-text-muted hover:text-accent transition-colors"
        title="Copy"
      >
        {copied ? 'copied!' : 'copy'}
      </button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-accent"
        >
          ↗
        </a>
      )}
    </span>
  )
}
