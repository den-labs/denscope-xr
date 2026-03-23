import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

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

export async function GET() {
  const assets = await loadAssets()

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#151718',
          fontFamily: 'Inter',
          color: '#e8e8e6',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid lines */}
        <div style={{ position: 'absolute', top: 120, left: 0, width: '100%', height: 1, background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 510, left: 0, width: '100%', height: 1, background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 80, width: 1, height: '100%', background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 1120, width: 1, height: '100%', background: 'rgba(255,255,255,0.12)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 600, width: 1, height: '100%', background: 'rgba(255,255,255,0.12)', display: 'flex' }} />

        {/* Watermark */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 224, fontWeight: 900, letterSpacing: '-0.06em',
            color: 'rgba(255,255,255,0.04)', lineHeight: 0.8,
          }}>SCOPE</span>
        </div>

        {/* Content */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          width: '100%', height: '100%',
          padding: '48px 80px',
          justifyContent: 'space-between',
          position: 'relative',
        }}>

          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: '#2ebd56', display: 'flex' }} />
                <span style={{ fontSize: 12, color: '#9ca3af', letterSpacing: '0.1em', fontWeight: 400 }}>
                  ERC-8004
                </span>
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.1em' }}>
                TRUST LAYER FOR AUTONOMOUS AGENTS
              </span>
            </div>

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

          {/* Center hero */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              <img
                src={assets.logoSrc}
                width={56}
                height={56}
                style={{ filter: 'invert(1)' }}
              />
              <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.025em' }}>
                DENSCOPE
              </span>
            </div>

            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', fontWeight: 400, letterSpacing: '0.05em' }}>
              Real-time trust scores, signals, and reputation for ERC-8004 agents
            </span>
          </div>

          {/* Bottom bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{
                fontSize: 10, color: '#6b7280', letterSpacing: '0.1em', fontWeight: 400,
                borderBottom: '1px solid #1f2937', paddingBottom: 4, marginBottom: 4,
              }}>
                CHAINS
              </span>
              <span style={{ fontSize: 30, fontWeight: 700 }}>
                Celo
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.20)', padding: '12px 24px',
              background: '#1c1e20',
            }}>
              <span style={{ fontSize: 14, color: '#e8e8e6', fontWeight: 700 }}>
                denscope.vercel.app
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                fontSize: 10, color: '#6b7280', letterSpacing: '0.1em', fontWeight: 400,
                borderBottom: '1px solid #1f2937', paddingBottom: 4, marginBottom: 4,
              }}>
                FEATURES
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: '#000000', background: '#F0F0F0',
                  padding: '4px 12px',
                }}>
                  EXPLORER
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 400,
                  color: '#9ca3af',
                  border: '1px solid #374151',
                  padding: '4px 12px',
                }}>
                  CONSOLE
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 400,
                  color: '#9ca3af',
                  border: '1px solid #374151',
                  padding: '4px 12px',
                }}>
                  API
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=3600' },
      fonts: [
        { name: 'Inter', data: assets.interRegular, style: 'normal' as const, weight: 400 },
        { name: 'Inter', data: assets.interBlack, style: 'normal' as const, weight: 900 },
      ],
    },
  )
}
