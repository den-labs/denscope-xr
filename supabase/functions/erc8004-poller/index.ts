/**
 * ERC-8004 Event Poller — Supabase Edge Function
 *
 * Polls Forno public RPCs for new ERC-8004 events and writes to Supabase.
 * Invoked by pg_cron every 30s. Processes up to CHUNK_SIZE blocks per chain.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  createPublicClient,
  http,
  type Log,
  type Chain,
} from 'https://esm.sh/viem@2.23.2'
import { celo } from 'https://esm.sh/viem@2.23.2/chains'

// --- Config ---

const CHUNK_SIZE = 500

const CHAINS = [
  {
    id: 42220,
    name: 'Celo',
    rpc: 'https://forno.celo.org',
    identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
    reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as `0x${string}`,
  },
  {
    id: 11142220,
    name: 'Celo Sepolia',
    rpc: 'https://forno.celo-sepolia.celo-testnet.org',
    identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as `0x${string}`,
    reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713' as `0x${string}`,
  },
] as const

const celoSepolia: Chain = {
  id: 11142220,
  name: 'Celo Sepolia',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo-sepolia.celo-testnet.org'] } },
  blockExplorers: { default: { name: 'Celoscan', url: 'https://sepolia.celoscan.io' } },
}

const VIEM_CHAINS: Record<number, Chain> = { 42220: celo, 11142220: celoSepolia }

// --- ABIs (events only) ---

const identityRegistryAbi = [
  { type: 'event', name: 'Registered', inputs: [{ name: 'agentId', type: 'uint256', indexed: true }, { name: 'agentURI', type: 'string', indexed: false }, { name: 'owner', type: 'address', indexed: true }] },
  { type: 'event', name: 'URIUpdated', inputs: [{ name: 'agentId', type: 'uint256', indexed: true }, { name: 'newURI', type: 'string', indexed: false }, { name: 'updatedBy', type: 'address', indexed: true }] },
  { type: 'event', name: 'MetadataSet', inputs: [{ name: 'agentId', type: 'uint256', indexed: true }, { name: 'indexedMetadataKey', type: 'string', indexed: true }, { name: 'metadataKey', type: 'string', indexed: false }, { name: 'metadataValue', type: 'bytes', indexed: false }] },
] as const

const reputationRegistryAbi = [
  { type: 'event', name: 'NewFeedback', inputs: [{ name: 'agentId', type: 'uint256', indexed: true }, { name: 'clientAddress', type: 'address', indexed: true }, { name: 'feedbackIndex', type: 'uint64', indexed: false }, { name: 'value', type: 'int128', indexed: false }, { name: 'valueDecimals', type: 'uint8', indexed: false }, { name: 'indexedTag1', type: 'string', indexed: true }, { name: 'tag1', type: 'string', indexed: false }, { name: 'tag2', type: 'string', indexed: false }, { name: 'endpoint', type: 'string', indexed: false }, { name: 'feedbackURI', type: 'string', indexed: false }, { name: 'feedbackHash', type: 'bytes32', indexed: false }] },
  { type: 'event', name: 'FeedbackRevoked', inputs: [{ name: 'agentId', type: 'uint256', indexed: true }, { name: 'clientAddress', type: 'address', indexed: true }, { name: 'feedbackIndex', type: 'uint64', indexed: true }] },
  { type: 'event', name: 'ResponseAppended', inputs: [{ name: 'agentId', type: 'uint256', indexed: true }, { name: 'clientAddress', type: 'address', indexed: true }, { name: 'feedbackIndex', type: 'uint64', indexed: false }, { name: 'responder', type: 'address', indexed: true }, { name: 'responseURI', type: 'string', indexed: false }, { name: 'responseHash', type: 'bytes32', indexed: false }] },
] as const

// --- Types ---

type ParsedEvent = {
  chain_id: number
  agent_id: number
  kind: string
  block_number: number
  tx_hash: string
  log_index: number
  data: Record<string, unknown>
  event_timestamp: string | null
}

// --- Parsing (mirrors scripts/indexer.ts) ---

function parseIdentityLog(log: Log, chainId: number): ParsedEvent | null {
  const { eventName, args } = log as unknown as { eventName: string; args: Record<string, unknown> }
  const base = {
    chain_id: chainId,
    block_number: Number(log.blockNumber),
    tx_hash: log.transactionHash!,
    log_index: log.logIndex!,
    event_timestamp: new Date().toISOString(),
  }
  switch (eventName) {
    case 'Registered':
      return { ...base, kind: 'register', agent_id: Number(args.agentId), data: { agentURI: args.agentURI, owner: args.owner } }
    case 'URIUpdated':
      return { ...base, kind: 'uri_update', agent_id: Number(args.agentId), data: { newURI: args.newURI, updatedBy: args.updatedBy } }
    case 'MetadataSet':
      return { ...base, kind: 'metadata', agent_id: Number(args.agentId), data: { metadataKey: args.metadataKey, metadataValue: args.metadataValue } }
    default:
      return null
  }
}

function parseReputationLog(log: Log, chainId: number): ParsedEvent | null {
  const { eventName, args } = log as unknown as { eventName: string; args: Record<string, unknown> }
  const base = {
    chain_id: chainId,
    block_number: Number(log.blockNumber),
    tx_hash: log.transactionHash!,
    log_index: log.logIndex!,
    event_timestamp: new Date().toISOString(),
  }
  switch (eventName) {
    case 'NewFeedback':
      return {
        ...base, kind: 'feedback', agent_id: Number(args.agentId),
        data: { clientAddress: args.clientAddress, feedbackIndex: String(args.feedbackIndex), value: String(args.value), valueDecimals: args.valueDecimals, tag1: args.tag1, tag2: args.tag2, endpoint: args.endpoint, feedbackURI: args.feedbackURI, feedbackHash: args.feedbackHash },
      }
    case 'FeedbackRevoked':
      return { ...base, kind: 'feedback_revoked', agent_id: Number(args.agentId), data: { clientAddress: args.clientAddress, feedbackIndex: String(args.feedbackIndex) } }
    case 'ResponseAppended':
      return {
        ...base, kind: 'response', agent_id: Number(args.agentId),
        data: { clientAddress: args.clientAddress, feedbackIndex: String(args.feedbackIndex), responder: args.responder, responseURI: args.responseURI, responseHash: args.responseHash },
      }
    default:
      return null
  }
}

// --- Agent upsert ---

type DB = ReturnType<typeof createClient>

async function upsertAgent(db: DB, event: ParsedEvent) {
  const agentKey = `${event.chain_id}:${event.agent_id}`
  const now = new Date().toISOString()

  if (event.kind === 'register') {
    await db.from('agents').upsert({
      id: agentKey, chain_id: event.chain_id, agent_id: event.agent_id,
      owner: event.data.owner as string, uri: event.data.agentURI as string,
      first_seen: now, last_seen: now, updated_at: now,
    }, { onConflict: 'id' })
  } else if (event.kind === 'uri_update') {
    await db.from('agents').upsert({
      id: agentKey, chain_id: event.chain_id, agent_id: event.agent_id,
      uri: event.data.newURI as string, last_seen: now, updated_at: now,
    }, { onConflict: 'id' })
  } else if (event.kind === 'feedback') {
    const { data: existing } = await db.from('agents').select('feedback_count, positive_count, negative_count').eq('id', agentKey).single()
    const value = Number(event.data.value ?? 0)
    await db.from('agents').upsert({
      id: agentKey, chain_id: event.chain_id, agent_id: event.agent_id,
      feedback_count: (existing?.feedback_count ?? 0) + 1,
      positive_count: (existing?.positive_count ?? 0) + (value > 0 ? 1 : 0),
      negative_count: (existing?.negative_count ?? 0) + (value < 0 ? 1 : 0),
      last_seen: now, updated_at: now,
    }, { onConflict: 'id' })
  }
}

// --- Signal Detection (M5) ---

type SignalResult = {
  chain_id: number
  agent_id: number
  signal_kind: string
  severity: string
  title: string
  description: string
  why_it_matters: string
  source_tx_hash: string | null
  metadata: Record<string, unknown>
}

async function detectSignals(
  db: DB,
  event: ParsedEvent
): Promise<SignalResult[]> {
  const signals: SignalResult[] = []
  const agentKey = `${event.chain_id}:${event.agent_id}`

  // Only detect signals for claimed agents
  const { data: owner } = await db
    .from('owner_profiles')
    .select('id')
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .maybeSingle()
  if (!owner) return signals

  // Get agent state
  const { data: agent } = await db
    .from('agents')
    .select('feedback_count, positive_count, negative_count')
    .eq('id', agentKey)
    .single()

  // Rule 1: First Interaction
  if (event.kind === 'feedback' && agent && agent.feedback_count === 1) {
    signals.push({
      chain_id: event.chain_id,
      agent_id: event.agent_id,
      signal_kind: 'first_interaction',
      severity: 'info',
      title: 'First Feedback',
      description: `Agent #${event.agent_id} received its first-ever feedback`,
      why_it_matters: 'Your agent is now visible to clients on the network.',
      source_tx_hash: event.tx_hash,
      metadata: {},
    })
  }

  // Rule 2: Validation Complete
  if (event.kind === 'validation_res') {
    signals.push({
      chain_id: event.chain_id,
      agent_id: event.agent_id,
      signal_kind: 'validation_complete',
      severity: 'info',
      title: 'Validation Complete',
      description: `A validator responded about Agent #${event.agent_id}`,
      why_it_matters: "Validator feedback affects your agent's trust score.",
      source_tx_hash: event.tx_hash,
      metadata: {},
    })
  }

  // Rule 3: Reputation Drop (negative ratio > 50%)
  if (event.kind === 'feedback' && agent && agent.feedback_count >= 3) {
    const negRatio = agent.negative_count / agent.feedback_count
    if (negRatio >= 0.5) {
      const severity = negRatio >= 0.8 ? 'critical' : 'warning'
      signals.push({
        chain_id: event.chain_id,
        agent_id: event.agent_id,
        signal_kind: 'reputation_drop',
        severity,
        title: 'Reputation Drop',
        description: `Agent #${event.agent_id} has ${Math.round(negRatio * 100)}% negative feedback`,
        why_it_matters: 'A high negative feedback ratio may indicate trust issues.',
        source_tx_hash: event.tx_hash,
        metadata: { positive: agent.positive_count, negative: agent.negative_count, total: agent.feedback_count },
      })
    }
  }

  // Rule 4: Feedback Spike (>5 feedbacks in last hour)
  if (event.kind === 'feedback') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await db
      .from('scope_events')
      .select('id', { count: 'exact', head: true })
      .eq('chain_id', event.chain_id)
      .eq('agent_id', event.agent_id)
      .eq('kind', 'feedback')
      .gte('created_at', oneHourAgo)
    if (count && count >= 5) {
      signals.push({
        chain_id: event.chain_id,
        agent_id: event.agent_id,
        signal_kind: 'feedback_spike',
        severity: 'info',
        title: 'Feedback Spike',
        description: `Agent #${event.agent_id} received ${count} feedbacks in the last hour`,
        why_it_matters: 'Unusual activity may indicate growing interest or coordinated behavior.',
        source_tx_hash: event.tx_hash,
        metadata: { count, window_hours: 1 },
      })
    }
  }

  // Rule 5: Sybil Cluster (>3 unique addresses in 1 hour)
  if (event.kind === 'feedback') {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentFeedbacks } = await db
      .from('scope_events')
      .select('data')
      .eq('chain_id', event.chain_id)
      .eq('agent_id', event.agent_id)
      .eq('kind', 'feedback')
      .gte('created_at', oneHourAgo)
    if (recentFeedbacks) {
      const addresses = new Set(recentFeedbacks.map((e: { data: { clientAddress?: string } }) => e.data.clientAddress).filter(Boolean))
      if (addresses.size >= 4) {
        signals.push({
          chain_id: event.chain_id,
          agent_id: event.agent_id,
          signal_kind: 'sybil_cluster',
          severity: 'critical',
          title: 'Sybil Pattern Detected',
          description: `${addresses.size} different addresses submitted feedback for Agent #${event.agent_id} in 1h`,
          why_it_matters: 'Coordinated feedback from multiple new accounts may indicate a sybil attack.',
          source_tx_hash: event.tx_hash,
          metadata: { unique_addresses: addresses.size, window_hours: 1 },
        })
      }
    }
  }

  return signals
}

async function insertIncidents(db: DB, signals: SignalResult[]) {
  if (signals.length === 0) return
  const { error } = await db
    .from('incidents')
    .upsert(signals, { onConflict: 'chain_id,agent_id,signal_kind,source_tx_hash', ignoreDuplicates: true })
  if (error) console.error('Incident insert error:', error.message)
}

async function dispatchWebhooks(db: DB, signals: SignalResult[]) {
  for (const signal of signals) {
    // Only dispatch for alertable signal types
    const alertKind = signal.signal_kind === 'reputation_drop' ? 'reputation_drop'
      : signal.signal_kind === 'sybil_cluster' ? 'sybil_detected'
      : null
    if (!alertKind) continue

    const { data: rules } = await db
      .from('alert_rules')
      .select('id, webhook_url')
      .eq('chain_id', signal.chain_id)
      .eq('agent_id', signal.agent_id)
      .eq('rule_type', alertKind)
      .eq('enabled', true)
      .not('webhook_url', 'is', null)

    if (!rules) continue

    for (const rule of rules) {
      if (!rule.webhook_url) continue
      const payload = {
        incident: {
          signalKind: signal.signal_kind,
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          whyItMatters: signal.why_it_matters,
        },
        agent: { chainId: signal.chain_id, agentId: signal.agent_id },
        timestamp: new Date().toISOString(),
        consoleUrl: `https://denscope.vercel.app/console`,
      }

      try {
        const res = await fetch(rule.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        await db.from('webhook_logs').insert({
          incident_id: null,
          webhook_url: rule.webhook_url,
          request_payload: payload,
          response_status: res.status,
        })
      } catch (err) {
        await db.from('webhook_logs').insert({
          incident_id: null,
          webhook_url: rule.webhook_url,
          request_payload: payload,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
}

// --- Trust Score Computation (M6) ---

function computeTrustScoreInline(
  feedbackCount: number,
  positiveCount: number,
  negativeCount: number,
  firstSeen: string | null,
  lastSeen: string | null,
  openCritical: number,
  openWarning: number,
  hasSybil: boolean,
): { score: number; positiveRatio: number; activityScore: number; ageScore: number; incidentPenalty: number; confidence: string } {
  if (feedbackCount === 0) {
    return { score: 0, positiveRatio: 0, activityScore: 0, ageScore: 0, incidentPenalty: 0, confidence: 'low' }
  }

  const positiveRatio = positiveCount / feedbackCount

  let ageScore = 0
  if (firstSeen) {
    const ageDays = (Date.now() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000)
    ageScore = Math.min(ageDays / 90, 1.0)
  }

  let activityScore = 0
  if (firstSeen && lastSeen) {
    const activeDays = Math.max(
      (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (24 * 60 * 60 * 1000),
      1
    )
    activityScore = Math.min(feedbackCount / (activeDays * 2), 1.0)
  }

  const incidentPenalty = Math.min(openCritical * 0.15 + openWarning * 0.05, 1.0)
  const sybilPenalty = hasSybil ? 1.0 : 0.0

  const rawScore =
    0.40 * positiveRatio +
    0.20 * ageScore +
    0.20 * activityScore -
    0.10 * incidentPenalty -
    0.10 * sybilPenalty

  const score = Math.round(Math.max(0, Math.min(100, rawScore * 100)))
  const confidence = feedbackCount >= 10 ? 'high' : feedbackCount >= 3 ? 'medium' : 'low'

  return {
    score,
    positiveRatio: Math.round(positiveRatio * 10000) / 10000,
    activityScore: Math.round(activityScore * 10000) / 10000,
    ageScore: Math.round(ageScore * 10000) / 10000,
    incidentPenalty: Math.round(incidentPenalty * 10000) / 10000,
    confidence,
  }
}

async function updateTrustScore(db: DB, event: ParsedEvent) {
  const agentKey = `${event.chain_id}:${event.agent_id}`

  const { data: agent } = await db
    .from('agents')
    .select('feedback_count, positive_count, negative_count, first_seen, last_seen')
    .eq('id', agentKey)
    .single()
  if (!agent) return

  const { count: openCritical } = await db
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .eq('severity', 'critical')
    .is('resolved_at', null)

  const { count: openWarning } = await db
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .eq('severity', 'warning')
    .is('resolved_at', null)

  const { count: sybilCount } = await db
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('chain_id', event.chain_id)
    .eq('agent_id', event.agent_id)
    .eq('signal_kind', 'sybil_cluster')
    .is('resolved_at', null)

  const computed = computeTrustScoreInline(
    agent.feedback_count,
    agent.positive_count,
    agent.negative_count,
    agent.first_seen,
    agent.last_seen,
    openCritical ?? 0,
    openWarning ?? 0,
    (sybilCount ?? 0) > 0,
  )

  const openIncidents = (openCritical ?? 0) + (openWarning ?? 0)

  await db.from('trust_scores').upsert({
    id: agentKey,
    chain_id: event.chain_id,
    agent_id: event.agent_id,
    score: computed.score,
    positive_ratio: computed.positiveRatio,
    activity_score: computed.activityScore,
    age_score: computed.ageScore,
    incident_penalty: computed.incidentPenalty,
    feedback_count: agent.feedback_count,
    positive_count: agent.positive_count,
    negative_count: agent.negative_count,
    open_incidents: openIncidents,
    confidence: computed.confidence,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'chain_id,agent_id' })
}

// --- Poll one chain ---

async function pollChain(db: DB, chain: typeof CHAINS[number]) {
  const client = createPublicClient({
    chain: VIEM_CHAINS[chain.id],
    transport: http(chain.rpc),
  })

  const { data: cursor } = await db.from('indexer_cursors').select('last_block').eq('chain_id', chain.id).single()
  if (!cursor) return { events: 0, fromBlock: 0, toBlock: 0 }

  const fromBlock = cursor.last_block + 1
  const latestBlock = Number(await client.getBlockNumber())
  if (fromBlock > latestBlock) return { events: 0, fromBlock, toBlock: latestBlock }

  const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock)

  const [identityLogs, reputationLogs] = await Promise.all([
    client.getContractEvents({ address: chain.identity, abi: identityRegistryAbi, fromBlock: BigInt(fromBlock), toBlock: BigInt(toBlock) }),
    client.getContractEvents({ address: chain.reputation, abi: reputationRegistryAbi, fromBlock: BigInt(fromBlock), toBlock: BigInt(toBlock) }),
  ])

  const events: ParsedEvent[] = []
  for (const log of identityLogs) { const p = parseIdentityLog(log as Log, chain.id); if (p) events.push(p) }
  for (const log of reputationLogs) { const p = parseReputationLog(log as Log, chain.id); if (p) events.push(p) }

  if (events.length > 0) {
    const { error } = await db.from('scope_events').upsert(events, { onConflict: 'chain_id,tx_hash,log_index', ignoreDuplicates: true })
    if (error) console.error(`[${chain.name}] Insert error:`, error.message)
    for (const e of events) await upsertAgent(db, e)

    // M5: Signal detection + webhook dispatch
    for (const e of events) {
      const signals = await detectSignals(db, e)
      await insertIncidents(db, signals)
      await dispatchWebhooks(db, signals)
    }

    // M6: Update trust score
    for (const e of events) {
      await updateTrustScore(db, e)
    }
  }

  await db.from('indexer_cursors').upsert({
    chain_id: chain.id, last_block: toBlock, last_block_hash: '', last_log_index: 0, updated_at: new Date().toISOString(),
  }, { onConflict: 'chain_id' })

  return { events: events.length, fromBlock, toBlock }
}

// --- HTTP Handler ---

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const results: Record<string, unknown> = {}

  for (const chain of CHAINS) {
    try {
      const result = await pollChain(db, chain)
      results[chain.name] = result
      if (result.events > 0) {
        console.log(`[${chain.name}] ${result.events} events (blocks ${result.fromBlock}..${result.toBlock})`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[${chain.name}] Error:`, msg)
      results[chain.name] = { error: msg }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, ts: new Date().toISOString(), results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
