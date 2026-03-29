'use client'

import { chains } from '@/config/chains'

type ChainSelectProps = {
  value: number | null
  onChange: (chainId: number | null) => void
  className?: string
}

export function ChainSelect({ value, onChange, className = '' }: ChainSelectProps) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`bg-surface border border-border px-2 py-1 font-mono text-xs text-text-primary ${className}`}
    >
      <option value="">All Chains</option>
      {chains.map((c) => (
        <option key={c.id} value={c.id}>{c.badge.label}</option>
      ))}
    </select>
  )
}
