// src/components/console/AlertsPanel.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { useAlertStore } from '@/stores/alerts'
import { fetchOwnerAgents, type OwnerProfile } from '@/lib/supabase/owner-profiles'
import { getChain } from '@/config/chains'
import type { AlertRule } from '@/types/alerts'

const RULE_LABELS: Record<string, { label: string; description: string }> = {
  reputation_drop: {
    label: 'Reputation Drop',
    description: 'Alert when negative feedback exceeds 50%',
  },
  sybil_detected: {
    label: 'Sybil Pattern',
    description: 'Alert when coordinated feedback detected',
  },
  going_cold: {
    label: 'Going Cold',
    description: 'Alert when no feedback in 7 days',
  },
}

function agentKey(agent: Pick<OwnerProfile, 'chain_id' | 'agent_id'>) {
  return `${agent.chain_id}:${agent.agent_id}`
}

function RuleToggle({
  rule,
  onToggle,
}: {
  rule: AlertRule
  onToggle: (ruleId: string, enabled: boolean) => void
}) {
  const label = RULE_LABELS[rule.ruleType] ?? { label: rule.ruleType, description: '' }
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-xs font-mono text-text-primary">{label.label}</p>
        <p className="text-[10px] text-text-muted">{label.description}</p>
      </div>
      <button
        onClick={() => onToggle(rule.id, !rule.enabled)}
        className={`w-10 h-5 rounded-full transition-colors ${
          rule.enabled ? 'bg-accent' : 'bg-border'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white transition-transform ${
            rule.enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export function AlertsPanel() {
  const { address } = useAccount()
  const { rules, setRules, updateRule, clear } = useAlertStore()
  const [agents, setAgents] = useState<OwnerProfile[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingRules, setLoadingRules] = useState(false)

  const selected = useMemo(
    () => agents.find((a) => agentKey(a) === selectedKey) ?? null,
    [agents, selectedKey],
  )

  useEffect(() => {
    if (!address) {
      setAgents([])
      setSelectedKey(null)
      setLoadingAgents(false)
      clear()
      return
    }
    let cancelled = false
    setLoadingAgents(true)
    fetchOwnerAgents(address)
      .then((data) => {
        if (cancelled) return
        setAgents(data)
        setSelectedKey(data[0] ? agentKey(data[0]) : null)
        setLoadingAgents(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadingAgents(false)
      })
    return () => {
      cancelled = true
    }
  }, [address, clear])

  useEffect(() => {
    if (!selected) {
      clear()
      setWebhookUrl('')
      return
    }
    let cancelled = false
    setLoadingRules(true)
    setTestResult(null)

    const qs = new URLSearchParams({
      chainId: String(selected.chain_id),
      agentId: String(selected.agent_id),
    })

    fetch(`/api/alerts/rules?${qs.toString()}`)
      .then((r) => r.json())
      .then(async ({ rules: data, error }) => {
        if (cancelled) return
        if (error) {
          clear()
          setWebhookUrl('')
          setLoadingRules(false)
          return
        }

        let rows = Array.isArray(data) ? data : []

        if (rows.length === 0) {
          const res = await fetch('/api/alerts/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainId: selected.chain_id,
              agentId: selected.agent_id,
            }),
          })
          if (res.ok) {
            const created = await res.json()
            rows = Array.isArray(created.rules) ? created.rules : []
          }
          if (cancelled) return
        }

        setRules(
          rows.map((r: Record<string, unknown>) => ({
            id: r.id,
            ownerAddress: r.owner_address,
            chainId: r.chain_id,
            agentId: r.agent_id,
            ruleType: r.rule_type,
            enabled: r.enabled,
            webhookUrl: r.webhook_url,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })) as AlertRule[],
        )
        const existing = rows.find((r: Record<string, unknown>) => r.webhook_url)?.webhook_url
        setWebhookUrl(typeof existing === 'string' ? existing : '')
        setLoadingRules(false)
      })
      .catch(() => {
        if (cancelled) return
        clear()
        setLoadingRules(false)
      })

    return () => {
      cancelled = true
    }
  }, [selected, setRules, clear])

  async function handleToggle(ruleId: string, enabled: boolean) {
    const previous = rules.find((r) => r.id === ruleId)?.enabled
    updateRule(ruleId, { enabled })
    const res = await fetch('/api/alerts/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, enabled }),
    })
    if (!res.ok && typeof previous === 'boolean') {
      updateRule(ruleId, { enabled: previous })
    }
  }

  async function handleSaveWebhook() {
    if (!selected) return
    setSaving(true)
    setTestResult(null)
    const results = await Promise.all(
      rules.map((rule) =>
        fetch('/api/alerts/rules', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruleId: rule.id, webhookUrl }),
        }).then((r) => r.ok),
      ),
    )
    const allOk = results.every(Boolean)
    setSaving(false)
    setTestResult(allOk ? 'Webhook saved' : 'Save failed on one or more rules')
  }

  async function handleTestWebhook() {
    if (!webhookUrl) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/alerts/webhook-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      })
      const data = await res.json()
      setTestResult(data.success ? 'Sent successfully' : `Failed (${data.status})`)
    } catch {
      setTestResult('Send failed')
    }
    setTesting(false)
  }

  if (loadingAgents) {
    return (
      <div className="bg-surface border border-border p-5 space-y-4">
        <div className="h-3 w-24 bg-border rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-2 animate-pulse">
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-border rounded" />
              <div className="h-2.5 w-44 bg-border rounded" />
            </div>
            <div className="h-5 w-10 bg-border rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="bg-surface border border-border p-5">
        <p className="text-xs text-text-muted font-mono">
          Claim an agent to configure alerts.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono">
          Alert Rules
        </h2>
        {agents.length > 1 && (
          <label className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
            <span className="uppercase tracking-wider">Agent</span>
            <select
              value={selectedKey ?? ''}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="bg-bg border border-border px-2 py-1 text-xs font-mono text-text-primary focus:border-accent/50 focus:outline-none"
            >
              {agents.map((agent) => {
                const chain = getChain(agent.chain_id)
                return (
                  <option key={agentKey(agent)} value={agentKey(agent)}>
                    #{agent.agent_id} · {chain?.name ?? `Chain ${agent.chain_id}`}
                  </option>
                )
              })}
            </select>
          </label>
        )}
        {agents.length === 1 && selected && (
          <span className="text-[10px] font-mono text-text-muted">
            #{selected.agent_id} · {getChain(selected.chain_id)?.name ?? `Chain ${selected.chain_id}`}
          </span>
        )}
      </div>

      {loadingRules ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 animate-pulse">
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-border rounded" />
                <div className="h-2.5 w-44 bg-border rounded" />
              </div>
              <div className="h-5 w-10 bg-border rounded-full" />
            </div>
          ))}
        </div>
      ) : rules.length === 0 ? (
        <p className="text-xs text-text-muted font-mono">
          No alert rules. They will be created the next time this panel loads.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {rules.map((rule) => (
            <RuleToggle key={rule.id} rule={rule} onToggle={handleToggle} />
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-border space-y-3">
        <label className="text-xs text-text-muted font-mono block">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/..."
          className="w-full bg-bg border border-border px-3 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveWebhook}
            disabled={saving || rules.length === 0}
            className="border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs font-mono text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleTestWebhook}
            disabled={testing || !webhookUrl}
            className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors disabled:opacity-50"
          >
            {testing ? 'Sending...' : 'Test'}
          </button>
          {testResult && (
            <span className="text-[10px] font-mono text-text-muted">{testResult}</span>
          )}
        </div>
      </div>
    </div>
  )
}
