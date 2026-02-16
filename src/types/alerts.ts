export type AlertRuleType = 'reputation_drop' | 'sybil_detected' | 'going_cold'

export type AlertRule = {
  id: string
  ownerAddress: string
  chainId: number
  agentId: number
  ruleType: AlertRuleType
  enabled: boolean
  webhookUrl: string | null
  createdAt: string
  updatedAt: string
}

/** Map DB row (snake_case) -> AlertRule (camelCase) */
export function toAlertRule(row: Record<string, unknown>): AlertRule {
  return {
    id: row.id as string,
    ownerAddress: row.owner_address as string,
    chainId: row.chain_id as number,
    agentId: row.agent_id as number,
    ruleType: row.rule_type as AlertRuleType,
    enabled: row.enabled as boolean,
    webhookUrl: (row.webhook_url as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export type WebhookPayload = {
  incident: {
    id: string
    signalKind: string
    severity: string
    title: string
    description: string
    whyItMatters: string | null
  }
  agent: { chainId: number; agentId: number }
  timestamp: string
  consoleUrl: string
}
