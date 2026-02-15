// src/lib/pipeline/__tests__/parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseIdentityLog, parseReputationLog } from '../parse'

describe('parseIdentityLog', () => {
  it('parses a Registered event', () => {
    const result = parseIdentityLog({
      eventName: 'Registered',
      args: { agentId: 1n, agentURI: 'https://example.com/a.json', owner: '0xabc' },
      blockNumber: 1000n,
      transactionHash: '0xdef',
      logIndex: 0,
    }, 44787)

    expect(result).toEqual({
      chainId: 44787, block: 1000, txHash: '0xdef', logIndex: 0,
      kind: 'register', agentId: 1,
      data: { agentURI: 'https://example.com/a.json', owner: '0xabc' },
    })
  })

  it('parses a URIUpdated event', () => {
    const result = parseIdentityLog({
      eventName: 'URIUpdated',
      args: { agentId: 2n, newURI: 'ipfs://Qm...', updatedBy: '0x123' },
      blockNumber: 1001n,
      transactionHash: '0xghi',
      logIndex: 1,
    }, 44787)

    expect(result).toEqual({
      chainId: 44787, block: 1001, txHash: '0xghi', logIndex: 1,
      kind: 'uri_update', agentId: 2,
      data: { newURI: 'ipfs://Qm...', updatedBy: '0x123' },
    })
  })

  it('parses a MetadataSet event', () => {
    const result = parseIdentityLog({
      eventName: 'MetadataSet',
      args: { agentId: 3n, metadataKey: 'description', metadataValue: 'An AI agent' },
      blockNumber: 1002n,
      transactionHash: '0xjkl',
      logIndex: 2,
    }, 44787)

    expect(result).toEqual({
      chainId: 44787, block: 1002, txHash: '0xjkl', logIndex: 2,
      kind: 'metadata', agentId: 3,
      data: { metadataKey: 'description', metadataValue: 'An AI agent' },
    })
  })

  it('returns null for unknown event', () => {
    const result = parseIdentityLog({
      eventName: 'Unknown', args: {},
      blockNumber: 1000n, transactionHash: '0x1', logIndex: 0,
    }, 44787)
    expect(result).toBeNull()
  })
})

describe('parseReputationLog', () => {
  it('parses a NewFeedback event', () => {
    const result = parseReputationLog({
      eventName: 'NewFeedback',
      args: {
        agentId: 1n, clientAddress: '0xabc', feedbackIndex: 0n,
        value: 92n, valueDecimals: 0, indexedTag1: 'starred',
        tag1: 'starred', tag2: '', endpoint: '',
        feedbackURI: '', feedbackHash: '0x0000',
      },
      blockNumber: 1002n, transactionHash: '0xjkl', logIndex: 2,
    }, 44787)

    expect(result?.kind).toBe('feedback')
    expect(result?.agentId).toBe(1)
    expect(result).toEqual({
      chainId: 44787, block: 1002, txHash: '0xjkl', logIndex: 2,
      kind: 'feedback', agentId: 1,
      data: {
        clientAddress: '0xabc', feedbackIndex: 0n,
        value: 92n, valueDecimals: 0,
        tag1: 'starred', tag2: '', endpoint: '',
        feedbackURI: '', feedbackHash: '0x0000',
      },
    })
  })

  it('parses a FeedbackRevoked event', () => {
    const result = parseReputationLog({
      eventName: 'FeedbackRevoked',
      args: { agentId: 1n, clientAddress: '0xabc', feedbackIndex: 0n },
      blockNumber: 1003n, transactionHash: '0xmno', logIndex: 3,
    }, 44787)

    expect(result?.kind).toBe('feedback_revoked')
    expect(result).toEqual({
      chainId: 44787, block: 1003, txHash: '0xmno', logIndex: 3,
      kind: 'feedback_revoked', agentId: 1,
      data: { clientAddress: '0xabc', feedbackIndex: 0n },
    })
  })

  it('parses a ResponseAppended event', () => {
    const result = parseReputationLog({
      eventName: 'ResponseAppended',
      args: {
        agentId: 5n, clientAddress: '0xresp', feedbackIndex: 2n,
        responder: '0xowner', responseURI: 'ipfs://Qm...', responseHash: '0xhash',
      },
      blockNumber: 1005n, transactionHash: '0xstu', logIndex: 5,
    }, 42220)

    expect(result?.kind).toBe('response')
    expect(result).toEqual({
      chainId: 42220, block: 1005, txHash: '0xstu', logIndex: 5,
      kind: 'response', agentId: 5,
      data: {
        clientAddress: '0xresp', feedbackIndex: 2n,
        responder: '0xowner', responseURI: 'ipfs://Qm...', responseHash: '0xhash',
      },
    })
  })

  it('returns null for unknown event', () => {
    const result = parseReputationLog({
      eventName: 'UnknownEvent', args: {},
      blockNumber: 1004n, transactionHash: '0xpqr', logIndex: 4,
    }, 44787)
    expect(result).toBeNull()
  })
})
