import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { toTrustScore } from '@/types/trust-score'
import { getShareCardState } from '@/lib/trust/share-card-state'
import {
  normalizeCertificatePayload,
  generateCertificateHash,
  truncateHash,
  certificatePalettes,
  getAppBaseUrl,
} from '@/lib/trust/certificate'
import { getCertificateLabels, type CertificateLang } from '@/lib/trust/certificate-i18n'
import { generateQRMatrix, qrMatrixToRects } from '@/lib/trust/qr'
import {
  findSnapshotByHash,
  insertSnapshot,
  updateImageKey,
} from '@/lib/supabase/certificate-snapshots'

type Props = { params: Promise<{ chain: string; id: string }> }

async function loadFonts() {
  const [interRegular, interBlack] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Inter-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-Black.ttf')),
  ])
  return { interRegular, interBlack }
}

function formatTimestamp(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const d = date.getUTCDate()
  const mon = months[date.getUTCMonth()]
  const y = date.getUTCFullYear()
  const h = String(date.getUTCHours()).padStart(2, '0')
  const m = String(date.getUTCMinutes()).padStart(2, '0')
  return `${d} ${mon} ${y}, ${h}:${m} UTC`
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function truncateName(name: string, max = 32): string {
  if (name.length <= max) return name
  return `${name.slice(0, max - 1)}…`
}

export async function GET(req: Request, { params }: Props) {
  const { chain, id } = await params
  const chainId = Number(chain)
  const agentId = Number(id)

  // Validate agentId
  if (!Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 })
  }

  const chainConfig = getChain(chainId)
  if (!chainConfig) {
    return NextResponse.json({ error: 'Unknown chain' }, { status: 400 })
  }

  const url = new URL(req.url)
  const lang = (url.searchParams.get('lang') === 'es' ? 'es' : 'en') as CertificateLang
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'png'

  // Fetch trust data
  let trustScore = null
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data } = await supabaseAdmin
        .from('trust_scores')
        .select('*')
        .eq('chain_id', chainId)
        .eq('agent_id', agentId)
        .maybeSingle()
      trustScore = data ? toTrustScore(data) : null
    }
  } catch { /* trust score unavailable — proceed with null */ }

  // Fetch agent metadata
  let ownerAddress: string | null = null
  let agentName: string | null = null
  try {
    const [owner, uri] = await Promise.all([
      readAgentOwner(chainConfig, agentId),
      readAgentURI(chainConfig, agentId),
    ])
    ownerAddress = owner
    if (uri) {
      const metadata = await fetchAgentMetadataServer(uri)
      agentName = metadata?.name ?? null
    }
  } catch { /* metadata unavailable */ }

  // Build & normalize payload
  const cardState = getShareCardState(trustScore)
  const payload = normalizeCertificatePayload({
    agentId,
    chainId,
    chainName: chainConfig.name,
    name: agentName,
    controller: ownerAddress,
    score: trustScore?.score ?? 0,
    state: cardState.key,
    signalCount: trustScore?.feedbackCount ?? 0,
    positiveCount: trustScore?.positiveCount ?? 0,
    negativeCount: trustScore?.negativeCount ?? 0,
  })

  const hash = await generateCertificateHash(payload)

  // Check for existing snapshot
  const existing = await findSnapshotByHash(hash)

  if (format === 'json') {
    const row = existing ?? await insertSnapshot(hash, chainId, agentId, payload)
    return NextResponse.json(
      { hash, payload, issuedAt: row.issued_at },
      { headers: { 'X-Certificate-Hash': hash, 'Cache-Control': 'public, max-age=300' } },
    )
  }

  // If existing snapshot has stored image for this lang, serve from storage
  const langSuffix = lang === 'es' ? '_es' : ''
  const expectedImageKey = `${chainId}/${agentId}/${hash}${langSuffix}.png`
  if (existing?.image_key === expectedImageKey) {
    try {
      const { data } = supabaseAdmin.storage
        .from('certificates')
        .getPublicUrl(existing.image_key)
      if (data?.publicUrl) {
        const imgRes = await fetch(data.publicUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          return new Response(imgBuffer, {
            headers: {
              'Content-Type': 'image/png',
              'X-Certificate-Hash': hash,
              'Cache-Control': 'public, max-age=300',
            },
          })
        }
      }
    } catch { /* storage read failed, fall through to render */ }
  }

  // Render certificate PNG
  const labels = getCertificateLabels(lang)
  const palette = certificatePalettes[payload.state]
  const baseUrl = getAppBaseUrl()
  const verifyUrl = `${baseUrl}/verify/${hash}`
  const displayHash = truncateHash(hash)
  const displayName = payload.name ? truncateName(payload.name) : labels.unnamedAgent
  const displayController = payload.controller
    ? truncateAddress(payload.controller)
    : labels.noController
  const displayAgentId = truncateAddress(`0x${agentId.toString(16).padStart(8, '0')}`)
  const stateLabel = labels.stateLabels[payload.state]
  const now = formatTimestamp(new Date())

  // QR code
  let qrRects: Array<{ x: number; y: number; w: number; h: number }> = []
  try {
    const matrix = generateQRMatrix(verifyUrl)
    qrRects = qrMatrixToRects(matrix, 48, 4, 4)
  } catch { /* QR failed — will use fallback */ }

  const fonts = await loadFonts()

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: '#FAFAFA',
          fontFamily: 'Inter',
          color: '#111827',
        }}
      >
        {/* ═══ TITLE BAR ═══ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: palette.titleBar,
            color: '#FFFFFF',
            padding: '24px 40px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.05em' }}>
              {labels.title.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 10px',
                borderRadius: 4,
                letterSpacing: '0.1em',
              }}
            >
              ERC-8004
            </span>
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
            {chainConfig.name} · {now}
          </span>
        </div>

        {/* ═══ BODY ═══ */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            padding: '32px 40px',
            gap: 40,
            alignItems: 'center',
          }}
        >
          {/* Left: Seal */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 160,
              height: 160,
              borderRadius: '50%',
              border: `4px ${palette.sealDashed ? 'dashed' : 'solid'} ${palette.sealBorder}`,
              background: palette.sealFill,
              flexShrink: 0,
            }}
          >
            {payload.state === 'insufficient_signal' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#9CA3AF', letterSpacing: '0.05em' }}>
                  {labels.insufficientSealLines[0]}
                </span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#9CA3AF', letterSpacing: '0.05em' }}>
                  {labels.insufficientSealLines[1]}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {/* Seal icon placeholder — simple shapes */}
                {payload.state === 'trustworthy' && (
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <path d="M20 2 L36 12 V26 C36 34 20 38 20 38 C20 38 4 34 4 26 V12 Z" fill="rgba(255,255,255,0.3)" />
                    <path d="M13 20 L18 25 L28 15" stroke="white" strokeWidth="3" fill="none" />
                  </svg>
                )}
                {payload.state === 'monitoring' && (
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
                    <circle cx="20" cy="20" r="4" fill="white" />
                    <path d="M20 6 V12" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                    <path d="M34 20 H28" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                  </svg>
                )}
                {payload.state === 'high_risk' && (
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    <path d="M20 4 L38 36 H2 Z" fill="rgba(255,255,255,0.3)" />
                    <path d="M20 16 V26" stroke="white" strokeWidth="3" />
                    <circle cx="20" cy="31" r="2" fill="white" />
                  </svg>
                )}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: '#FFFFFF',
                    letterSpacing: '0.05em',
                    marginTop: payload.state === 'high_risk' ? -2 : 2,
                  }}
                >
                  {stateLabel}
                </span>
              </div>
            )}
          </div>

          {/* Right: Agent info + score */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 8 }}>
            <span style={{ fontSize: 16, color: '#6B7280', fontFamily: 'monospace' }}>
              {displayAgentId}
            </span>
            <span
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: payload.name ? '#111827' : '#9CA3AF',
                fontStyle: payload.name ? 'normal' : 'italic',
              }}
            >
              {displayName}
            </span>

            {/* Divider */}
            <div style={{ display: 'flex', width: '100%', height: 1, background: '#E5E7EB', margin: '8px 0' }} />

            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 14, color: '#6B7280' }}>{labels.trustScore}</span>
              <span style={{ fontSize: 36, fontWeight: 900 }}>{payload.score}</span>
              <span style={{ fontSize: 18, color: '#9CA3AF' }}>/ 100</span>
            </div>

            {/* Score bar */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: 12,
                background: '#E5E7EB',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: `${Math.max(2, payload.score)}%`,
                  height: '100%',
                  background: palette.sealFill === 'transparent' ? '#6B7280' : palette.sealFill,
                  borderRadius: 6,
                }}
              />
            </div>

            {/* Signals */}
            <span style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
              {labels.signals}: {payload.signalCount} (+{payload.positiveCount} · -{payload.negativeCount})
            </span>
          </div>
        </div>

        {/* ═══ CREDENTIAL BAR ═══ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#F3F4F6',
            borderTop: '1px solid #E5E7EB',
            padding: '12px 40px',
            gap: 16,
          }}
        >
          {/* QR Code */}
          <div
            style={{
              display: 'flex',
              width: 56,
              height: 56,
              background: qrRects.length > 0 ? '#FFFFFF' : palette.titleBar,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {qrRects.length > 0 ? (
              <svg width="56" height="56" viewBox="0 0 56 56">
                {qrRects.map((r, i) => (
                  <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#111827" />
                ))}
              </svg>
            ) : (
              /* QR fallback: solid square */
              <div style={{ display: 'flex', width: '100%', height: '100%' }} />
            )}
          </div>

          {/* Verify + Controller */}
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {labels.verify}: {displayHash}
            </span>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {labels.controller}: {displayController}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fonts.interRegular, style: 'normal' as const, weight: 400 },
        { name: 'Inter', data: fonts.interBlack, style: 'normal' as const, weight: 900 },
      ],
    },
  )

  // Get the PNG buffer from ImageResponse
  const pngBuffer = await imageResponse.arrayBuffer()

  // Insert snapshot if new
  if (!existing) {
    await insertSnapshot(hash, chainId, agentId, payload)
  }

  // Store image in Supabase Storage (fire-and-forget)
  const imageKey = expectedImageKey
  try {
    const needsUpload = existing?.image_key !== imageKey
    if (needsUpload) {
      await supabaseAdmin.storage
        .from('certificates')
        .upload(imageKey, new Uint8Array(pngBuffer), {
          contentType: 'image/png',
          upsert: true,
        })
      await updateImageKey(hash, imageKey)
    }
  } catch { /* storage write failed — image_key stays null */ }

  return new Response(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'X-Certificate-Hash': hash,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
