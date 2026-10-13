import { useSyncExternalStore } from 'react'
import { getConsent, onConsentGranted } from '../consent'
import type { Analysis } from './model'
import { buildExample, EXAMPLE_ID } from './example'
import { clearMediaDb, deleteMediaBlob, getMediaBlob } from './mediaDb'

/**
 * Analyses created in this browser. Full objects (with audio URLs and computed signals)
 * live in memory; a serializable copy is kept in localStorage so the list and scores
 * survive a reload. Audio recordings are cached locally in IndexedDB.
 */
const KEY_BASE = 'sa.analyses.v1'
const MAX_SAVED = 30

const mem = new Map<string, Analysis>()
const listeners = new Set<() => void>()
const pendingAudioLoads = new Set<string>()
let userKey: string | null = null
let snapshot: Analysis[] = []
let example: Analysis | null = null

/** Switch the store to a signed-in user (or null on sign-out). */
export function setStoreUser(userId: string | null) {
  const next = userId ? `${KEY_BASE}:${userId}` : null
  if (next === userKey) return
  // Only clear memory if switching between different accounts or logging out
  if (userKey !== null) {
    mem.forEach((a) => {
      if (a.audio?.participantUrl) URL.revokeObjectURL(a.audio.participantUrl)
      if (a.audio?.referenceUrl) URL.revokeObjectURL(a.audio.referenceUrl)
    })
    mem.clear()
  }
  userKey = next
  snapshot = readSaved()
  mem.forEach((a) => {
    if (!snapshot.some((s) => s.id === a.id)) {
      snapshot = [a, ...snapshot].slice(0, MAX_SAVED)
    }
  })
  listeners.forEach((l) => l())
}

function readSaved(): Analysis[] {
  if (!userKey) return []
  try {
    const raw = localStorage.getItem(userKey)
    const parsed = raw ? (JSON.parse(raw) as Analysis[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function strip(a: Analysis): Analysis {
  const copy: Analysis = { ...a }
  delete copy.audio
  delete copy.peaks
  delete copy.contours
  return copy
}

function persist(list: Analysis[]) {
  if (!userKey || !getConsent().history) return
  try {
    localStorage.setItem(userKey, JSON.stringify(list.slice(0, MAX_SAVED).map(strip)))
  } catch {
    /* storage full or blocked: the in-memory copy still works for this visit */
  }
}

onConsentGranted((c) => c.history && persist(snapshot))

export function saveAnalysis(a: Analysis) {
  mem.set(a.id, a)
  snapshot = [a, ...snapshot.filter((x) => x.id !== a.id)].slice(0, MAX_SAVED)
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function deleteAnalysis(id: string) {
  const a = mem.get(id)
  if (a?.audio?.participantUrl) URL.revokeObjectURL(a.audio.participantUrl)
  if (a?.audio?.referenceUrl) URL.revokeObjectURL(a.audio.referenceUrl)
  mem.delete(id)
  void deleteMediaBlob(id)
  snapshot = snapshot.filter((x) => x.id !== id)
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function clearAnalyses() {
  ;[...mem.keys()].forEach(deleteAnalysis)
  void clearMediaDb()
  snapshot = []
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function getExample(): Analysis {
  if (!example) example = buildExample()
  return example
}

function tryRestoreAudio(id: string) {
  if (id === EXAMPLE_ID || pendingAudioLoads.has(id)) return
  pendingAudioLoads.add(id)
  void getMediaBlob(id).then((blob) => {
    pendingAudioLoads.delete(id)
    if (!blob) return
    const current = mem.get(id) ?? snapshot.find((a) => a.id === id)
    if (current && !current.audio?.participantUrl) {
      const url = URL.createObjectURL(blob)
      const updated: Analysis = {
        ...current,
        audio: {
          ...current.audio,
          participantUrl: url,
        },
      }
      mem.set(id, updated)
      listeners.forEach((l) => l())
    }
  })
}

export function getAnalysis(id: string): Analysis | null {
  if (id === EXAMPLE_ID) return getExample()
  const a = mem.get(id) ?? snapshot.find((x) => x.id === id) ?? null
  if (a && !a.audio?.participantUrl) {
    tryRestoreAudio(id)
  }
  return a
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Live list of the user's own analyses, newest first. */
export function useAnalyses(): Analysis[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}

/**
 * Reactive single-analysis lookup. Reads from the in-memory map first so the
 * full Analysis (including `audio.participantUrl`) is returned immediately after
 * `saveAnalysis` and restored from IndexedDB across page reloads.
 */
export function useAnalysis(id: string): Analysis | null {
  const result = useSyncExternalStore(
    subscribe,
    () => {
      if (id === EXAMPLE_ID) return getExample()
      return mem.get(id) ?? snapshot.find((a) => a.id === id) ?? null
    },
    () => {
      if (id === EXAMPLE_ID) return getExample()
      return mem.get(id) ?? snapshot.find((a) => a.id === id) ?? null
    },
  )
  if (result && !result.audio?.participantUrl && id !== EXAMPLE_ID) {
    tryRestoreAudio(id)
  }
  return result
}
