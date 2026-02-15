import { ImageResponse } from 'next/og'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'

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
            background: '#000000',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555555',
            fontSize: 24,
            fontFamily: 'monospace',
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
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`
  const ownerTruncated = owner
    ? `${owner.slice(0, 6)}...${owner.slice(-4)}`
    : 'unknown'
  const services = metadata?.services?.map((s) => s.type.toUpperCase()) ?? []

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#000000',
          padding: '48px 60px',
          fontFamily: 'monospace',
          justifyContent: 'space-between',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 32,
                border: '1px solid #444',
                fontSize: 11,
                fontWeight: 'bold',
                color: '#ffffff',
              }}
            >
              DS
            </div>
            <span
              style={{
                color: '#0df2f2',
                fontSize: 14,
                fontWeight: 'bold',
                letterSpacing: 5,
                textTransform: 'uppercase',
              }}
            >
              DENSCOPE
            </span>
          </div>
          <span
            style={{
              color: chainConfig.badge.color,
              fontSize: 13,
              fontWeight: 'bold',
              letterSpacing: 3,
              textTransform: 'uppercase',
              border: `1px solid ${chainConfig.badge.color}`,
              padding: '4px 12px',
            }}
          >
            {chainConfig.badge.label}
          </span>
        </div>

        {/* Center: Agent identity */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: '#555555',
              letterSpacing: 4,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            ERC-8004 AGENT
          </span>
          <span
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              color: '#ffffff',
              letterSpacing: -1,
              lineHeight: 1,
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontSize: 28,
              color: '#555555',
              marginTop: 8,
            }}
          >
            #{agentId}
          </span>

          {/* Service badges */}
          {services.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              {services.map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 12,
                    color: s === 'X402' ? '#0df2f2' : '#34c759',
                    border: `1px solid ${s === 'X402' ? 'rgba(13,242,242,0.3)' : 'rgba(52,199,89,0.3)'}`,
                    padding: '3px 10px',
                    letterSpacing: 2,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#555555', letterSpacing: 3, textTransform: 'uppercase' }}>
              OWNER
            </span>
            <span style={{ fontSize: 14, color: '#888888' }}>
              {ownerTruncated}
            </span>
          </div>
          {metadata?.description && (
            <span
              style={{
                fontSize: 12,
                color: '#555555',
                maxWidth: 400,
                textAlign: 'right',
                lineHeight: 1.4,
              }}
            >
              {metadata.description.length > 100
                ? `${metadata.description.slice(0, 100)}...`
                : metadata.description}
            </span>
          )}
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
