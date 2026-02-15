import type { Metadata } from 'next'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'

type Props = { params: Promise<{ chain: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)
  if (!chainConfig) return { title: 'Agent Not Found — DenScope' }

  const uri = await readAgentURI(chainConfig, agentId)
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`

  return {
    title: `${name} — DenScope`,
    description: `ERC-8004 agent on ${chainConfig.name}`,
    openGraph: {
      title: `${name} — DenScope`,
      description: `ERC-8004 agent on ${chainConfig.name}`,
      images: [`/api/og/agent/${chain}/${id}`],
    },
  }
}

const KNOWN_PROTOCOLS = ['A2A', 'MCP', 'x402'] as const

export default async function AgentPage({ params }: Props) {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        Chain not found
      </div>
    )
  }

  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null

  const serviceTypes = new Set(
    metadata?.services?.map((s) => s.type.toUpperCase()) ?? []
  )

  return (
    <div className="bg-grid mx-auto max-w-6xl px-6 py-10">
      {/* Breadcrumb */}
      <nav className="font-mono text-xs text-text-muted uppercase tracking-wider">
        System / DenScope / Dossier
      </nav>

      {/* Title */}
      <h1 className="font-display text-3xl font-bold uppercase tracking-wider mt-4 text-text-primary">
        AGENT X-RAY
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        {metadata?.name ?? `Agent #${agentId}`} &mdash; {chainConfig.name}
      </p>

      {metadata?.description && (
        <p className="mt-3 text-sm text-text-secondary max-w-2xl">
          {metadata.description}
        </p>
      )}

      {/* 12-column grid */}
      <div className="grid grid-cols-12 gap-6 mt-8">
        {/* Left column: Identity Card */}
        <div className="col-span-4">
          <div className="bg-surface border border-border p-6 space-y-5">
            {/* Status badge */}
            <div className="flex items-center justify-between">
              <span className="status-pill status-pill-success">ACTIVE</span>
              <span className="font-mono text-xs text-text-muted">
                ERC-8004
              </span>
            </div>

            {/* Agent ID */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                Agent ID
              </p>
              <p className="font-display text-4xl font-bold text-text-primary mt-1">
                #{agentId}
              </p>
            </div>

            {/* Chain ID */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                Chain ID
              </p>
              <p className="font-mono text-sm text-text-secondary mt-0.5">
                {chainConfig.id}
              </p>
            </div>

            {/* Owner */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                Owner
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="font-mono text-xs text-text-secondary truncate">
                  {owner ?? 'unknown'}
                </p>
                <span className="text-text-muted text-xs shrink-0">copy</span>
              </div>
            </div>

            {/* URI */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
                Agent URI
              </p>
              {uri ? (
                <a
                  href={uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-accent break-all hover:underline mt-0.5 block"
                >
                  {uri}
                </a>
              ) : (
                <p className="font-mono text-xs text-text-secondary mt-0.5">
                  unknown
                </p>
              )}
            </div>

            {/* Storage Status */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">
                Storage
              </p>
              <span className="status-pill status-pill-accent">On-chain</span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-8 space-y-6">
          {/* Top row: two cards side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Connected Protocols */}
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
                Connected Protocols
              </h2>
              <div className="space-y-2">
                {KNOWN_PROTOCOLS.map((protocol) => {
                  const isConnected = serviceTypes.has(protocol)
                  return (
                    <div
                      key={protocol}
                      className="flex items-center justify-between"
                    >
                      <span className="font-mono text-sm text-text-primary">
                        {protocol}
                      </span>
                      <span
                        className={`status-pill ${
                          isConnected
                            ? 'status-pill-success'
                            : 'status-pill-neutral'
                        }`}
                      >
                        {isConnected ? 'CONNECTED' : 'INACTIVE'}
                      </span>
                    </div>
                  )
                })}
                {/* Additional services not in KNOWN_PROTOCOLS */}
                {metadata?.services
                  ?.filter(
                    (s) =>
                      !KNOWN_PROTOCOLS.includes(
                        s.type.toUpperCase() as (typeof KNOWN_PROTOCOLS)[number]
                      )
                  )
                  .map((s, i) => (
                    <div key={`extra-${i}`} className="flex items-center justify-between">
                      <span className="font-mono text-sm text-text-primary">
                        {s.type}
                        {s.version ? ` v${s.version}` : ''}
                      </span>
                      <span className="status-pill status-pill-success">
                        CONNECTED
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Reputation */}
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
                Reputation
              </h2>
              <p className="text-xs text-text-muted font-mono">
                No feedback yet
              </p>
            </div>
          </div>

          {/* Event Log — placeholder for future real event history */}
        </div>
      </div>

      {/* Footer links */}
      <div className="mt-8 flex items-center gap-6">
        <a
          href={`${chainConfig.explorer}/address/${chainConfig.contracts.identity}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent font-mono text-sm hover:underline"
        >
          View on {chainConfig.name} Explorer
        </a>
      </div>
    </div>
  )
}
