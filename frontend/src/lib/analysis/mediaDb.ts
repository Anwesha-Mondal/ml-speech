/**
 * Local IndexedDB cache for participant recordings.
 * Allows audio playback to survive page reloads and back/forward navigation
 * without bloating localStorage or transmitting recordings anywhere.
 */

const DB_NAME = 'sa.audio.v1'
const STORE_NAME = 'blobs'

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, id)
  } catch {
    /* IndexedDB best-effort */
  }
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDb()
    if (!db) return null
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(id)
        req.onsuccess = () => resolve((req.result as Blob) ?? null)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

export async function deleteMediaBlob(id: string): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
  } catch {
    /* ignore */
  }
}

export async function clearMediaDb(): Promise<void> {
  try {
    const db = await openDb()
    if (!db) return
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
  } catch {
    /* ignore */
  }
}
