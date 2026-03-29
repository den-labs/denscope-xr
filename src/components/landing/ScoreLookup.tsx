'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { chains, getChain } from '@/config/chains'
import Link from 'next/link'

type ExampleAgent = { chainId: number; agentId: number }

type ScoreLookupProps = {
  exampleAgents: ExampleAgent[]
}

function normalizeAgentId(raw: string): string {
  return raw.trim().replace(/^0+/, '') || '0'
}

function isValidAgentId(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return false
  return /^\d+$/.test(trimmed)
}

const MAINNET_CHAINS = chains.filter((c) => c.name !== 'Celo Sepolia')

export function ScoreLookup({ exampleAgents }: ScoreLookupProps) {
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
            maxLength={20}
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="Agent ID (e.g. 5)"
            aria-label="Agent ID"
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? 'agent-id-error' : undefined}
            className={`h-10 w-full rounded-lg border bg-bg px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent ${
              hasError ? 'border-critical' : 'border-border'
            }`}
          />
          {hasError && (
            <p id="agent-id-error" className="mt-1 text-xs text-critical">
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

      <div className="mt-4 space-y-2">
        <p className="text-xs text-text-muted text-center">
          Try high-trust agents:{' '}
          {exampleAgents.map((agent, i) => (
            <span key={`${agent.chainId}-${agent.agentId}`}>
              {i > 0 && <span className="mx-1 text-border">·</span>}
              <Link
                href={`/agent/${agent.chainId}/${agent.agentId}`}
                className="text-text-secondary underline underline-offset-2 hover:text-accent transition-colors"
              >
                Agent #{agent.agentId} on{' '}
                {getChain(agent.chainId)?.badge.label ??
                  `Chain ${agent.chainId}`}
              </Link>
            </span>
          ))}
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-[11px] text-text-muted tracking-wide uppercase">
            Supported chains
          </span>
          {MAINNET_CHAINS.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide"
              style={{
                borderColor: `${c.badge.color}30`,
                backgroundColor: `${c.badge.color}08`,
                color: c.badge.color,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: c.badge.color }}
              />
              {c.badge.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
