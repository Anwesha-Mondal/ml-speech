import { useSyncExternalStore } from 'react'
import type { Analysis } from './model'
import { buildExample, EXAMPLE_ID } from './example'

/**
 * Analyses created in this browser. Full objects (with audio URLs and computed signals)
 * live in memory; a serializable copy is kept in localStorage so the list and scores
 * survive a reload. Audio itself is never stored.
 */
const KEY = 'sa.analyses.v1'
const MAX_SAVED = 30

const mem = new Map<string, Analysis>()
const listeners = new Set<() => void>()
let snapshot: Analysis[] = readSaved()
let example: Analysis | null = null

function readSaved(): Analysis[] {
  try {
    const raw = localStorage.getItem(KEY)
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
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED).map(strip)))
  } catch {
    /* storage full or blocked: the in-memory copy still works for this visit */
  }
}

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
  snapshot = snapshot.filter((x) => x.id !== id)
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function clearAnalyses() {
  ;[...mem.keys()].forEach(deleteAnalysis)
  snapshot = []
  persist(snapshot)
  listeners.forEach((l) => l())
}

export function getExample(): Analysis {
  if (!example) example = buildExample()
  return example
}

export function getAnalysis(id: string): Analysis | null {
  if (id === EXAMPLE_ID) return getExample()
  return mem.get(id) ?? snapshot.find((a) => a.id === id) ?? null
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
