import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'

export const revalidate = 60

type Props = { params: Promise<{ chain: string; id: string }> }

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default async function EmbedAgentCard({ params }: Props) {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface p-6">
        <div className="border border-border bg-background p-8 text-center">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">
            Agent not found
          </p>
        </div>
      </div>
    )
  }

  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null

  const services = metadata?.services?.map((s) => s.type.toUpperCase()) ?? []
  const name = metadata?.name ?? `Agent #${agentId}`
  const description = metadata?.description

  return (
    <div className="flex h-screen items-center justify-center p-2">
      <a
        href={`https://denscope.vercel.app/agent/${chainConfig.id}/${agentId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full max-w-[420px] border border-border bg-surface hover:border-border-bright transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            <span className="text-[11px] text-foreground-muted uppercase tracking-wider">
              ERC-8004
            </span>
          </div>
          <span className="text-[11px] text-foreground-muted uppercase tracking-wider">
            DenScope
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="font-display text-lg font-bold text-foreground leading-tight">
              Agent #{agentId}
              {metadata?.name ? ` — ${metadata.name}` : ''}
            </p>
            {description && (
              <p className="mt-1 font-sans text-xs text-foreground-secondary leading-relaxed line-clamp-2">
                {description}
              </p>
            )}
          </div>

          {/* Service pills */}
          {services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <span key={s} className="status-pill status-pill-accent">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <span className="font-mono text-[11px] text-foreground-secondary">
            {owner ? truncateAddress(owner) : 'unknown'}
          </span>
          <span className="text-[11px] text-foreground-secondary">
            Chain: {chainConfig.badge.label}
          </span>
        </div>
      </a>
    </div>
  )
}
