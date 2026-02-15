import type { Metadata } from 'next'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadata } from '@/lib/agent/metadata'

type Props = { params: Promise<{ chain: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)
  if (!chainConfig) return { title: 'Agent Not Found — DenScope' }

  const uri = await readAgentURI(chainConfig, agentId)
  const metadata = uri ? await fetchAgentMetadata(uri) : null
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

export default async function AgentPage({ params }: Props) {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Chain not found
      </div>
    )
  }

  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadata(uri) : null

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold text-white">
        {metadata?.name ?? `Agent #${agentId}`}
      </h1>
      <p className="mt-1 text-zinc-500">on {chainConfig.name}</p>
      {metadata?.description && (
        <p className="mt-4 text-zinc-400">{metadata.description}</p>
      )}
      <div className="mt-6 space-y-2 text-sm text-zinc-400">
        <p>
          Owner:{' '}
          <span className="font-mono text-zinc-300">{owner ?? 'unknown'}</span>
        </p>
        <p>
          URI:{' '}
          <span className="font-mono text-zinc-300 break-all">
            {uri ?? 'unknown'}
          </span>
        </p>
      </div>
      {metadata?.services && metadata.services.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-zinc-500">Services</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {metadata.services.map((s, i) => (
              <span
                key={i}
                className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
              >
                {s.type}
                {s.version ? ` v${s.version}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      <a
        href={`${chainConfig.explorer}/address/${chainConfig.contracts.identity}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block text-sm text-emerald-400 hover:underline"
      >
        View on {chainConfig.name} Explorer
      </a>
    </div>
  )
}
