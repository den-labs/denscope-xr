import { supabase } from './client'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'
import { useGraphStore } from '@/stores/graph'
import { runDiscoveryRules } from '@/lib/discovery/engine'
import type { ScopeEvent, FeedbackData } from '@/types/events'
import type { EventKind } from '@/types/events'
import type { GraphNode, TrustEdge } from '@/types/graph'

type DbEvent = {
  chain_id: number
  agent_id: number
  kind: string
  block_number: number
  tx_hash: string
  log_index: number
  data: Record<string, unknown>
  event_timestamp: string | null
}

function parseBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    return BigInt(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return undefined
    try {
      return BigInt(trimmed)
    } catch {
      return undefined
    }
  }
  return undefined
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function normalizeData(kind: EventKind, data: Record<string, unknown>): ScopeEvent['data'] {
  if (kind === 'feedback') {
    return {
      ...data,
      clientAddress: typeof data.clientAddress === 'string' ? data.clientAddress : '',
      feedbackIndex: parseBigInt(data.feedbackIndex) ?? BigInt(0),
      value: parseBigInt(data.value) ?? BigInt(0),
      valueDecimals: parseNumber(data.valueDecimals) ?? 0,
    } as ScopeEvent['data']
  }

  if (kind === 'feedback_revoked' || kind === 'response') {
    return {
      ...data,
      feedbackIndex: parseBigInt(data.feedbackIndex) ?? BigInt(0),
    } as ScopeEvent['data']
  }

  return data as ScopeEvent['data']
}

function toScopeEvent(row: DbEvent): ScopeEvent {
  const kind = row.kind as EventKind
  return {
    chainId: row.chain_id,
    agentId: row.agent_id,
    kind,
    block: row.block_number,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    data: normalizeData(kind, row.data),
    timestamp: row.event_timestamp ? new Date(row.event_timestamp).getTime() : undefined,
  }
}

function processEvent(event: ScopeEvent) {
  useEventStore.getState().push(event)
  useAgentStore.getState().upsertFromEvent(event)

  if (event.kind === 'feedback') {
    const data = event.data as FeedbackData
    useGraphStore.getState().addEdge({
      source: `${event.chainId}:${data.clientAddress}`,
      target: `${event.chainId}:${event.agentId}`,
      kind: 'feedback',
      value: Number(data.value),
      timestamp: event.timestamp,
      ts: event.timestamp,
      txHash: event.txHash,
      logIndex: event.logIndex,
      eventId: `${event.txHash}:${event.logIndex}:feedback`,
    })
  }

  useGraphStore.getState().addNode({
    id: `${event.chainId}:${event.agentId}`,
    agentId: event.agentId,
    chainId: event.chainId,
    label: `Agent #${event.agentId}`,
    feedbackCount: useAgentStore.getState().agents.get(`${event.chainId}:${event.agentId}`)?.feedbackCount ?? 0,
  })

  runDiscoveryRules(event)
}

/** Fetch historical events from Supabase and populate stores.
 *  When chainId is provided, only events for that chain are fetched. */
export async function fetchHistoricalEvents(chainId?: number | null): Promise<number> {
  if (!supabase) return 0

  let query = supabase
    .from('scope_events')
    .select('*')
  if (chainId != null) query = query.eq('chain_id', chainId)
  const { data, error } = await query
    .order('event_timestamp', { ascending: false, nullsFirst: false })
    .limit(5000)

  if (error || !data) {
    console.error('Failed to fetch historical events:', error?.message)
    return 0
  }

  // Reverse so events are processed oldest-first (chronological order).
  // Discovery rules depend on this (e.g., first_blood on the actual first
  // feedback). Store writes are batched at the end so the backfill stays
  // O(n) instead of the O(n^2) the per-event path created.
  const rows = (data as DbEvent[]).reverse()
  const events: ScopeEvent[] = rows.map(toScopeEvent)

  // Discovery rules need to see state at each step, so mutate the agent store
  // incrementally via the batch method (one clone of the Map for the whole
  // backfill) and run rules per event.
  useAgentStore.getState().upsertFromEvents(events)

  const graphNodes: GraphNode[] = []
  const graphEdges: TrustEdge[] = []
  const seenNodes = new Set<string>()

  for (const event of events) {
    const nodeId = `${event.chainId}:${event.agentId}`
    if (!seenNodes.has(nodeId)) {
      seenNodes.add(nodeId)
      graphNodes.push({
        id: nodeId,
        agentId: event.agentId,
        chainId: event.chainId,
        label: `Agent #${event.agentId}`,
        feedbackCount: useAgentStore.getState().agents.get(nodeId)?.feedbackCount ?? 0,
      })
    }
    if (event.kind === 'feedback') {
      const data = event.data as FeedbackData
      graphEdges.push({
        source: `${event.chainId}:${data.clientAddress}`,
        target: nodeId,
        kind: 'feedback',
        value: Number(data.value),
        timestamp: event.timestamp,
        ts: event.timestamp,
        txHash: event.txHash,
        logIndex: event.logIndex,
        eventId: `${event.txHash}:${event.logIndex}:feedback`,
      })
    }
  }

  useGraphStore.getState().addBatch({ nodes: graphNodes, edges: graphEdges })
  useEventStore.getState().pushBatch(events)

  for (const event of events) {
    runDiscoveryRules(event)
  }

  return data.length
}

/** Fetch events for a specific agent from Supabase */
export async function fetchAgentEvents(chainId: number, agentId: number): Promise<ScopeEvent[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('scope_events')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .order('block_number', { ascending: false })
    .limit(50)

  if (error || !data) {
    console.error('Failed to fetch agent events:', error?.message)
    return []
  }

  return (data as DbEvent[]).map(toScopeEvent)
}

/** Subscribe to realtime inserts on scope_events.
 *  When chainId is provided, only inserts for that chain are received. */
export function subscribeToEvents(chainId?: number | null): (() => void) | null {
  if (!supabase) return null

  const channelName = chainId != null
    ? `scope_events_realtime_${chainId}`
    : 'scope_events_realtime'

  const pgFilter: { event: 'INSERT'; schema: 'public'; table: 'scope_events'; filter?: string } = {
    event: 'INSERT',
    schema: 'public',
    table: 'scope_events',
  }
  if (chainId != null) pgFilter.filter = `chain_id=eq.${chainId}`

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', pgFilter, (payload) => {
      const row = payload.new as DbEvent
      const event = toScopeEvent(row)
      event.timestamp = Date.now()
      processEvent(event)
    })
    .subscribe()

  return () => { supabase!.removeChannel(channel) }
}
