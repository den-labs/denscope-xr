import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'

type Props = { params: Promise<{ chain: string; id: string }> }

async function loadAssets() {
  const [interRegular, interBlack, wolfcilloRaw, logoRaw] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Inter-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-Black.ttf')),
    readFile(join(process.cwd(), 'design/wolfcillo.png')),
    readFile(join(process.cwd(), 'design/denscope-log.png')),
  ])
  const wolfcilloSrc = `data:image/png;base64,${Buffer.from(wolfcilloRaw).toString('base64')}`
  const logoSrc = `data:image/png;base64,${Buffer.from(logoRaw).toString('base64')}`
  return { interRegular, interBlack, wolfcilloSrc, logoSrc }
}

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
            background: '#050505',
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555555',
            fontSize: 24,
            fontFamily: 'Inter',
          }}
        >
          Agent not found
        </div>
      ),
      { width: 1200, height: 630 },
    )
  }

  const [assets, owner, uri] = await Promise.all([
    loadAssets(),
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
  ])
  const metadata = uri ? await fetchAgentMetadataServer(uri) : null
  const name = metadata?.name ?? `Agent #${agentId}`
  const ownerTruncated = owner
    ? `${owner.slice(0, 6)}...${owner.slice(-4)}`
    : 'unknown'
  const services = metadata?.services
    ?.map((s) => s.type?.toUpperCase())
    .filter(Boolean) ?? []
  const description = metadata?.description
    ? metadata.description.length > 80
      ? `${metadata.description.slice(0, 80)}...`
      : metadata.description
    : null

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#050505',
          fontFamily: 'Inter',
          color: '#F0F0F0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── Grid lines (5 lines from reference) ── */}
        <div style={{ position: 'absolute', top: 120, left: 0, width: '100%', height: 1, background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 510, left: 0, width: '100%', height: 1, background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 80, width: 1, height: '100%', background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 1120, width: 1, height: '100%', background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 600, width: 1, height: '100%', background: 'rgba(255,255,255,0.12)', display: 'flex' }} />

        {/* ── AGENT watermark (14rem=224px, opacity 8%) ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 224, fontWeight: 900, letterSpacing: '-0.06em',
            color: 'rgba(255,255,255,0.07)', lineHeight: 0.8,
          }}>AGENT</span>
        </div>

        {/* ── Content layer (px-20=80px, py-12=48px) ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          width: '100%', height: '100%',
          padding: '48px 80px',
          justifyContent: 'space-between',
          position: 'relative',
        }}>

          {/* ═══ TOP BAR ═══ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            {/* Left: status + protocol */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#22C55E', display: 'flex' }} />
                <span style={{ fontSize: 12, color: '#9ca3af', letterSpacing: '0.1em', fontWeight: 400 }}>
                  ERC-8004
                </span>
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.1em' }}>
                PROTOCOL: {chainConfig.badge.label.toUpperCase()}
              </span>
            </div>

            {/* Right: DENSCOPE branding + wolfcillo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img
                    src={assets.logoSrc}
                    width={24}
                    height={24}
                    style={{ filter: 'invert(1)' }}
                  />
                  <span style={{
                    fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}>
                    DENSCOPE
                  </span>
                </div>
                <span style={{
                  fontSize: 10, color: '#6b7280',
                  letterSpacing: '0.2em', marginTop: 4,
                }}>
                  BY DENLABS
                </span>
              </div>
              <img
                src={assets.wolfcilloSrc}
                width={70}
                height={40}
                style={{ borderRadius: 6 }}
              />
            </div>
          </div>

          {/* ═══ CENTER HERO (absolute centered) ═══ */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {/* ID row: horizontal flex, baseline-aligned */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 24, color: '#6b7280', fontWeight: 400 }}>
                ID
              </span>
              <span style={{ fontSize: 96, fontWeight: 900, letterSpacing: '-0.025em' }}>
                #{agentId}
              </span>
            </div>

            {/* Agent name */}
            <span style={{ fontSize: 18, color: '#F0F0F0', letterSpacing: '0.05em', fontWeight: 400 }}>
              {name}
            </span>

            {/* Description (if available) */}
            {description && (
              <span style={{
                fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 400,
                marginTop: 12, maxWidth: 500, textAlign: 'center',
                lineHeight: 1.5,
              }}>
                {description}
              </span>
            )}
          </div>

          {/* ═══ BOTTOM BAR (3-col via flexbox) ═══ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>

            {/* Left column: REGISTERED BY */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{
                fontSize: 10, color: '#6b7280', letterSpacing: '0.1em', fontWeight: 400,
                borderBottom: '1px solid #1f2937', paddingBottom: 4, marginBottom: 4,
              }}>
                REGISTERED BY
              </span>
              <span style={{ fontSize: 30, fontWeight: 700 }}>
                {ownerTruncated}
              </span>
            </div>

            {/* Center: Chain info box */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.20)', padding: '12px 24px',
              background: '#000000',
            }}>
              <span style={{ fontSize: 14, color: '#d1d5db', fontWeight: 400 }}>
                Chain:{' '}
              </span>
              <span style={{ fontSize: 14, color: '#F0F0F0', fontWeight: 700 }}>
                {chainConfig.badge.label}
              </span>
            </div>

            {/* Right column: PROTOCOLS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                fontSize: 10, color: '#6b7280', letterSpacing: '0.1em', fontWeight: 400,
                borderBottom: '1px solid #1f2937', paddingBottom: 4, marginBottom: 4,
              }}>
                PROTOCOLS
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 280 }}>
                {services.length > 0 ? (
                  services.map((s, i) => (
                    <span
                      key={i}
                      style={i === 0 ? {
                        fontSize: 12, fontWeight: 700,
                        color: '#000000', background: '#F0F0F0',
                        padding: '4px 12px',
                      } : {
                        fontSize: 12, fontWeight: 400,
                        color: '#9ca3af',
                        border: '1px solid #374151',
                        padding: '4px 12px',
                      }}
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span style={{
                    fontSize: 12, color: '#374151', fontWeight: 400,
                    border: '1px solid #1f2937', padding: '4px 12px',
                  }}>
                    —
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=300' },
      fonts: [
        { name: 'Inter', data: assets.interRegular, style: 'normal' as const, weight: 400 },
        { name: 'Inter', data: assets.interBlack, style: 'normal' as const, weight: 900 },
      ],
    },
  )
}
