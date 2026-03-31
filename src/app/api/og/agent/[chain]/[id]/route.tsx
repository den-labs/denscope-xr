import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getChain } from '@/config/chains'
import { readAgentOwner, readAgentURI } from '@/lib/agent/read'
import { fetchAgentMetadataServer } from '@/lib/agent/metadata'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { toTrustScore, type TrustScore } from '@/types/trust-score'
import { getShareCardState } from '@/lib/trust/share-card-state'
import { composeEvaluation } from '@/lib/evaluation/compose'
import type { Evaluation } from '@/types/evaluation'

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

function clampScore(score: number | null): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

function confidenceLabelEs(confidence: TrustScore['confidence'] | null): string {
  switch (confidence) {
    case 'high':
      return 'CONF. ALTA'
    case 'medium':
      return 'CONF. MEDIA'
    case 'low':
      return 'CONF. BAJA'
    default:
      return 'SIN SCORE'
  }
}

async function fetchTrustScoreForOg(chainId: number, agentId: number): Promise<TrustScore | null> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
    const { data } = await supabaseAdmin
      .from('trust_scores')
      .select('*')
      .eq('chain_id', chainId)
      .eq('agent_id', agentId)
      .maybeSingle()
    return data ? toTrustScore(data) : null
  } catch {
    return null
  }
}

export async function GET(_req: Request, { params }: Props) {
  const { chain, id } = await params
  const chainId = Number(chain)
  const chainConfig = getChain(chainId)
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

  const [assets, owner, uri, trustScore] = await Promise.all([
    loadAssets(),
    readAgentOwner(chainConfig, agentId),
    readAgentURI(chainConfig, agentId),
    fetchTrustScoreForOg(chainId, agentId),
  ])
  let evaluation: Evaluation | null = null
  try {
    const result = await composeEvaluation({
      chainId, agentId, preset: 'default_safety',
    })
    evaluation = result.evaluation
  } catch {
    // Fallback to v1 card if evaluation fails
  }

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
  const cardState = getShareCardState(trustScore)
  const scoreValue = clampScore(trustScore?.score ?? null)
  const confidenceLabel = confidenceLabelEs(trustScore?.confidence ?? null)
  const scoreBarWidth = Math.max(8, scoreValue)
  const evidenceLine = cardState.evidenceLine
  const statusDotColor = cardState.accentColor
  const monitoringHint = cardState.key === 'monitoring' && trustScore
    ? trustScore.positiveRatio >= 0.7
      ? 'Señal positiva, aún temprana'
      : trustScore.positiveRatio <= 0.35
        ? 'Señal negativa, aún temprana'
        : 'Señal mixta, aún temprana'
    : null

  const trustBandColors: Record<string, string> = {
    high: '#059669',
    medium: '#EA580C',
    low: '#DC2626',
    insufficient_signal: '#6b7280',
  }
  const trustBandLabels: Record<string, string> = {
    high: 'HIGH TRUST',
    medium: 'MEDIUM TRUST',
    low: 'LOW TRUST',
    insufficient_signal: 'INSUFFICIENT DATA',
  }
  const actionColors: Record<string, string> = {
    allow: '#059669',
    review: '#EA580C',
    limit: '#DC2626',
  }
  const actionSymbols: Record<string, string> = {
    allow: '\u2713 ALLOWED',
    review: '\u26A0 REVIEW',
    limit: '\u2715 LIMITED',
  }

  const evalBandColor = evaluation ? (trustBandColors[evaluation.trust_band] ?? '#6b7280') : null
  const evalBandLabel = evaluation ? (trustBandLabels[evaluation.trust_band] ?? '') : null
  const evalActionColor = evaluation ? (actionColors[evaluation.recommended_action] ?? '#6b7280') : null
  const evalActionLabel = evaluation ? (actionSymbols[evaluation.recommended_action] ?? '') : null
  const evalFlagsCount = evaluation?.flags?.length ?? 0

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
                <div style={{ width: 8, height: 8, borderRadius: 4, background: statusDotColor, display: 'flex' }} />
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
            {/* v2: Trust band badge (above score) */}
            {evaluation && evalBandColor && evalBandLabel && (
              <div style={{
                display: 'flex',
                padding: '4px 16px',
                background: evalBandColor,
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.12em',
                marginBottom: 10,
              }}>
                {evalBandLabel}
              </div>
            )}

            {/* ID row: horizontal flex, baseline-aligned */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 24, color: '#6b7280', fontWeight: 400 }}>
                ID
              </span>
              <span style={{ fontSize: 82, fontWeight: 900, letterSpacing: '-0.025em' }}>
                #{agentId}
              </span>
            </div>

            {/* Agent name */}
            <span style={{ fontSize: 18, color: '#F0F0F0', letterSpacing: '0.05em', fontWeight: 400 }}>
              {name}
            </span>

            {/* Trust / risk signal (v1 focus) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: 20,
                width: 440,
                maxWidth: '100%',
                padding: '18px 22px',
                border: `1px solid ${cardState.accentSoft}`,
                background: 'rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.03em', color: cardState.accentColor }}>
                  {scoreValue}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.15em' }}>
                    SNAPSHOT DE CONFIANZA
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 700, color: cardState.accentColor }}>
                    {cardState.label}
                  </span>
                  <span style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.14em' }}>
                    {confidenceLabel}
                  </span>
                </div>
              </div>

              <div
                style={{
                  width: '100%',
                  marginTop: 14,
                  height: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${scoreBarWidth}%`,
                    background: cardState.accentColor,
                    display: 'flex',
                  }}
                />
              </div>

              <span style={{ fontSize: 12, color: '#D1D5DB', marginTop: 10 }}>
                {evidenceLine}
              </span>
              {monitoringHint && (
                <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  {monitoringHint}
                </span>
              )}

              {/* v2: Recommended action pill + flags */}
              {evaluation && evalActionColor && evalActionLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <div style={{
                    display: 'flex',
                    padding: '3px 12px',
                    background: evalActionColor,
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                  }}>
                    {evalActionLabel}
                  </div>
                  {evalFlagsCount > 0 && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {evalFlagsCount} flag{evalFlagsCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>

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
              <span style={{ fontSize: 22, fontWeight: 700 }}>
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

            {/* Right column: FEEDBACK EVIDENCE */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span style={{
                fontSize: 10, color: '#6b7280', letterSpacing: '0.1em', fontWeight: 400,
                borderBottom: '1px solid #1f2937', paddingBottom: 4, marginBottom: 4,
              }}>
                FEEDBACK SIGNAL
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{
                  fontSize: 12,
                  color: '#D1D5DB',
                  border: '1px solid #374151',
                  padding: '4px 10px',
                }}>
                  {trustScore ? `${trustScore.feedbackCount} feedbacks` : 'No score yet'}
                </span>
                {trustScore && (
                  cardState.key !== 'insufficient_signal' ? (
                    <span style={{
                      fontSize: 12,
                      color: '#9CA3AF',
                    }}>
                      {Math.round(trustScore.positiveRatio * 100)}% positive
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11,
                      color: '#6b7280',
                    }}>
                      evidencia insuficiente
                    </span>
                  )
                )}
                {!trustScore && services.length > 0 && (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {services.slice(0, 2).join(' • ')}
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
