import { ImageResponse } from 'next/og'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadata } from '@/lib/agent/metadata'

type Props = { params: Promise<{ chain: string; id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { chain, id } = await params
  const chainConfig = getChain(Number(chain))
  const agentId = Number(id)

  if (!chainConfig) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            background: '#09090b',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#71717a',
            fontSize: 24,
          }}
        >
          Agent not found
        </div>
      ),
      { width: 1200, height: 630 },
    )
  }

  const [owner, uri] = await Promise.all([
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadata(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`
  const ownerTruncated = owner
    ? `${owner.slice(0, 6)}...${owner.slice(-4)}`
    : 'unknown'

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
          padding: '60px',
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{ color: '#34d399', fontSize: '24px', fontWeight: 'bold' }}
            >
              DenScope
            </span>
            <span style={{ color: '#52525b', fontSize: '16px', marginTop: '4px' }}>
              ERC-8004 Agent Explorer
            </span>
          </div>
          <span
            style={{
              background: `${chainConfig.badge.color}20`,
              color: chainConfig.badge.color,
              padding: '6px 16px',
              borderRadius: '999px',
              fontSize: '16px',
            }}
          >
            {chainConfig.badge.label}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '80px',
            flex: 1,
          }}
        >
          <span
            style={{ color: '#fafafa', fontSize: '48px', fontWeight: 'bold' }}
          >
            {name}
          </span>
          {metadata?.description && (
            <span
              style={{
                color: '#a1a1aa',
                fontSize: '20px',
                marginTop: '12px',
                maxWidth: '800px',
              }}
            >
              {metadata.description.slice(0, 120)}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '32px',
            color: '#71717a',
            fontSize: '18px',
          }}
        >
          <span>Owner: {ownerTruncated}</span>
          {metadata?.services && metadata.services.length > 0 && (
            <span>
              Services: {metadata.services.map((s) => s.type).join(', ')}
            </span>
          )}
          {metadata?.x402 && <span style={{ color: '#34d399' }}>x402 enabled</span>}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=300' },
    },
  )
}
