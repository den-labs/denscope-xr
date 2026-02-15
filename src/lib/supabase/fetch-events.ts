import { supabase } from './client'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'
import { useGraphStore } from '@/stores/graph'
import type { ScopeEvent, FeedbackData } from '@/types/events'
import type { EventKind } from '@/types/events'

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

function toScopeEvent(row: DbEvent): ScopeEvent {
  return {
    chainId: row.chain_id,
    agentId: row.agent_id,
    kind: row.kind as EventKind,
    block: row.block_number,
    txHash: row.tx_hash,
    logIndex: row.log_index,
    data: row.data as ScopeEvent['data'],
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
    })
  }

  useGraphStore.getState().addNode({
    id: `${event.chainId}:${event.agentId}`,
    agentId: event.agentId,
    chainId: event.chainId,
    label: `Agent #${event.agentId}`,
    feedbackCount: useAgentStore.getState().agents.get(`${event.chainId}:${event.agentId}`)?.feedbackCount ?? 0,
  })
}

/** Fetch all historical events from Supabase and populate stores */
export async function fetchHistoricalEvents(): Promise<number> {
  if (!supabase) return 0

  const { data, error } = await supabase
    .from('scope_events')
    .select('*')
    .order('block_number', { ascending: true })
    .limit(5000)

  if (error || !data) {
    console.error('Failed to fetch historical events:', error?.message)
    return 0
  }

  for (const row of data as DbEvent[]) {
    processEvent(toScopeEvent(row))
  }

  return data.length
}

/** Subscribe to realtime inserts on scope_events */
export function subscribeToEvents(): (() => void) | null {
  if (!supabase) return null

  const channel = supabase
    .channel('scope_events_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'scope_events' },
      (payload) => {
        const row = payload.new as DbEvent
        const event = toScopeEvent(row)
        event.timestamp = Date.now()
        processEvent(event)
      },
    )
    .subscribe()

  return () => { supabase!.removeChannel(channel) }
}
