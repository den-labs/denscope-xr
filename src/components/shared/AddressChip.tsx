'use client'

import { getChain } from '@/config/chains'

export function AddressChip({ address, chainId }: { address: string; chainId?: number }) {
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`
  const chain = chainId ? getChain(chainId) : null
  const explorerUrl = chain ? `${chain.explorer}/address/${address}` : null

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-text-secondary">
      <span>{truncated}</span>
      <button
        onClick={() => navigator.clipboard.writeText(address)}
        className="text-text-muted hover:text-accent"
        title="Copy"
      >
        copy
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
