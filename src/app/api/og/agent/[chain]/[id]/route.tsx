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
          border: '1px solid #1a1a1a',
        }}
      >
        {/* Massive watermark */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            height: '0px',
            overflow: 'visible',
            marginTop: '80px',
          }}
        >
          <span
            style={{
              fontSize: 180,
              fontWeight: 'bold',
              color: 'rgba(255,255,255,0.04)',
              letterSpacing: 40,
            }}
          >
            AGENT
          </span>
        </div>

        {/* Top section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Left: system status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                background: '#34c759',
              }}
            />
            <span
              style={{
                color: '#888888',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 4,
              }}
            >
              SYSTEM ONLINE
            </span>
          </div>

          {/* Right: DENSCOPE */}
          <span
            style={{
              color: '#0df2f2',
              fontSize: 14,
              fontWeight: 'bold',
              letterSpacing: 6,
              textTransform: 'uppercase',
            }}
          >
            DENSCOPE
          </span>
        </div>

        {/* Center section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: '#ffffff',
              letterSpacing: 2,
            }}
          >
            #{agentId}
          </span>
          <span
            style={{
              fontSize: 24,
              color: '#888888',
              marginTop: 8,
            }}
          >
            {name}
          </span>

          {/* Trust Score bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 300,
                height: 6,
                background: '#222222',
                borderRadius: 0,
              }}
            >
              <div
                style={{
                  width: '80%',
                  height: '100%',
                  background: '#0df2f2',
                  borderRadius: 0,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                color: '#555555',
                marginTop: 6,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              TRUST SCORE
            </span>
          </div>
        </div>

        {/* Bottom section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 40,
          }}
        >
          {/* Left group: Owner + Chain badge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                color: '#888888',
                fontSize: 14,
                fontFamily: 'monospace',
              }}
            >
              {ownerTruncated}
            </span>
            <span
              style={{
                color: chainConfig.badge.color,
                fontSize: 13,
                fontWeight: 'bold',
              }}
            >
              {chainConfig.badge.label}
            </span>
          </div>

          {/* Middle: Services */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {metadata?.services && metadata.services.length > 0 ? (
              metadata.services.map((s, i) => (
                <span
                  key={i}
                  style={{
                    color: '#555555',
                    fontSize: 12,
                  }}
                >
                  {s.type}
                </span>
              ))
            ) : (
              <span style={{ color: '#555555', fontSize: 12 }}>
                No services
              </span>
            )}
            {metadata?.x402 && (
              <span style={{ color: '#0df2f2', fontSize: 12 }}>
                x402
              </span>
            )}
          </div>

          {/* Right: Status legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: '#34c759',
                }}
              />
              <span style={{ fontSize: 11, color: '#555555' }}>Optimal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: '#ffcc00',
                }}
              />
              <span style={{ fontSize: 11, color: '#555555' }}>Warning</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: '#ff3b30',
                }}
              />
              <span style={{ fontSize: 11, color: '#555555' }}>Critical</span>
            </div>
          </div>
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
