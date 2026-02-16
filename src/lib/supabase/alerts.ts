import { supabase } from './client'
import type { AlertRule, AlertRuleType } from '@/types/alerts'
import { toAlertRule } from '@/types/alerts'

const DEFAULT_RULE_TYPES: AlertRuleType[] = [
  'reputation_drop',
  'sybil_detected',
  'going_cold',
]

type BuildRulesParams = {
  ownerAddress: string
  chainId: number
  agentId: number
}

export function buildDefaultRules(params: BuildRulesParams) {
  return DEFAULT_RULE_TYPES.map((ruleType) => ({
    owner_address: params.ownerAddress,
    chain_id: params.chainId,
    agent_id: params.agentId,
    rule_type: ruleType,
    enabled: true,
    webhook_url: null,
  }))
}

export async function fetchAlertRules(
  chainId: number,
  agentId: number
): Promise<AlertRule[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('rule_type')
  return (data ?? []).map(toAlertRule)
}

export async function fetchAlertRulesForOwner(
  walletAddress: string
): Promise<AlertRule[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('owner_address', walletAddress.toLowerCase())
    .order('chain_id')
    .order('agent_id')
    .order('rule_type')
  return (data ?? []).map(toAlertRule)
}
