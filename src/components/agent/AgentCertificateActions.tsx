'use client'

import { useState } from 'react'
import { shareCertificate } from '@/lib/share'
import type { ShareCardStateKey } from '@/lib/trust/share-card-state'

type Props = {
  chainId: number
  agentId: number
  agentName: string | null
}

export function AgentCertificateActions({ chainId, agentId, agentName }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const [copyModalUrl, setCopyModalUrl] = useState<string | null>(null)
  const certUrl = `/api/certificate/${chainId}/${agentId}`

  async function handleShare() {
    try {
      const res = await fetch(`${certUrl}?format=json`)
      if (!res.ok) return
      const data = await res.json()
      const hash = data.hash as string
      const state = (data.payload?.state ?? 'insufficient_signal') as ShareCardStateKey

      const result = await shareCertificate({ hash, name: agentName, state, lang: 'en' })

      if (result === 'copied') {
        setStatus('Link copied!')
        setTimeout(() => setStatus(null), 2000)
      } else if (result === 'modal') {
        setCopyModalUrl(`${window.location.origin}/verify/${hash}`)
      }
    } catch { /* silently fail */ }
  }

  async function handleDownload() {
    try {
      const res = await fetch(certUrl)
      if (!res.ok) return
      const blob = await res.blob()
      const hash = res.headers.get('X-Certificate-Hash') ?? 'cert'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `denscope-certificate-${agentId}-${hash.slice(0, 8)}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silently fail */ }
  }

  return (
    <>
      {status && (
        <span className="text-xs text-interactive font-mono">{status}</span>
      )}

      <button
        onClick={handleShare}
        className="border border-text-primary bg-text-primary px-4 py-1.5 text-xs font-mono font-bold text-background hover:bg-transparent hover:text-foreground transition-colors"
      >
        Share Certificate
      </button>

      <button
        onClick={handleDownload}
        className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-foreground-secondary hover:bg-surface-hover hover:text-foreground hover:border-border-bright transition-colors"
        title="Download PNG"
      >
        Download
      </button>

      {copyModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCopyModalUrl(null)}>
          <div className="bg-background border border-border p-4 rounded-lg max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-foreground-muted mb-2 font-mono">Copy this link:</p>
            <input
              type="text"
              readOnly
              value={copyModalUrl}
              className="w-full bg-surface border border-border px-3 py-2 text-sm font-mono text-foreground rounded"
              onFocus={(e) => e.target.select()}
            />
            <button onClick={() => setCopyModalUrl(null)} className="mt-3 w-full text-xs text-foreground-muted hover:text-foreground font-mono">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
