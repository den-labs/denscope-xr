import type { CursorState } from '@/types/cursor'

export function createCursorStore() {
  const memory = new Map<number, CursorState>()
  let dbPromise: Promise<IDBDatabase> | null = null

  function getDb(): Promise<IDBDatabase> | null {
    if (typeof window === 'undefined' || !window.indexedDB) return null
    if (dbPromise) return dbPromise
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('denscope', 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('cursors'))
          db.createObjectStore('cursors', { keyPath: 'chainId' })
        if (!db.objectStoreNames.contains('blockTimestamps'))
          db.createObjectStore('blockTimestamps')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return dbPromise
  }

  return {
    async getCursor(chainId: number): Promise<CursorState | null> {
      const db = getDb()
      if (!db) return memory.get(chainId) ?? null
      try {
        const resolved = await db
        return new Promise((resolve, reject) => {
          const tx = resolved.transaction('cursors', 'readonly')
          const req = tx.objectStore('cursors').get(chainId)
          req.onsuccess = () => resolve(req.result ?? null)
          req.onerror = () => reject(req.error)
        })
      } catch {
        return memory.get(chainId) ?? null
      }
    },

    async saveCursor(cursor: CursorState): Promise<void> {
      memory.set(cursor.chainId, cursor)
      const db = getDb()
      if (!db) return
      try {
        const resolved = await db
        return new Promise((resolve, reject) => {
          const tx = resolved.transaction('cursors', 'readwrite')
          tx.objectStore('cursors').put(cursor)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      } catch {
        /* memory fallback already set */
      }
    },
  }
}
