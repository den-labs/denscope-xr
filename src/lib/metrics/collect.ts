import { supabaseAdmin } from '@/lib/supabase/admin'

export type MetricsPayload = {
  collectedAt: string
  adoption: {
    ownerProfiles: number
    apiKeysTotal: number
    apiKeysLast7d: number
    apiKeysWithUsage: number
    conversionRate: number
  }
  usage: {
    apiCallsLast7d: number
    x402PaymentsTotal: number
  }
  trustSurface: {
    agentsTotal: number
    eventsTotal: number
    eventsLast7d: number
    activeAgentsLast7d: number
    certificatesTotal: number
    certificatesLast7d: number
  }
}

async function countAll(table: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function countSince(table: string, column: string, since: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gte(column, since)
  if (error) throw error
  return count ?? 0
}

async function distinctApiKeysWithUsage(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('api_usage_log')
    .select('api_key_id')
    .not('api_key_id', 'is', null)
  if (error) throw error
  const unique = new Set((data ?? []).map((r) => r.api_key_id))
  return unique.size
}

async function sumApiCallsSince(since: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('api_usage_log')
    .select('request_count')
    .gte('usage_date', since)
  if (error) throw error
  return (data ?? []).reduce((sum, r) => sum + (r.request_count ?? 0), 0)
}

async function activeAgentsSince(since: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('scope_events')
    .select('chain_id, agent_id')
    .gte('created_at', since)
  if (error) throw error
  const unique = new Set((data ?? []).map((r) => `${r.chain_id}:${r.agent_id}`))
  return unique.size
}

export async function collectMetrics(): Promise<MetricsPayload> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    ownerProfiles, apiKeysTotal, apiKeysLast7d, apiKeysWithUsage,
    apiCallsLast7d, x402PaymentsTotal,
    agentsTotal, eventsTotal, eventsLast7d, activeAgentsLast7d,
    certificatesTotal, certificatesLast7d,
  ] = await Promise.all([
    countAll('owner_profiles'),
    countAll('api_keys'),
    countSince('api_keys', 'created_at', sevenDaysAgo),
    distinctApiKeysWithUsage(),
    sumApiCallsSince(sevenDaysAgo),
    countAll('x402_payments'),
    countAll('agents'),
    countAll('scope_events'),
    countSince('scope_events', 'created_at', sevenDaysAgo),
    activeAgentsSince(sevenDaysAgo),
    countAll('certificate_snapshots'),
    countSince('certificate_snapshots', 'issued_at', sevenDaysAgo),
  ])

  return {
    collectedAt: new Date().toISOString(),
    adoption: {
      ownerProfiles, apiKeysTotal, apiKeysLast7d, apiKeysWithUsage,
      conversionRate: apiKeysTotal > 0 ? apiKeysWithUsage / apiKeysTotal : 0,
    },
    usage: { apiCallsLast7d, x402PaymentsTotal },
    trustSurface: {
      agentsTotal, eventsTotal, eventsLast7d, activeAgentsLast7d,
      certificatesTotal, certificatesLast7d,
    },
  }
}
