import { describe, it, expect, beforeEach } from 'vitest'
import { createCursorStore } from '../idb'
import type { CursorState } from '@/types/cursor'

describe('createCursorStore (memory fallback)', () => {
  let store: ReturnType<typeof createCursorStore>

  beforeEach(() => {
    // Ensure IDB is unavailable so the memory fallback path is used
    const original = window.indexedDB
    Object.defineProperty(window, 'indexedDB', { value: undefined, writable: true, configurable: true })
    store = createCursorStore()
    Object.defineProperty(window, 'indexedDB', { value: original, writable: true, configurable: true })
  })

  it('getCursor returns null initially', async () => {
    const result = await store.getCursor(42220)
    expect(result).toBeNull()
  })

  it('saveCursor then getCursor returns the saved cursor', async () => {
    const cursor: CursorState = {
      chainId: 42220,
      lastBlock: 5000,
      lastBlockHash: '0xabc123',
      lastLogIndex: 2,
      timestamp: Date.now(),
    }

    await store.saveCursor(cursor)
    const result = await store.getCursor(42220)
    expect(result).toEqual(cursor)
  })

  it('getCursor returns null for unknown chainId after saving another', async () => {
    const cursor: CursorState = {
      chainId: 42220,
      lastBlock: 1000,
      lastBlockHash: '0xdef',
      lastLogIndex: 0,
      timestamp: Date.now(),
    }

    await store.saveCursor(cursor)
    const result = await store.getCursor(11142220)
    expect(result).toBeNull()
  })
})
