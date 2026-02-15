import { describe, it, expect, beforeEach } from 'vitest'
import { useEventStore } from '../events'
import type { ScopeEvent } from '@/types/events'

const makeEvent = (block: number): ScopeEvent => ({
  chainId: 44787,
  block,
  txHash: `0x${block}`,
  logIndex: 0,
  kind: 'register',
  agentId: 1,
  data: { agentURI: 'https://example.com', owner: '0x1' },
})

describe('useEventStore', () => {
  beforeEach(() => {
    useEventStore.getState().clear()
  })

  it('starts empty', () => {
    expect(useEventStore.getState().events).toEqual([])
  })

  it('pushes events (newest first)', () => {
    useEventStore.getState().push(makeEvent(100))
    useEventStore.getState().push(makeEvent(101))
    const events = useEventStore.getState().events
    expect(events[0].block).toBe(101)
    expect(events[1].block).toBe(100)
  })

  it('respects max size', () => {
    for (let i = 0; i < 600; i++) {
      useEventStore.getState().push(makeEvent(i))
    }
    expect(useEventStore.getState().events.length).toBeLessThanOrEqual(500)
  })

  it('pushBatch adds multiple events (newest first)', () => {
    const batch = [makeEvent(10), makeEvent(20), makeEvent(30)]
    useEventStore.getState().pushBatch(batch)
    const events = useEventStore.getState().events
    expect(events[0].block).toBe(30)
    expect(events[2].block).toBe(10)
  })

  it('pushBatch respects max size', () => {
    const existing = Array.from({ length: 490 }, (_, i) => makeEvent(i))
    existing.forEach((e) => useEventStore.getState().push(e))
    const batch = Array.from({ length: 20 }, (_, i) => makeEvent(1000 + i))
    useEventStore.getState().pushBatch(batch)
    expect(useEventStore.getState().events.length).toBeLessThanOrEqual(500)
  })

  it('clear resets to empty', () => {
    useEventStore.getState().push(makeEvent(1))
    useEventStore.getState().clear()
    expect(useEventStore.getState().events).toEqual([])
  })
})
