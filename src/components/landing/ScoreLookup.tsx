'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { chains } from '@/config/chains'
import Link from 'next/link'

type ScoreLookupProps = {
  exampleChain: number
  exampleAgentId: number
}

function normalizeAgentId(raw: string): string {
  return raw.trim().replace(/^0+/, '') || '0'
}

function isValidAgentId(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  return /^\d+$/.test(trimmed)
}

export function ScoreLookup({ exampleChain, exampleAgentId }: ScoreLookupProps) {
  const router = useRouter()
  const [chainId, setChainId] = useState<string>('')
  const [agentId, setAgentId] = useState('')
  const [touched, setTouched] = useState(false)

  const hasError = touched && agentId.trim() !== '' && !isValidAgentId(agentId)
  const isValid = chainId !== '' && isValidAgentId(agentId)

  function handleSubmit() {
    if (!isValid) return
    const normalized = normalizeAgentId(agentId)
    router.push(`/agent/${chainId}/${normalized}`)
  }

  return (
    <div className="mt-8 w-full max-w-[520px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start rounded-xl border border-border p-4">
        <select
          value={chainId}
          onChange={(e) => setChainId(e.target.value)}
          className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Select chain"
        >
          <option value="">Select chain</option>
          {chains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.badge.label}
            </option>
          ))}
        </select>

        <div className="flex-1">
          <input
            type="text"
            inputMode="numeric"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="Agent ID (e.g. 5)"
            className={`h-10 w-full rounded-lg border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent ${
              hasError ? 'border-critical' : 'border-border'
            }`}
          />
          {hasError && (
            <p className="mt-1 text-xs text-critical">
              Agent ID must be a number
            </p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="h-10 rounded-lg bg-accent px-5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          Lookup
        </button>
      </div>

      <p className="mt-3 text-sm text-text-muted">
        <Link
          href={`/agent/${exampleChain}/${exampleAgentId}`}
          className="text-text-secondary underline underline-offset-2 hover:text-accent transition-colors"
        >
          Try it: Agent #{exampleAgentId} on {chains.find((c) => c.id === exampleChain)?.badge.label ?? `Chain ${exampleChain}`}
        </Link>
      </p>
    </div>
  )
}
