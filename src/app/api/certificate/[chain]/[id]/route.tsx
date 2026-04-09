import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { getChain } from '@/config/chains'
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

function confidenceLabel(confidence: string | null, lang: CertificateLang): string {
  const labels: Record<string, Record<string, string>> = {
    en: { high: 'HIGH CONFIDENCE', medium: 'MEDIUM CONFIDENCE', low: 'LOW CONFIDENCE' },
    es: { high: 'CONF. ALTA', medium: 'CONF. MEDIA', low: 'CONF. BAJA' },
  }
  return labels[lang]?.[confidence ?? ''] ?? (lang === 'es' ? 'SIN SCORE' : 'NO SCORE')
}

function evidenceInterpretation(
  state: string,
  positiveRatio: number | null,
  feedbackCount: number,
  lang: CertificateLang,
): string | null {
  if (feedbackCount === 0) return null
  if (state === 'trustworthy') {
    return lang === 'es'
      ? `${Math.round((positiveRatio ?? 0) * 100)}% positivo — trayectoria verificada`
      : `${Math.round((positiveRatio ?? 0) * 100)}% positive — verified track record`
  }
  if (state === 'monitoring') {
    if ((positiveRatio ?? 0) >= 0.7) return lang === 'es' ? 'Senal positiva, aun temprana' : 'Positive signal, still early'
    if ((positiveRatio ?? 0) <= 0.35) return lang === 'es' ? 'Senal negativa, aun temprana' : 'Negative signal, still early'
    return lang === 'es' ? 'Senal mixta, aun temprana' : 'Mixed signal, still early'
  }
  if (state === 'high_risk') {
    return lang === 'es'
      ? `${Math.round((positiveRatio ?? 0) * 100)}% positivo — riesgo detectado`
      : `${Math.round((positiveRatio ?? 0) * 100)}% positive — risk detected`
  }
  return null
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

  // Fetch trust data + agent profile from Supabase (no RPC/IPFS)
  let trustScore = null
  let ownerAddress: string | null = null
  let agentName: string | null = null
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const agentKey = `${chainId}:${agentId}`
      const [scoreResult, agentResult] = await Promise.all([
        supabaseAdmin
          .from('trust_scores')
          .select('*')
          .eq('chain_id', chainId)
          .eq('agent_id', agentId)
          .maybeSingle(),
        supabaseAdmin
          .from('agents')
          .select('owner, metadata')
          .eq('id', agentKey)
          .maybeSingle(),
      ])
      trustScore = scoreResult.data ? toTrustScore(scoreResult.data) : null
      ownerAddress = agentResult.data?.owner ?? null
      const meta = agentResult.data?.metadata as Record<string, unknown> | null
      agentName = (meta?.name as string) ?? null
    }
  } catch { /* data unavailable — proceed with nulls */ }

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
  const stateLabel = labels.stateLabels[payload.state]
  const now = formatTimestamp(new Date())
  const scoreValue = Math.max(0, Math.min(100, Math.round(payload.score)))
  const scoreBarWidth = Math.max(8, scoreValue)
  const accentColor = palette.sealFill === 'transparent' ? '#6B7280' : palette.sealFill
  const confLabel = confidenceLabel(trustScore?.confidence ?? null, lang)
  const interpretation = evidenceInterpretation(
    payload.state,
    trustScore?.positiveRatio ?? null,
    payload.signalCount,
    lang,
  )
  const evidenceLine = lang === 'es'
    ? `Basado en ${payload.signalCount} feedbacks ERC-8004`
    : `Based on ${payload.signalCount} ERC-8004 feedbacks`

  // QR code
  let qrRects: Array<{ x: number; y: number; w: number; h: number }> = []
  try {
    const matrix = generateQRMatrix(verifyUrl)
    qrRects = qrMatrixToRects(matrix, 48, 4, 4)
  } catch { /* QR failed — will use fallback */ }

  const assets = await loadAssets()

  const imageResponse = new ImageResponse(
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
        {/* ── Grid lines (architectural depth) ── */}
        <div style={{ position: 'absolute', top: 100, left: 0, width: '100%', height: 1, background: 'rgba(255,255,255,0.10)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 510, left: 0, width: '100%', height: 1, background: 'rgba(255,255,255,0.10)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 80, width: 1, height: '100%', background: 'rgba(255,255,255,0.10)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 1120, width: 1, height: '100%', background: 'rgba(255,255,255,0.10)', display: 'flex' }} />

        {/* ── TRUST watermark ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 200, fontWeight: 900, letterSpacing: '-0.06em',
            color: 'rgba(255,255,255,0.05)', lineHeight: 0.8,
          }}>TRUST</span>
        </div>

        {/* ── Content layer ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          width: '100%', height: '100%',
          padding: '36px 80px 0',
          justifyContent: 'space-between',
          position: 'relative',
        }}>

          {/* ═══ TOP BAR ═══ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            {/* Left: status dot + protocol + certificate label */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: accentColor, display: 'flex' }} />
                <span style={{ fontSize: 12, color: '#9ca3af', letterSpacing: '0.1em', fontWeight: 400 }}>
                  ERC-8004
                </span>
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.1em' }}>
                {labels.title.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.05em' }}>
                {chainConfig.name} · {now}
              </span>
            </div>

            {/* Right: DENSCOPE branding + wolfcillo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={assets.logoSrc} width={24} height={24} style={{ filter: 'invert(1)' }} />
                  <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>
                    DENSCOPE
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.2em', marginTop: 4 }}>
                  BY DENLABS
                </span>
              </div>
              <img src={assets.wolfcilloSrc} width={70} height={40} style={{ borderRadius: 6 }} />
            </div>
          </div>

          {/* ═══ CENTER HERO ═══ */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 80,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Agent ID + name */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 6 }}>
              <span style={{ fontSize: 22, color: '#6b7280', fontWeight: 400 }}>ID</span>
              <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.025em' }}>
                #{agentId}
              </span>
            </div>
            <span style={{
              fontSize: 16, color: payload.name ? '#F0F0F0' : '#6b7280',
              letterSpacing: '0.05em', fontWeight: 400,
              fontStyle: payload.name ? 'normal' : 'italic',
            }}>
              {displayName}
            </span>

            {/* Score hero block */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              marginTop: 18, width: 480, maxWidth: '100%',
              padding: '16px 24px',
              border: `1px solid ${cardState.accentSoft}`,
              background: 'rgba(0,0,0,0.45)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Seal (compact, left of score) */}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                  border: `3px ${palette.sealDashed ? 'dashed' : 'solid'} ${palette.sealBorder}`,
                  background: palette.sealFill,
                }}>
                  {payload.state === 'insufficient_signal' ? (
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#9CA3AF', letterSpacing: '0.05em', textAlign: 'center' }}>
                      {labels.insufficientSealLines[0]}{'\n'}{labels.insufficientSealLines[1]}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {payload.state === 'trustworthy' && (
                        <svg width="24" height="24" viewBox="0 0 40 40">
                          <path d="M20 2 L36 12 V26 C36 34 20 38 20 38 C20 38 4 34 4 26 V12 Z" fill="rgba(255,255,255,0.3)" />
                          <path d="M13 20 L18 25 L28 15" stroke="white" strokeWidth="3" fill="none" />
                        </svg>
                      )}
                      {payload.state === 'monitoring' && (
                        <svg width="24" height="24" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
                          <circle cx="20" cy="20" r="4" fill="white" />
                        </svg>
                      )}
                      {payload.state === 'high_risk' && (
                        <svg width="24" height="24" viewBox="0 0 40 40">
                          <path d="M20 4 L38 36 H2 Z" fill="rgba(255,255,255,0.3)" />
                          <path d="M20 16 V26" stroke="white" strokeWidth="3" />
                          <circle cx="20" cy="31" r="2" fill="white" />
                        </svg>
                      )}
                    </div>
                  )}
                </div>

                {/* Score number */}
                <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.03em', color: accentColor }}>
                  {scoreValue}
                </span>

                {/* State + confidence */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.15em' }}>
                    {labels.trustScore.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: accentColor }}>
                    {stateLabel}
                  </span>
                  <span style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.14em' }}>
                    {confLabel}
                  </span>
                </div>
              </div>

              {/* Score bar */}
              <div style={{
                width: '100%', marginTop: 12, height: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', padding: '1px',
              }}>
                <div style={{
                  height: '100%', width: `${scoreBarWidth}%`,
                  background: accentColor, display: 'flex',
                }} />
              </div>

              {/* Evidence + interpretation */}
              <span style={{ fontSize: 12, color: '#D1D5DB', marginTop: 10 }}>
                {evidenceLine}
              </span>
              {interpretation && (
                <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  {interpretation}
                </span>
              )}
            </div>
          </div>

          {/* ═══ BOTTOM BAR (3-col verification rail) ═══ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', paddingBottom: 36 }}>

            {/* Left: Controller */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{
                fontSize: 10, color: '#6b7280', letterSpacing: '0.1em', fontWeight: 400,
                borderBottom: '1px solid #1f2937', paddingBottom: 4, marginBottom: 4,
              }}>
                {labels.controller.toUpperCase()}
              </span>
              <span style={{ fontSize: 20, fontWeight: 700 }}>
                {displayController}
              </span>
            </div>

            {/* Center: QR + verify hash */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex', width: 56, height: 56,
                background: qrRects.length > 0 ? '#FFFFFF' : '#1f2937',
                flexShrink: 0,
              }}>
                {qrRects.length > 0 ? (
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    {qrRects.map((r, i) => (
                      <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#111827" />
                    ))}
                  </svg>
                ) : (
                  <div style={{ display: 'flex', width: '100%', height: '100%' }} />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.1em' }}>
                  {labels.verify.toUpperCase()}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#D1D5DB' }}>
                  {displayHash}
                </span>
              </div>
            </div>

            {/* Right: Chain + signals */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                fontSize: 10, color: '#6b7280', letterSpacing: '0.1em', fontWeight: 400,
                borderBottom: '1px solid #1f2937', paddingBottom: 4, marginBottom: 4,
              }}>
                {labels.signals.toUpperCase()}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{
                  fontSize: 12, color: '#D1D5DB',
                  border: '1px solid #374151', padding: '4px 10px',
                }}>
                  {payload.signalCount} feedbacks
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  Chain: {chainConfig.badge.label}
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
      fonts: [
        { name: 'Inter', data: assets.interRegular, style: 'normal' as const, weight: 400 },
        { name: 'Inter', data: assets.interBlack, style: 'normal' as const, weight: 900 },
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
