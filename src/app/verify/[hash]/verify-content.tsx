'use client'

import { useState } from 'react'
import type { ShareCardStateKey } from '@/lib/trust/share-card-state'
import { certificatePalettes } from '@/lib/trust/certificate'
import { getCertificateLabels } from '@/lib/trust/certificate-i18n'
import Link from 'next/link'

type Props = {
  hash: string
  displayHash: string
  payload: {
    agentId: number
    chainId: number
    chainName: string
    name: string | null
    controller: string | null
    score: number
    state: ShareCardStateKey
    signalCount: number
    positiveCount: number
    negativeCount: number
  }
  issuedAt: string
  imageUrl: string | null
  baseUrl: string
}

function formatIssuedAt(iso: string): string {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`
}

function truncateAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function VerifyContent({ hash, displayHash, payload, issuedAt, imageUrl, baseUrl }: Props) {
  const [copied, setCopied] = useState(false)
  const labels = getCertificateLabels('en')
  const palette = certificatePalettes[payload.state]
  const stateLabel = labels.stateLabels[payload.state]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${baseUrl}/verify/${hash}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ background: palette.titleBar }}
          role="banner"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
            <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="text-white font-bold text-lg">VERIFIED CERTIFICATE</h1>
        </div>

        {/* Certificate image */}
        {imageUrl && (
          <div className="px-6 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Trust certificate for ${payload.name ?? `agent #${payload.agentId}`} on ${payload.chainName}`}
              className="w-full rounded border border-border"
            />
          </div>
        )}

        {/* Data */}
        <dl className="px-6 py-4 space-y-3">
          <Row label="Agent" value={`${truncateAddr(`0x${payload.agentId.toString(16).padStart(8, '0')}`)}${payload.name ? ` (${payload.name})` : ''}`} />
          <Row label="Chain" value={payload.chainName} />
          <Row label={labels.trustScore} value={`${payload.score} / 100`} />
          <Row label="State" value={stateLabel} />
          <Row
            label={labels.signals}
            value={`${payload.signalCount} (+${payload.positiveCount} / -${payload.negativeCount})`}
          />
          <Row
            label={labels.controller}
            value={payload.controller ? truncateAddr(payload.controller) : labels.noController}
          />
          <Row label="Issued" value={formatIssuedAt(issuedAt)} />

          {/* Hash with copy */}
          <div className="flex items-center justify-between py-2 border-t border-border">
            <div className="flex items-center gap-2">
              <dt className="text-sm text-text-muted">Hash:</dt>
              <dd>
                <code className="text-sm font-mono text-text-secondary">{displayHash}</code>
              </dd>
            </div>
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Verification link copied' : 'Copy verification link'}
              className="text-xs text-text-muted hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded px-2 py-1"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </dl>

        {/* Action */}
        <div className="px-6 pb-4">
          <Link
            href={`/agent/${payload.chainId}/${payload.agentId}`}
            className="block w-full text-center py-2 px-4 bg-text-primary text-bg rounded-lg text-sm font-medium hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            View Live Report →
          </Link>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-surface-hover border-t border-border text-center">
          <span className="text-xs text-text-muted">
            This certificate was issued by DenScope on {formatIssuedAt(issuedAt)}
          </span>
        </div>
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text-primary">{value}</dd>
    </div>
  )
}
