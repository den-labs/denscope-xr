// src/components/console/AlertsPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useAlertStore } from '@/stores/alerts'
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
        <p className="text-xs text-foreground">{label.label}</p>
        <p className="text-[10px] text-foreground-muted">{label.description}</p>
      </div>
      <button
        onClick={() => onToggle(rule.id, !rule.enabled)}
        className={`w-10 h-5 rounded-full transition-colors ${
          rule.enabled ? 'bg-interactive' : 'bg-border'
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
  const { rules, setRules, updateRule } = useAlertStore()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch alert rules
  useEffect(() => {
    if (!address) return
    fetch(`/api/alerts/rules?chainId=42220&agentId=0`)
      .then((r) => r.json())
      .then(({ rules: data }) => {
        // Note: rules might not exist yet, that's OK
        if (data && data.length > 0) {
          setRules(data.map((r: Record<string, unknown>) => ({
            id: r.id,
            ownerAddress: r.owner_address,
            chainId: r.chain_id,
            agentId: r.agent_id,
            ruleType: r.rule_type,
            enabled: r.enabled,
            webhookUrl: r.webhook_url,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })))
          const url = data.find((r: Record<string, unknown>) => r.webhook_url)?.webhook_url
          if (url) setWebhookUrl(url as string)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [address, setRules])

  async function handleToggle(ruleId: string, enabled: boolean) {
    updateRule(ruleId, { enabled })
    await fetch('/api/alerts/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId, enabled }),
    })
  }

  async function handleSaveWebhook() {
    setSaving(true)
    for (const rule of rules) {
      await fetch('/api/alerts/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: rule.id, webhookUrl }),
      })
    }
    setSaving(false)
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

  if (loading) {
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

  if (rules.length === 0) {
    return (
      <div className="bg-surface border border-border p-5 shadow-sm dark:shadow-none">
        <p className="text-xs text-foreground-muted">
          Claim an agent to configure alerts.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border p-5 space-y-4 shadow-sm dark:shadow-none">
      <h2 className="text-xs text-foreground-muted uppercase tracking-wider">
        Alert Rules
      </h2>

      <div className="divide-y divide-border">
        {rules.map((rule) => (
          <RuleToggle key={rule.id} rule={rule} onToggle={handleToggle} />
        ))}
      </div>

      <div className="pt-4 border-t border-border space-y-3">
        <label className="text-xs text-foreground-muted block">
          Webhook URL
        </label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/..."
          className="w-full bg-background border border-border px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-foreground-muted focus:border-interactive/50 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveWebhook}
            disabled={saving}
            className="border border-interactive/30 bg-interactive/5 px-3 py-1.5 text-xs text-interactive hover:bg-interactive/10 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleTestWebhook}
            disabled={testing || !webhookUrl}
            className="border border-border bg-surface px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground hover:border-border-bright transition-colors disabled:opacity-50"
          >
            {testing ? 'Sending...' : 'Test'}
          </button>
          {testResult && (
            <span className="text-[11px] text-foreground-muted">{testResult}</span>
          )}
        </div>
      </div>
    </div>
  )
}
