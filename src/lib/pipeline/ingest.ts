// src/lib/pipeline/ingest.ts
import type { ChainConfig } from '@/config/chains'
import { identityRegistryAbi, reputationRegistryAbi } from '@/config/contracts'
import { createChainClient } from './client'
import { parseIdentityLog, parseReputationLog } from './parse'
import { createDeduplicator } from './reconcile'
import { createCursorStore } from '@/lib/cache/idb'
import { useEventStore } from '@/stores/events'
import { useAgentStore } from '@/stores/agents'
import { useGraphStore } from '@/stores/graph'
import type { ScopeEvent, FeedbackData } from '@/types/events'
import { CURSOR_SAVE_INTERVAL_MS } from '@/config/constants'
import { runDiscoveryRules } from '@/lib/discovery/engine'

export type PipelineHandle = {
  stop: () => void
  status: () => 'running' | 'stopped'
}

export async function startPipeline(chain: ChainConfig): Promise<PipelineHandle> {
  const client = createChainClient(chain)
  const cursorStore = createCursorStore()
  const dedup = createDeduplicator()
  let running = true

  function processEvent(event: ScopeEvent) {
    if (!dedup.isNew(event)) return
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

  // Paginated backfill with getLogs
  async function backfill(fromBlock: bigint, toBlock: bigint) {
    for (let start = fromBlock; start <= toBlock; start += BigInt(chain.backfillChunkSize)) {
      if (!running) return
      const end = start + BigInt(chain.backfillChunkSize) - BigInt(1) > toBlock
        ? toBlock
        : start + BigInt(chain.backfillChunkSize) - BigInt(1)

      const [identityLogs, reputationLogs] = await Promise.all([
        client.getContractEvents({
          address: chain.contracts.identity,
          abi: identityRegistryAbi,
          fromBlock: start,
          toBlock: end,
        }),
        client.getContractEvents({
          address: chain.contracts.reputation,
          abi: reputationRegistryAbi,
          fromBlock: start,
          toBlock: end,
        }),
      ])

      for (const log of identityLogs) {
        const event = parseIdentityLog(log as never, chain.id)
        if (event) processEvent(event)
      }
      for (const log of reputationLogs) {
        const event = parseReputationLog(log as never, chain.id)
        if (event) processEvent(event)
      }
    }
  }

  // Boot sequence
  const latestBlock = await client.getBlockNumber()
  const safeBlock = latestBlock - BigInt(chain.confirmations)

  const savedCursor = await cursorStore.getCursor(chain.id)
  let startBlock: bigint

  if (savedCursor) {
    try {
      const block = await client.getBlock({ blockNumber: BigInt(savedCursor.lastBlock) })
      if (block.hash === savedCursor.lastBlockHash) {
        startBlock = BigInt(savedCursor.lastBlock) + BigInt(1)
      } else {
        // Reorg detected
        startBlock = BigInt(Math.max(0, savedCursor.lastBlock - 200))
      }
    } catch {
      startBlock = safeBlock - BigInt(chain.backfillWindow)
    }
  } else {
    startBlock = safeBlock - BigInt(chain.backfillWindow)
    if (startBlock < BigInt(0)) startBlock = BigInt(0)
  }

  await backfill(startBlock, safeBlock)

  // Save cursor after backfill
  const latestSafeBlock = await client.getBlock({ blockNumber: safeBlock })
  await cursorStore.saveCursor({
    chainId: chain.id,
    lastBlock: Number(safeBlock),
    lastBlockHash: latestSafeBlock.hash ?? '',
    lastLogIndex: 0,
    timestamp: Date.now(),
  })

  // Realtime tail
  const unwatchIdentity = client.watchContractEvent({
    address: chain.contracts.identity,
    abi: identityRegistryAbi,
    poll: true,
    pollingInterval: chain.pollingInterval,
    onLogs: (logs) => {
      for (const log of logs) {
        const event = parseIdentityLog(log as never, chain.id)
        if (event) { event.timestamp = Date.now(); processEvent(event) }
      }
    },
  })

  const unwatchReputation = client.watchContractEvent({
    address: chain.contracts.reputation,
    abi: reputationRegistryAbi,
    poll: true,
    pollingInterval: chain.pollingInterval,
    onLogs: (logs) => {
      for (const log of logs) {
        const event = parseReputationLog(log as never, chain.id)
        if (event) { event.timestamp = Date.now(); processEvent(event) }
      }
    },
  })

  // Periodic cursor save
  const cursorInterval = setInterval(async () => {
    if (!running) return
    try {
      const block = await client.getBlock()
      await cursorStore.saveCursor({
        chainId: chain.id,
        lastBlock: Number(block.number),
        lastBlockHash: block.hash ?? '',
        lastLogIndex: 0,
        timestamp: Date.now(),
      })
    } catch { /* silent */ }
  }, CURSOR_SAVE_INTERVAL_MS)

  return {
    stop: () => {
      running = false
      unwatchIdentity()
      unwatchReputation()
      clearInterval(cursorInterval)
    },
    status: () => (running ? 'running' : 'stopped'),
  }
}
