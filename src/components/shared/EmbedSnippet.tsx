'use client'

import { useState } from 'react'

export function EmbedSnippet({ chainId, agentId }: { chainId: number; agentId: number }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const snippet = `<iframe src="https://denscope.vercel.app/embed/agent/${chainId}/${agentId}" width="420" height="260" frameborder="0"></iframe>`

  function handleCopy() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="border border-border bg-surface px-4 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
      >
        Embed
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[400px] border border-border bg-surface p-4 space-y-3">
          <p className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
            Embed this agent card
          </p>
          <pre className="bg-bg border border-border p-3 font-mono text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <button
            onClick={handleCopy}
            className="border border-border bg-bg px-3 py-1 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}
