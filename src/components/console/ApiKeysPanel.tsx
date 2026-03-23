'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'

type ApiKeyMeta = {
  id: string
  key_prefix: string
  label: string
  tier: string
  daily_limit: number
  enabled: boolean
  last_used_at: string | null
  created_at: string
}

export function ApiKeysPanel() {
  const { address } = useAccount()
  const [keys, setKeys] = useState<ApiKeyMeta[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!address) return
    fetch(`/api/v1/keys?ownerAddress=${address}`)
      .then((r) => r.json())
      .then((data) => setKeys(data.keys ?? []))
  }, [address])

  async function handleCreate() {
    if (!address) return
    setCreating(true)
    const res = await fetch('/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerAddress: address, label: label || 'default' }),
    })
    const data = await res.json()
    if (data.key) {
      setNewKey(data.key)
      setKeys((prev) => [data.metadata, ...prev])
      setLabel('')
    }
    setCreating(false)
  }

  async function handleRevoke(keyId: string) {
    if (!address) return
    await fetch('/api/v1/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId, ownerAddress: address }),
    })
    setKeys((prev) => prev.filter((k) => k.id !== keyId))
  }

  return (
    <div className="bg-surface border border-border p-6 space-y-4">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground">
        API Keys
      </h2>
      <p className="text-xs text-foreground-muted">
        Use API keys to query agent trust scores programmatically.
        Free tier: 100 requests/day.
      </p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="bg-background border border-border px-3 py-1.5 text-xs font-mono text-foreground flex-1"
        />
        <button
          onClick={handleCreate}
          disabled={creating || keys.length >= 5}
          className="bg-interactive text-background px-4 py-1.5 text-xs font-bold hover:bg-interactive/90 transition-colors disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Generate Key'}
        </button>
      </div>

      {newKey && (
        <div className="bg-background border border-interactive p-3 space-y-1">
          <p className="text-xs text-interactive font-bold">
            Copy your API key now — it won&apos;t be shown again:
          </p>
          <code className="text-xs text-foreground font-mono break-all block">
            {newKey}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKey)
              const btn = document.activeElement as HTMLButtonElement
              if (btn) btn.textContent = 'Copied!'
              setTimeout(() => setNewKey(null), 800)
            }}
            className="text-[11px] text-interactive hover:underline"
          >
            Copy &amp; Dismiss
          </button>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="text-xs text-foreground-muted">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between bg-background border border-border px-3 py-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-foreground">{k.key_prefix}...</code>
                  <span className="text-[11px] text-foreground-muted">{k.label}</span>
                  <span className="status-pill status-pill-accent text-[11px]">{k.tier}</span>
                </div>
                <p className="text-[11px] text-foreground-muted">
                  {k.daily_limit} req/day &middot; Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at && ` \u00b7 Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                className="text-[11px] text-danger hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
