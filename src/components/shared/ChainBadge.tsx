import { getChain } from '@/config/chains'

export function ChainBadge({ chainId }: { chainId: number }) {
  const chain = getChain(chainId)
  if (!chain) return null
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${chain.badge.color}20`, color: chain.badge.color }}
    >
      {chain.badge.label}
    </span>
  )
}
