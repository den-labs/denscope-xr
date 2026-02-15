import type { ScopeEvent } from '@/types/events'

type RawLog = {
  eventName: string
  args: Record<string, unknown>
  blockNumber: bigint
  transactionHash: string
  logIndex: number
}

/**
 * Parse a raw viem log from the Identity contract into a typed ScopeEvent.
 * Handles: Registered, URIUpdated, MetadataSet.
 * Returns null for unrecognized event names.
 */
export function parseIdentityLog(
  log: RawLog,
  chainId: number,
): ScopeEvent | null {
  const base = {
    chainId,
    block: Number(log.blockNumber),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  }

  switch (log.eventName) {
    case 'Registered':
      return {
        ...base,
        kind: 'register',
        agentId: Number(log.args.agentId as bigint),
        data: {
          agentURI: log.args.agentURI as string,
          owner: log.args.owner as string,
        },
      }
    case 'URIUpdated':
      return {
        ...base,
        kind: 'uri_update',
        agentId: Number(log.args.agentId as bigint),
        data: {
          newURI: log.args.newURI as string,
          updatedBy: log.args.updatedBy as string,
        },
      }
    case 'MetadataSet':
      return {
        ...base,
        kind: 'metadata',
        agentId: Number(log.args.agentId as bigint),
        data: {
          metadataKey: log.args.metadataKey as string,
          metadataValue: log.args.metadataValue as string,
        },
      }
    default:
      return null
  }
}

/**
 * Parse a raw viem log from the Reputation contract into a typed ScopeEvent.
 * Handles: NewFeedback, FeedbackRevoked, ResponseAppended.
 * Returns null for unrecognized event names.
 */
export function parseReputationLog(
  log: RawLog,
  chainId: number,
): ScopeEvent | null {
  const base = {
    chainId,
    block: Number(log.blockNumber),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  }

  switch (log.eventName) {
    case 'NewFeedback':
      return {
        ...base,
        kind: 'feedback',
        agentId: Number(log.args.agentId as bigint),
        data: {
          clientAddress: log.args.clientAddress as string,
          feedbackIndex: log.args.feedbackIndex as bigint,
          value: log.args.value as bigint,
          valueDecimals: log.args.valueDecimals as number,
          tag1: log.args.tag1 as string,
          tag2: log.args.tag2 as string,
          endpoint: log.args.endpoint as string,
          feedbackURI: log.args.feedbackURI as string,
          feedbackHash: log.args.feedbackHash as string,
        },
      }
    case 'FeedbackRevoked':
      return {
        ...base,
        kind: 'feedback_revoked',
        agentId: Number(log.args.agentId as bigint),
        data: {
          clientAddress: log.args.clientAddress as string,
          feedbackIndex: log.args.feedbackIndex as bigint,
        },
      }
    case 'ResponseAppended':
      return {
        ...base,
        kind: 'response',
        agentId: Number(log.args.agentId as bigint),
        data: {
          clientAddress: log.args.clientAddress as string,
          feedbackIndex: log.args.feedbackIndex as bigint,
          responder: log.args.responder as string,
          responseURI: log.args.responseURI as string,
          responseHash: log.args.responseHash as string,
        },
      }
    default:
      return null
  }
}
