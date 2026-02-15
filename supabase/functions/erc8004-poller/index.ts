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
    event_timestamp: null,
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
    event_timestamp: null,
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
