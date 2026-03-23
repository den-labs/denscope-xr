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
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center gap-3"
          style={{ background: palette.titleBar }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
            <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-white font-bold text-lg">VERIFIED CERTIFICATE</span>
        </div>

        {/* Certificate image */}
        {imageUrl && (
          <div className="px-6 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Trust Certificate"
              className="w-full rounded border border-gray-200"
            />
          </div>
        )}

        {/* Data */}
        <div className="px-6 py-4 space-y-3">
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
          <div className="flex items-center justify-between py-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Hash:</span>
              <code className="text-sm font-mono text-gray-700">{displayHash}</code>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              title="Copy verify link"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Action */}
        <div className="px-6 pb-4">
          <Link
            href={`/agent/${payload.chainId}/${payload.agentId}`}
            className="block w-full text-center py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            View Live Report →
          </Link>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <span className="text-xs text-gray-400">
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
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}
