import { describe, it, expect, beforeEach } from 'vitest'
import { createCursorStore } from '../idb'
import type { CursorState } from '@/types/cursor'

describe('createCursorStore (in-memory fallback)', () => {
  let store: ReturnType<typeof createCursorStore>

  beforeEach(() => { store = createCursorStore() })

  it('returns null for unknown chain', async () => {
    expect(await store.getCursor(99999)).toBeNull()
  })

  it('saves and retrieves cursor', async () => {
    const cursor: CursorState = {
      chainId: 44787, lastBlock: 1000, lastBlockHash: '0xabc',
      lastLogIndex: 5, timestamp: Date.now(),
    }
    await store.saveCursor(cursor)
    expect(await store.getCursor(44787)).toEqual(cursor)
  })

  it('overwrites previous cursor for same chain', async () => {
    await store.saveCursor({ chainId: 44787, lastBlock: 1000, lastBlockHash: '0xabc', lastLogIndex: 0, timestamp: 1 })
    await store.saveCursor({ chainId: 44787, lastBlock: 2000, lastBlockHash: '0xdef', lastLogIndex: 3, timestamp: 2 })
    const cursor = await store.getCursor(44787)
    expect(cursor?.lastBlock).toBe(2000)
  })
})
