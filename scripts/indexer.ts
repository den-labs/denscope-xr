/**
 * DenScope Indexer
 *
 * Backfills all historical ERC-8004 events from deploy block to now,
 * then enters realtime sync mode. Writes to Supabase.
 *
 * Usage:
 *   pnpm run indexer              # backfill + sync
 *   pnpm run indexer:backfill     # one-shot backfill only
 */
import 'dotenv/config'
import { createPublicClient, http, type Log } from 'viem'
import { celo, celoSepolia } from 'viem/chains'
import { createClient } from '@supabase/supabase-js'
// Use relative imports (tsx doesn't resolve @/ paths)
import { identityRegistryAbi, reputationRegistryAbi } from '../src/config/contracts'
import { chains, type ChainConfig } from '../src/config/chains'

// --- Config ---

const CHUNK_SIZE = 2000  // large chunks OK for Forno (indexer uses public RPC, not Alchemy)
const SYNC_INTERVAL_MS = 10_000
const BATCH_INSERT_SIZE = 500

const DEPLOY_BLOCKS: Record<number, number> = {
  42220: 58396724,
  11142220: 17013547,
}

const VIEM_CHAINS: Record<number, typeof celo> = {
  42220: celo,
  11142220: celoSepolia,
}

// Use public RPCs for the indexer (no Alchemy limits)
const INDEXER_RPCS: Record<number, string> = {
  42220: 'https://forno.celo.org',
  11142220: 'https://forno.celo-sepolia.celo-testnet.org',
}

// --- Supabase ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(supabaseUrl, serviceRoleKey)

// --- Parsing (mirrors src/lib/pipeline/parse.ts) ---

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

function parseIdentityLog(log: Log, chainId: number): ParsedEvent | null {
  const args = (log as unknown as { eventName: string; args: Record<string, unknown> })
  const base = {
    chain_id: chainId,
    block_number: Number(log.blockNumber),
    tx_hash: log.transactionHash!,
    log_index: log.logIndex!,
    event_timestamp: null,
  }

  switch (args.eventName) {
    case 'Registered':
      return { ...base, kind: 'register', agent_id: Number(args.args.agentId), data: { agentURI: args.args.agentURI, owner: args.args.owner } }
    case 'URIUpdated':
      return { ...base, kind: 'uri_update', agent_id: Number(args.args.agentId), data: { newURI: args.args.newURI, updatedBy: args.args.updatedBy } }
    case 'MetadataSet':
      return { ...base, kind: 'metadata', agent_id: Number(args.args.agentId), data: { metadataKey: args.args.metadataKey, metadataValue: args.args.metadataValue } }
    default:
      return null
  }
}

function parseReputationLog(log: Log, chainId: number): ParsedEvent | null {
  const args = (log as unknown as { eventName: string; args: Record<string, unknown> })
  const base = {
    chain_id: chainId,
    block_number: Number(log.blockNumber),
    tx_hash: log.transactionHash!,
    log_index: log.logIndex!,
    event_timestamp: null,
  }

  switch (args.eventName) {
    case 'NewFeedback':
      return {
        ...base, kind: 'feedback', agent_id: Number(args.args.agentId),
        data: {
          clientAddress: args.args.clientAddress,
          feedbackIndex: String(args.args.feedbackIndex),
          value: String(args.args.value),
          valueDecimals: args.args.valueDecimals,
          tag1: args.args.tag1, tag2: args.args.tag2,
          endpoint: args.args.endpoint,
          feedbackURI: args.args.feedbackURI,
          feedbackHash: args.args.feedbackHash,
        },
      }
    case 'FeedbackRevoked':
      return {
        ...base, kind: 'feedback_revoked', agent_id: Number(args.args.agentId),
        data: { clientAddress: args.args.clientAddress, feedbackIndex: String(args.args.feedbackIndex) },
      }
    case 'ResponseAppended':
      return {
        ...base, kind: 'response', agent_id: Number(args.args.agentId),
        data: {
          clientAddress: args.args.clientAddress, feedbackIndex: String(args.args.feedbackIndex),
          responder: args.args.responder, responseURI: args.args.responseURI, responseHash: args.args.responseHash,
        },
      }
    default:
      return null
  }
}

// --- Agent upsert ---

async function upsertAgent(event: ParsedEvent) {
  const agentKey = `${event.chain_id}:${event.agent_id}`
  const now = new Date().toISOString()

  if (event.kind === 'register') {
    await db.from('agents').upsert({
      id: agentKey,
      chain_id: event.chain_id,
      agent_id: event.agent_id,
      owner: event.data.owner as string,
      uri: event.data.agentURI as string,
      first_seen: now,
      last_seen: now,
      updated_at: now,
    }, { onConflict: 'id' })
  } else if (event.kind === 'uri_update') {
    await db.from('agents').upsert({
      id: agentKey,
      chain_id: event.chain_id,
      agent_id: event.agent_id,
      uri: event.data.newURI as string,
      last_seen: now,
      updated_at: now,
    }, { onConflict: 'id' })
  } else if (event.kind === 'feedback') {
    // Increment feedback count
    const { data: existing } = await db.from('agents').select('feedback_count, positive_count, negative_count').eq('id', agentKey).single()
    const value = Number(event.data.value ?? 0)
    const fc = (existing?.feedback_count ?? 0) + 1
    const pc = (existing?.positive_count ?? 0) + (value > 0 ? 1 : 0)
    const nc = (existing?.negative_count ?? 0) + (value < 0 ? 1 : 0)

    await db.from('agents').upsert({
      id: agentKey,
      chain_id: event.chain_id,
      agent_id: event.agent_id,
      feedback_count: fc,
      positive_count: pc,
      negative_count: nc,
      last_seen: now,
      updated_at: now,
    }, { onConflict: 'id' })
  }
}

// --- Core indexing ---

async function indexChain(chain: ChainConfig, onlyBackfill: boolean) {
  const rpcUrl = INDEXER_RPCS[chain.id] ?? chain.rpc.http
  const client = createPublicClient({
    chain: VIEM_CHAINS[chain.id],
    transport: http(rpcUrl),
  })

  console.log(`[${chain.name}] Starting indexer (RPC: ${rpcUrl})`)

  // Determine start block
  const { data: cursor } = await db.from('indexer_cursors').select('*').eq('chain_id', chain.id).single()
  const deployBlock = DEPLOY_BLOCKS[chain.id] ?? 0
  let fromBlock = cursor ? cursor.last_block + 1 : deployBlock

  const latestBlock = Number(await client.getBlockNumber())
  console.log(`[${chain.name}] From block ${fromBlock} to ${latestBlock} (${latestBlock - fromBlock} blocks)`)

  // Backfill loop
  let totalEvents = 0
  for (let start = fromBlock; start <= latestBlock; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, latestBlock)
    const progress = ((start - fromBlock) / (latestBlock - fromBlock) * 100).toFixed(1)
    process.stdout.write(`\r[${chain.name}] Backfill ${progress}% — blocks ${start}..${end}`)

    try {
      const [identityLogs, reputationLogs] = await Promise.all([
        client.getContractEvents({
          address: chain.contracts.identity,
          abi: identityRegistryAbi,
          fromBlock: BigInt(start),
          toBlock: BigInt(end),
        }),
        client.getContractEvents({
          address: chain.contracts.reputation,
          abi: reputationRegistryAbi,
          fromBlock: BigInt(start),
          toBlock: BigInt(end),
        }),
      ])

      const events: ParsedEvent[] = []
      for (const log of identityLogs) {
        const parsed = parseIdentityLog(log as Log, chain.id)
        if (parsed) events.push(parsed)
      }
      for (const log of reputationLogs) {
        const parsed = parseReputationLog(log as Log, chain.id)
        if (parsed) events.push(parsed)
      }

      // Batch insert events
      if (events.length > 0) {
        for (let i = 0; i < events.length; i += BATCH_INSERT_SIZE) {
          const batch = events.slice(i, i + BATCH_INSERT_SIZE)
          const { error } = await db.from('scope_events').upsert(batch, { onConflict: 'chain_id,tx_hash,log_index', ignoreDuplicates: true })
          if (error) console.error(`\n[${chain.name}] Insert error:`, error.message)
        }

        // Upsert agents
        for (const event of events) {
          await upsertAgent(event)
        }

        totalEvents += events.length
      }

      // Save cursor
      await db.from('indexer_cursors').upsert({
        chain_id: chain.id,
        last_block: end,
        last_block_hash: '',
        last_log_index: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chain_id' })

    } catch (err) {
      console.error(`\n[${chain.name}] Error at blocks ${start}..${end}:`, (err as Error).message)
      // Wait and retry
      await sleep(5000)
      start -= CHUNK_SIZE // retry this chunk
    }
  }

  console.log(`\n[${chain.name}] Backfill complete. ${totalEvents} events indexed.`)

  if (onlyBackfill) return

  // Realtime sync loop
  console.log(`[${chain.name}] Entering sync mode (every ${SYNC_INTERVAL_MS / 1000}s)`)
  while (true) {
    await sleep(SYNC_INTERVAL_MS)
    try {
      const { data: cur } = await db.from('indexer_cursors').select('last_block').eq('chain_id', chain.id).single()
      const syncFrom = (cur?.last_block ?? latestBlock) + 1
      const syncTo = Number(await client.getBlockNumber())
      if (syncFrom > syncTo) continue

      const [iLogs, rLogs] = await Promise.all([
        client.getContractEvents({
          address: chain.contracts.identity,
          abi: identityRegistryAbi,
          fromBlock: BigInt(syncFrom),
          toBlock: BigInt(syncTo),
        }),
        client.getContractEvents({
          address: chain.contracts.reputation,
          abi: reputationRegistryAbi,
          fromBlock: BigInt(syncFrom),
          toBlock: BigInt(syncTo),
        }),
      ])

      const events: ParsedEvent[] = []
      for (const log of iLogs) { const p = parseIdentityLog(log as Log, chain.id); if (p) events.push(p) }
      for (const log of rLogs) { const p = parseReputationLog(log as Log, chain.id); if (p) events.push(p) }

      if (events.length > 0) {
        await db.from('scope_events').upsert(events, { onConflict: 'chain_id,tx_hash,log_index', ignoreDuplicates: true })
        for (const e of events) await upsertAgent(e)
        console.log(`[${chain.name}] Synced ${events.length} events (blocks ${syncFrom}..${syncTo})`)
      }

      await db.from('indexer_cursors').upsert({
        chain_id: chain.id,
        last_block: syncTo,
        last_block_hash: '',
        last_log_index: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chain_id' })

    } catch (err) {
      console.error(`[${chain.name}] Sync error:`, (err as Error).message)
    }
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// --- Main ---

const onlyBackfill = process.argv.includes('--backfill-only')

console.log('DenScope Indexer')
console.log(`Mode: ${onlyBackfill ? 'backfill only' : 'backfill + sync'}`)
console.log(`Chains: ${chains.map(c => c.name).join(', ')}`)
console.log('---')

Promise.all(chains.map(chain => indexChain(chain, onlyBackfill)))
  .then(() => {
    if (onlyBackfill) {
      console.log('\nBackfill complete for all chains.')
      process.exit(0)
    }
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
